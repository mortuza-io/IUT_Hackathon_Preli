import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const BACKEND_URL = "http://localhost:3000";
const socket = io(BACKEND_URL);

const ROOM_ORDER = ["Drawing Room", "Work Room 1", "Work Room 2"];

const ROOM_LAYOUT = {
  "Drawing Room": { x: 20, y: 20, w: 293, h: 380 },
  "Work Room 1": { x: 333, y: 20, w: 293, h: 380 },
  "Work Room 2": { x: 646, y: 20, w: 294, h: 380 },
};

function timeAgo(ts, now) {
  const seconds = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function Light({ cx, cy, on, label }) {
  return (
    <g className={`light ${on ? "on" : ""}`}>
      <title>{label}</title>
      <circle className="light-glow" cx={cx} cy={cy} r="28" />
      <circle className="light-bulb" cx={cx} cy={cy} r="9" />
    </g>
  );
}

function Fan({ cx, cy, on, label }) {
  return (
    <g className={`fan ${on ? "on" : ""}`}>
      <title>{label}</title>
      <circle className="fan-ring" cx={cx} cy={cy} r="19" />
      <g transform={`translate(${cx} ${cy})`}>
        <g className="fan-rotor">
          <circle r="18" fill="none" />
          {[0, 120, 240].map((angle) => (
            <ellipse
              key={angle}
              className="fan-blade"
              cx="0"
              cy="-9.5"
              rx="4.2"
              ry="9"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
      </g>
      <circle className="fan-hub" cx={cx} cy={cy} r="3.2" />
    </g>
  );
}

function Room({ name, devices }) {
  const r = ROOM_LAYOUT[name];
  const lights = devices.filter((d) => d.type === "Light");
  const fans = devices.filter((d) => d.type === "Fan");
  const cx = r.x + r.w / 2;
  const isDrawingRoom = name === "Drawing Room";

  return (
    <g>
      <rect className="room" x={r.x} y={r.y} width={r.w} height={r.h} rx="12" />
      <text className="room-label" x={r.x + 16} y={r.y + 30}>
        {name.toUpperCase()}
      </text>

      {isDrawingRoom ? (
        <>
          <rect className="furniture" x={r.x + 36} y={r.y + 270} width="88" height="58" rx="12" />
          <rect className="furniture" x={r.x + r.w - 124} y={r.y + 270} width="88" height="58" rx="12" />
          <circle className="furniture" cx={cx} cy={r.y + 345} r="20" />
        </>
      ) : (
        <>
          <rect className="furniture" x={r.x + 30} y={r.y + 292} width="100" height="52" rx="6" />
          <rect className="furniture" x={r.x + r.w - 130} y={r.y + 292} width="100" height="52" rx="6" />
          <circle className="chair" cx={r.x + 80} cy={r.y + 274} r="8" />
          <circle className="chair" cx={r.x + r.w - 80} cy={r.y + 274} r="8" />
        </>
      )}

      {lights.map((d, i) => (
        <Light
          key={d.id}
          cx={cx + (i - 1) * 85}
          cy={r.y + 85}
          on={d.status}
          label={`${name} - ${d.name} - ${d.status ? "ON" : "OFF"}`}
        />
      ))}
      {fans.map((d, i) => (
        <Fan
          key={d.id}
          cx={cx + (i - 1) * 78}
          cy={r.y + 195}
          on={d.status}
          label={`${name} - ${d.name} - ${d.status ? "RUNNING" : "OFF"}`}
        />
      ))}
    </g>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        <span className="stat-dot" style={{ background: color }} />
        {label}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button className="theme-toggle" onClick={onToggle} aria-label="Toggle color theme">
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

function App() {
  const [devices, setDevices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [usage, setUsage] = useState({ todayKwh: 0 });
  const [connected, setConnected] = useState(socket.connected);
  const [now, setNow] = useState(Date.now());
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const fetchJson = (path, setter) =>
      fetch(`${BACKEND_URL}${path}`)
        .then((res) => res.json())
        .then(setter)
        .catch(() => {});

    fetchJson("/api/devices", setDevices);
    fetchJson("/api/alerts", setAlerts);
    fetchJson("/api/usage", setUsage);

    const onDevices = (data) => setDevices([...data]);
    const onAlerts = (data) => setAlerts([...data]);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("device-update", onDevices);
    socket.on("alerts-update", onAlerts);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const clock = setInterval(() => setNow(Date.now()), 1000);
    const usagePoll = setInterval(() => fetchJson("/api/usage", setUsage), 5000);

    return () => {
      socket.off("device-update", onDevices);
      socket.off("alerts-update", onAlerts);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      clearInterval(clock);
      clearInterval(usagePoll);
    };
  }, []);

  const byRoom = useMemo(() => {
    const map = Object.fromEntries(ROOM_ORDER.map((r) => [r, []]));
    for (const d of devices) {
      if (map[d.room]) map[d.room].push(d);
    }
    return map;
  }, [devices]);

  const stats = useMemo(() => {
    const on = devices.filter((d) => d.status);
    return {
      totalPower: on.reduce((sum, d) => sum + d.power, 0),
      lightsOn: on.filter((d) => d.type === "Light").length,
      lightsTotal: devices.filter((d) => d.type === "Light").length,
      fansOn: on.filter((d) => d.type === "Fan").length,
      fansTotal: devices.filter((d) => d.type === "Fan").length,
      devicesOn: on.length,
      devicesTotal: devices.length,
    };
  }, [devices]);

  const roomPower = useMemo(() => {
    const power = {};
    const max = {};
    for (const room of ROOM_ORDER) {
      const inRoom = byRoom[room] || [];
      power[room] = inRoom.reduce((sum, d) => sum + (d.status ? d.power : 0), 0);
      max[room] = inRoom.reduce((sum, d) => sum + d.power, 0) || 1;
    }
    return { power, max };
  }, [byRoom]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <h1>Smart Office</h1>
        </div>
        <div className="topbar-right">
          <span className="clock">
            {new Date(now).toLocaleTimeString("en-GB", { hour12: false })}
          </span>
          <span className={`conn-badge ${connected ? "live" : "down"}`}>
            {connected ? "\u25CF LIVE" : "OFFLINE"}
          </span>
          <ThemeToggle
            theme={theme}
            onToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
          />
        </div>
      </header>

      <main className="layout">
        <section className="stats">
          <StatCard
            label="Total Power Draw"
            value={`${stats.totalPower} W`}
            sub="live consumption"
            color="var(--red)"
          />
          <StatCard
            label="Usage Today"
            value={`${(usage.todayKwh ?? 0).toFixed(3)} kWh`}
            sub="since midnight"
            color="var(--accent)"
          />
          <StatCard
            label="Lights On"
            value={stats.lightsOn}
            sub={`of ${stats.lightsTotal} total`}
            color="var(--amber)"
          />
          <StatCard
            label="Fans Running"
            value={stats.fansOn}
            sub={`of ${stats.fansTotal} total`}
            color="var(--sky)"
          />
          <StatCard
            label="Devices Active"
            value={`${stats.devicesOn} / ${stats.devicesTotal}`}
            sub="across 3 rooms"
            color="var(--green)"
          />
        </section>

        <div className="main-col">
          <section className="card floor-card">
            <div className="card-head">
              <h2>Floor Plan {"\u2014"} Live View</h2>
              <div className="legend">
                <span><i style={{ background: "var(--amber)" }} />Light on</span>
                <span><i style={{ background: "var(--sky)" }} />Fan running</span>
              </div>
            </div>
            <div className="floor">
              <svg viewBox="0 0 960 420" role="img" aria-label="Live office floor plan">
                {ROOM_ORDER.map((room) => (
                  <Room key={room} name={room} devices={byRoom[room] || []} />
                ))}
              </svg>
            </div>
          </section>

          <section className="card power-card">
            <div className="card-head">
              <h2>Power Consumption</h2>
              <span className="power-total">{stats.totalPower} W</span>
            </div>
            {ROOM_ORDER.map((room) => (
              <div className="power-row" key={room}>
                <span className="power-room">{room}</span>
                <div className="power-bar">
                  <div
                    className="power-fill"
                    style={{
                      width: `${(roomPower.power[room] / roomPower.max[room]) * 100}%`,
                    }}
                  />
                </div>
                <span className="power-val">{roomPower.power[room]} W</span>
              </div>
            ))}
          </section>
        </div>

        <aside className="side-col">
          <section className="card alerts-card">
            <div className="card-head">
              <h2>Active Alerts</h2>
              <span className={`count-badge ${alerts.length ? "warn" : ""}`}>
                {alerts.length}
              </span>
            </div>
            <div className="alerts-list">
              {alerts.length === 0 ? (
                <div className="empty">
                  <span className="ok">{"\u2713"}</span> All clear {"\u2014"} no anomalies detected
                </div>
              ) : (
                alerts.map((a) => (
                  <div className="alert" key={a.id}>
                    <span className="alert-icon">{"\u26A0\uFE0F"}</span>
                    <div>
                      <div className="alert-msg">{a.message}</div>
                      <div className="alert-time">
                        {new Date(a.timestamp).toLocaleTimeString("en-GB", { hour12: false })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="card devices-card">
            <div className="card-head">
              <h2>Devices</h2>
              <span className="count-badge">{stats.devicesOn} on</span>
            </div>
            <div className="devices-scroll">
              {ROOM_ORDER.map((room) => (
                <div key={room}>
                  <div className="dev-group">{room}</div>
                  {(byRoom[room] || []).map((d) => (
                    <div className="dev-row" key={d.id}>
                      <div className="dev-info">
                        <span
                          className={`dev-dot ${d.type === "Light" ? "is-light" : "is-fan"} ${
                            d.status ? "on" : ""
                          }`}
                        />
                        <div>
                          <div className="dev-name">{d.name}</div>
                          <div className="dev-meta">
                            {d.status ? `${d.power} W` : "0 W"} {"\u00B7"} changed{" "}
                            {timeAgo(d.lastChanged, now)}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`pill ${
                          d.status ? (d.type === "Fan" ? "run" : "on") : "off"
                        }`}
                      >
                        {d.status ? "ON" : "OFF"}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

export default App;
