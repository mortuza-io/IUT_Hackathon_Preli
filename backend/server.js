import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(express.json());
app.use(cors());

const rooms = ["Drawing Room", "Work Room 1", "Work Room 2"];

// 3 lights + 3 fans per room = 6 devices per room, 18 devices total
const deviceTypes = [
  { type: "Light", count: 3, power: 15 },
  { type: "Fan", count: 3, power: 60 }
];

const officeHours = { start: 9, end: 17 }; // 9 AM - 5 PM
const onLimit = 2 * 60 * 60 * 1000; // 2 hours

export let devices = [];
let nextId = 1;

for (const room of rooms) {
  for (const { type, count, power } of deviceTypes) {
    for (let i = 1; i <= count; i++) {
      devices.push({
        id: nextId++,
        room,
        type,
        name: `${type} ${i}`,
        status: Math.random() < 0.5,
        power,
        lastChanged: new Date()
      });
    }
  }
}

const currentPower = () =>{
    return devices.reduce((sum, d) => sum + (d.status ? d.power : 0), 0);
}


const powerByRoom = () => {
  const map = {
    "Drawing Room": 0,
    "Work Room 1": 0,
    "Work Room 2": 0
  };

  for (const d of devices) {
    if (d.status) {
      map[d.room] += d.power;
    }
  }

  return map;
};

// ---------------------------------------------------------------------------
// Energy accounting: Wh accumulated since midnight (sampled every second)
// ---------------------------------------------------------------------------
let todayWh = 0;
let currentDay = new Date().getDate();

setInterval(() => {
  const now = new Date();
  if (now.getDate() !== currentDay) {
    currentDay = now.getDate();
    todayWh = 0;
    console.log("reset");
  }
  todayWh += currentPower() / 3600; // one second worth of Wh
}, 1000);

const todayKwh = () => Number((todayWh / 1000).toFixed(3));

// ---------------------------------------------------------------------------
// Alerts engine
// - After-hours: any device ON outside office hours (9 AM - 5 PM)
// - All-on streak: every device in a room ON for more than 2 hours
// ---------------------------------------------------------------------------
const roomAllOnSince = {};
let alerts = [];
let nextAlertId = 1;

function describeOn(roomDevices) {
  const fans = roomDevices.filter((d) => d.type === "Fan" && d.status).length;
  const lights = roomDevices.filter((d) => d.type === "Light" && d.status).length;
  const parts = [];
  if (fans) parts.push(`${fans} fan${fans > 1 ? "s" : ""}`);
  if (lights) parts.push(`${lights} light${lights > 1 ? "s" : ""}`);
  return parts.join(" and ");
}

function refreshAlerts() {
  const now = new Date();
  const candidates = [];

  // Track continuous "all devices ON" streaks per room
  for (const room of rooms) {
    const roomDevices = devices.filter((d) => d.room === room);
    if (roomDevices.length && roomDevices.every((d) => d.status)) {
      if (!roomAllOnSince[room]) roomAllOnSince[room] = now.getTime();
    } else {
      delete roomAllOnSince[room];
    }
  }

  const hour = now.getHours();
  const afterHours = hour < officeHours.start || hour >= officeHours.end;

  if (afterHours) {
    for (const room of rooms) {
      const roomDevices = devices.filter((d) => d.room === room);
      if (roomDevices.some((d) => d.status)) {
        candidates.push({
          type: "after-hours",
          room,
          message: `${room} still has ${describeOn(roomDevices)} ON outside office hours (9 AM-5 PM).`
        });
      }
    }
  }

  for (const [room, since] of Object.entries(roomAllOnSince)) {
    if (now.getTime() - since >= onLimit) {
      candidates.push({
        type: "all-on",
        room,
        message: `Every device in ${room} has been ON for more than 2 hours straight.`
      });
    }
  }

  // Keep timestamps of already-active alerts, create + broadcast new ones
  const next = [];
  for (const candidate of candidates) {
    const existing = alerts.find(
      (a) => a.type === candidate.type && a.room === candidate.room
    );
    if (existing) {
      next.push(existing);
    } else {
      const created = { id: nextAlertId++, ...candidate, timestamp: now };
      next.push(created);
      io.emit("new-alert", created);
    }
  }

  const changed =
    next.length !== alerts.length ||
    next.some((a, i) => alerts[i]?.id !== a.id);
  alerts = next;
  if (changed) io.emit("alerts-update", alerts);
}

setInterval(refreshAlerts, 15000);


setInterval(() => {
  const toggles = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < toggles; i++) {
    const device = devices[Math.floor(Math.random() * devices.length)];
    device.status = !device.status;
    device.lastChanged = new Date();
  }
  refreshAlerts();
  io.emit("device-update", devices);
}, 4000);

io.on("connection", (socket) => {
  console.log("Client connected");
  socket.emit("device-update", devices);
  socket.emit("alerts-update", alerts);
});


app.get("/api/devices", (req, res) => {
  res.json(devices);
});

app.get("/api/power", (req, res) => {
  res.json({ totalPower: currentPower(), perRoom: powerByRoom() });
});

app.get("/api/usage", (req, res) => {
  res.json({ totalPower: currentPower(), todayKwh: todayKwh() });
});

app.get("/api/alerts", (req, res) => {
  res.json(alerts);
});

app.get("/api/summary", (req, res) => {
  const rooms = rooms.map((room) => {
    const roomDevices = devices.filter((d) => d.room === room);
    return {
      room,
      lightsOn: roomDevices.filter((d) => d.type === "Light" && d.status).length,
      lightsTotal: roomDevices.filter((d) => d.type === "Light").length,
      fansOn: roomDevices.filter((d) => d.type === "Fan" && d.status).length,
      fansTotal: roomDevices.filter((d) => d.type === "Fan").length,
      power: roomDevices.reduce((sum, d) => sum + (d.status ? d.power : 0), 0)
    };
  });
  res.json({ rooms, totalPower: currentPower(), todayKwh: todayKwh(), alerts });
});

server.listen(3000, () => {
  console.log("server is running on port 3000");
});
