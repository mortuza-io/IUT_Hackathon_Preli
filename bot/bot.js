import "dotenv/config";
import { Client, Events, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { io } from "socket.io-client";

const BACKEND_URL = "http://localhost:3000";
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ALERT_CHANNEL_ID = process.env.ALERT_CHANNEL_ID;

if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is missing.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const ROOM_ALIASES = {
  drawing: "Drawing Room",
  drawingroom: "Drawing Room",
  "drawing room": "Drawing Room",
  work1: "Work Room 1",
  workroom1: "Work Room 1",
  "work room 1": "Work Room 1",
  work2: "Work Room 2",
  workroom2: "Work Room 2",
  "work room 2": "Work Room 2"
};

async function api(path) {
  const res = await fetch(`${BACKEND_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function roomText(room) {
  return [
    `🌀 Fans ON: **${room.fansOn} / 2**`,
    `💡 Lights ON: **${room.lightsOn} / 3**`,
    `⚡ Power: **${room.power}W**`
  ].join("\n");
}

function statusEmbed(summary) {
  const totalPower = summary.rooms.reduce((sum, room) => sum + room.power, 0);

  return new EmbedBuilder()
    .setTitle("🏢 Office Live Status")
    .setDescription("Here is the current real-time device condition.")
    .setColor(0x2ecc71)
    .addFields(
      ...summary.rooms.map((room) => ({
        name: room.room,
        value: roomText(room),
        inline: true
      })),
      {
        name: "Total Power",
        value: `⚡ **${totalPower}W**`,
        inline: false
      }
    )
    .setFooter({ text: "Smart Office Power Monitor" })
    .setTimestamp();
}

function roomEmbed(room) {
  return new EmbedBuilder()
    .setTitle(`🚪 ${room.room}`)
    .setDescription("Room-wise live device status")
    .setColor(room.power > 0 ? 0xf1c40f : 0x95a5a6)
    .addFields(
      { name: "Fans", value: `🌀 **${room.fansOn} / 2 ON**`, inline: true },
      { name: "Lights", value: `💡 **${room.lightsOn} / 3 ON**`, inline: true },
      { name: "Power", value: `⚡ **${room.power}W**`, inline: true }
    )
    .setFooter({ text: "Data from shared backend" })
    .setTimestamp();
}

function usageEmbed(usage) {
  return new EmbedBuilder()
    .setTitle("⚡ Power Usage")
    .setDescription("Current electricity usage summary")
    .setColor(0x3498db)
    .addFields(
      {
        name: "Current Power",
        value: `⚡ **${usage.totalPower}W**`,
        inline: true
      },
      {
        name: "Today’s Estimated Usage",
        value: `📊 **${usage.todayKwh} kWh**`,
        inline: true
      }
    )
    .setFooter({ text: "Updated from live simulated device data" })
    .setTimestamp();
}

function helpEmbed() {
  return new EmbedBuilder()
    .setTitle("🤖 Office Monitor Bot")
    .setDescription("Use these commands to check the office devices.")
    .setColor(0x9b59b6)
    .addFields(
      { name: "!status", value: "Shows all room device status" },
      { name: "!room drawing", value: "Shows Drawing Room status" },
      { name: "!room work1", value: "Shows Work Room 1 status" },
      { name: "!room work2", value: "Shows Work Room 2 status" },
      { name: "!usage", value: "Shows total power and daily usage" }
    );
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const text = message.content.trim().toLowerCase();

  try {
    if (text === "!help") {
      await message.reply({ embeds: [helpEmbed()] });
      return;
    }

    if (text === "!status") {
      const summary = await api("/api/summary");
      await message.reply({ embeds: [statusEmbed(summary)] });
      return;
    }

    if (text.startsWith("!room")) {
      const query = text.replace("!room", "").trim();
      const roomName = ROOM_ALIASES[query];

      if (!roomName) {
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Room Not Found")
              .setDescription("Try `!room drawing`, `!room work1`, or `!room work2`.")
              .setColor(0xe74c3c)
          ]
        });
        return;
      }

      const summary = await api("/api/summary");
      const room = summary.rooms.find((r) => r.room === roomName);

      await message.reply({ embeds: [roomEmbed(room)] });
      return;
    }

    if (text === "!usage") {
      const usage = await api("/api/usage");
      await message.reply({ embeds: [usageEmbed(usage)] });
      return;
    }
  } catch (err) {
    console.error(err);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⚠️ Backend Offline")
          .setDescription("I could not reach the backend. Make sure the Node.js server is running.")
          .setColor(0xe74c3c)
      ]
    });
  }
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot logged in as ${readyClient.user.tag}`);

  if (!ALERT_CHANNEL_ID) return;

  const feed = io(BACKEND_URL);

  feed.on("new-alert", async (alert) => {
    try {
      const channel = await client.channels.fetch(ALERT_CHANNEL_ID);

      const embed = new EmbedBuilder()
        .setTitle("🚨 Office Alert")
        .setDescription(alert.message)
        .setColor(0xe74c3c)
        .setFooter({ text: "Automatic alert from live backend" })
        .setTimestamp(new Date(alert.timestamp));

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error("Failed to send alert:", err.message);
    }
  });
});

client.login(DISCORD_TOKEN);
