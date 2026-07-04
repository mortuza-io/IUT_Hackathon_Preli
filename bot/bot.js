import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { io } from "socket.io-client";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ALERT_CHANNEL_ID = process.env.ALERT_CHANNEL_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is missing. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ROOMS = ["Drawing Room", "Work Room 1", "Work Room 2"];

const ROOM_ALIASES = {
  drawing: "Drawing Room",
  drawingroom: "Drawing Room",
  "drawing room": "Drawing Room",
  work1: "Work Room 1",
  workroom1: "Work Room 1",
  "work room 1": "Work Room 1",
  "work 1": "Work Room 1",
  work2: "Work Room 2",
  workroom2: "Work Room 2",
  "work room 2": "Work Room 2",
  "work 2": "Work Room 2"
};

async function api(path) {
  const res = await fetch(`${BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path} responded with ${res.status}`);
  return res.json();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function roomLine(summaryRoom) {
  const { room, fansOn, lightsOn } = summaryRoom;
  if (fansOn === 0 && lightsOn === 0) return `${room}: all off`;
  const parts = [];
  if (fansOn) parts.push(`${fansOn} fan${fansOn > 1 ? "s" : ""} ON`);
  if (lightsOn) parts.push(`${lightsOn} light${lightsOn > 1 ? "s" : ""} ON`);
  return `${room}: ${parts.join(", ")}`;
}

// Optional LLM pass: rephrases the raw facts as a short, friendly message.
// Falls back to built-in templates when no API key is configured.
async function humanize(facts, fallback) {
  if (!OPENAI_API_KEY) return fallback;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 160,
        messages: [
          {
            role: "system",
            content:
              "You are a friendly office-monitoring assistant chatting on Discord. " +
              "Rephrase the given facts as ONE short, warm, conversational message. " +
              "Keep every number and room name exactly as given. No headers, no lists."
          },
          { role: "user", content: facts }
        ]
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || fallback;
  } catch (err) {
    console.error("LLM call failed, using fallback:", err.message);
    return fallback;
  }
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const lower = message.content.trim().toLowerCase();

  try {
    if (lower === "!status") {
      const summary = await api("/api/summary");
      const lines = summary.rooms.map(roomLine).join(". ") + ".";
      const fallback = pick([
        `Here's the office right now \uD83D\uDC40 ${lines}`,
        `Quick walk-through for you: ${lines}`,
        `Office check complete \u2705 ${lines}`
      ]);
      await message.reply(await humanize(`Office status: ${lines}`, fallback));
    } else if (lower.startsWith("!room")) {
      const query = lower.replace("!room", "").trim();
      const room = ROOM_ALIASES[query];
      if (!room) {
        await message.reply(
          "Hmm, I don't know that room \uD83E\uDD14 Try `!room drawing`, `!room work1` or `!room work2`."
        );
        return;
      }
      const summary = await api("/api/summary");
      const data = summary.rooms.find((r) => r.room === room);
      const line = roomLine(data);
      const fallback = pick([
        `${line}. That room is drawing ${data.power}W right now.`,
        `Here you go \u2014 ${line}. Current power there: ${data.power}W.`
      ]);
      await message.reply(
        await humanize(`${line}. Power draw in that room: ${data.power}W.`, fallback)
      );
    } else if (lower === "!usage") {
      const usage = await api("/api/usage");
      const fallback = pick([
        `Total power right now: ${usage.totalPower}W. Today's usage so far: ${usage.todayKwh} kWh \u26A1`,
        `We're pulling ${usage.totalPower}W as we speak, and we've used ${usage.todayKwh} kWh today.`
      ]);
      await message.reply(
        await humanize(
          `Current total power: ${usage.totalPower}W. Energy used today: ${usage.todayKwh} kWh.`,
          fallback
        )
      );
    }
  } catch (err) {
    console.error(err);
    await message.reply(
      "I couldn't reach the office backend \uD83D\uDE1E Is the server on port 3000 running?"
    );
  }
});

// ---------------------------------------------------------------------------
// Proactive alerts: subscribe to the backend's Socket.IO feed and post any
// newly triggered alert to the designated channel.
// ---------------------------------------------------------------------------
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot logged in as ${readyClient.user.tag}`);
  if (!ALERT_CHANNEL_ID) {
    console.log("ALERT_CHANNEL_ID not set - proactive alerts disabled.");
    return;
  }

  const feed = io(BACKEND_URL);
  feed.on("new-alert", async (alert) => {
    try {
      const channel = await client.channels.fetch(ALERT_CHANNEL_ID);
      const time = new Date(alert.timestamp).toLocaleTimeString("en-GB", {
        hour12: false
      });
      const fallback = `\u26A0\uFE0F Heads up! ${alert.message} (detected at ${time})`;
      await channel.send(
        await humanize(
          `Office alert detected at ${time}: ${alert.message} Write it as a playful heads-up.`,
          fallback
        )
      );
    } catch (err) {
      console.error("Failed to post alert to Discord:", err.message);
    }
  });
});

client.login(DISCORD_TOKEN);
