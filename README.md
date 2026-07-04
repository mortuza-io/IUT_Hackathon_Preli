# ⚡ Smart Office Power Monitoring System

A real-time office electricity monitoring system built for the **IUT Hackathon Preliminary Round**.

The system simulates an IoT-enabled office where lights and fans are monitored through a live web dashboard and a Discord bot. Both interfaces share the same backend, ensuring a single source of truth for device states, power consumption, and alerts.

---

## 📌 Features

### 🖥️ Live Web Dashboard

- Real-time device monitoring
- 3 Office Rooms
- 3 Lights + 3 Fans per room
- Total Power Consumption
- Room-wise Power Consumption
- Active Alerts Panel
- Live updates using Socket.IO
- Responsive modern UI

---

### 🤖 Discord Bot

Commands:

```
!help
!status
!room drawing
!room work1
!room work2
!usage
```

Features:

- Beautiful Discord Embeds
- Live device status
- Room-wise information
- Current power usage
- Estimated daily usage
- Automatic alert notifications

---

### ⚡ Device Simulator

The project simulates an office with:

- Drawing Room
- Work Room 1
- Work Room 2

Each room contains:

- 3 Lights
- 3 Fans

Total:

- 18 simulated devices

Every few seconds random devices automatically switch ON/OFF to simulate real-world activity.

Each device stores:

- Name
- Room
- Type
- Status
- Power Consumption
- Last Updated Time

---

### 🚨 Alert System

The backend automatically generates alerts when:

- Devices remain ON after office hours (9 AM – 5 PM)
- Every device in a room remains ON continuously for more than 2 hours

Alerts are displayed on:

- Web Dashboard
- Discord Bot

---

## 🏗️ Project Structure

```
project/
│
├── backend/
│   ├── server.js
│   ├── package.json
│   └── ...
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── ...
│
├── bot/
│   ├── bot.js
│   ├── package.json
│   └── .env
│
└── README.md
```

---

## 🛠️ Technologies Used

### Frontend

- React
- Vite
- Socket.IO Client
- CSS

### Backend

- Node.js
- Express.js
- Socket.IO
- CORS

### Discord

- discord.js

---

## ⚙️ Installation

Clone the repository

```bash
git clone https://github.com/mortuza-io/IUT_Hackathon_Preli.git
```

Open the project

```bash
cd IUT_Hackathon_Preli
```

---

## 📦 Install Dependencies

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

### Discord Bot

```bash
cd bot
npm install
```

---

## ▶️ Running the Project

### Start Backend

```bash
cd backend
node server.js
```

Backend runs on:

```
http://localhost:3000
```

---

### Start Frontend

```bash
cd frontend
npm run dev
```

Open:

```
http://localhost:5173
```

---

### Start Discord Bot

Create a `.env` file inside the **bot** folder.

```env
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
ALERT_CHANNEL_ID=YOUR_CHANNEL_ID
```

Run

```bash
cd bot
node bot.js
```

---

## 🔌 API Endpoints

### Devices

```
GET /api/devices
```

Returns all simulated devices.

---

### Power

```
GET /api/power
```

Returns

- Total Power
- Room-wise Power

---

### Usage

```
GET /api/usage
```

Returns

- Current Power
- Today's Estimated Usage

---

### Alerts

```
GET /api/alerts
```

Returns all active alerts.

---

### Summary

```
GET /api/summary
```

Returns:

- Room-wise summary
- Lights ON
- Fans ON
- Room Power
- Total Power
- Daily Usage
- Alerts

---

## 🔄 System Architecture

```
        Device Simulator
               │
               ▼
      Express.js Backend
               │
       Socket.IO Server
        │             │
        ▼             ▼
 React Dashboard   Discord Bot
```

The backend acts as the single source of truth, ensuring both the dashboard and the Discord bot always display the same live information.

---

## 🚀 Future Improvements

- Real ESP32 Integration
- MQTT Support
- Historical Analytics
- Authentication
- Remote Device Control
- Database Storage
- AI Energy Optimization
- Mobile Notifications

---

## 👥 Team

ASOFT

---

## 📄 License

This project was developed for the **IUT Hackathon Preliminary Round** and is intended for educational and demonstration purposes.
