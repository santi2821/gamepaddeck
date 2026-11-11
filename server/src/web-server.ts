import http from "node:http";
import os from "node:os";
import { WebSocketServer, WebSocket } from "ws";
import { GamepadManager } from "./gamepad-manager.js";
import { PadSlot, Packet, PACKET_LEN } from "./protocol.js";

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GamepadDeck | Server Dashboard</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #121826;
      --card-border: #1f293d;
      --accent: #00e5ff;
      --accent-glow: rgba(0, 229, 255, 0.3);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: var(--bg); color: var(--text); min-height: 100vh; padding: 24px; }
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 24px; border-bottom: 1px solid var(--card-border); margin-bottom: 24px; }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo h1 { font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #00e5ff, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .badge { font-size: 12px; padding: 4px 10px; border-radius: 9999px; font-weight: 600; text-transform: uppercase; }
    .badge-vigem { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-fallback { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3); }
    .stats-bar { display: flex; gap: 20px; font-size: 14px; color: var(--text-muted); }
    .stat-item strong { color: var(--text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; }
    .slot-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px; transition: all 0.2s; }
    .slot-card.active { border-color: var(--accent); box-shadow: 0 0 20px var(--accent-glow); }
    .slot-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .slot-title { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 700; }
    .player-indicator { width: 12px; height: 12px; border-radius: 50%; background: #4b5563; }
    .slot-card.active .player-indicator { background: var(--accent); box-shadow: 0 0 10px var(--accent); }
    .slot-metrics { display: flex; gap: 12px; font-size: 13px; }
    .metric { background: #1a2234; padding: 4px 8px; border-radius: 6px; border: 1px solid #243048; }
    .gamepad-visual { margin: 16px 0; background: #0c101a; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .triggers-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; }
    .trigger-bar-bg { height: 8px; background: #243048; border-radius: 4px; overflow: hidden; margin-top: 4px; }
    .trigger-bar-fill { height: 100%; width: 0%; background: var(--accent); transition: width 0.05s; }
    .sticks-row { display: flex; justify-content: space-around; align-items: center; }
    .stick-box { text-align: center; font-size: 11px; color: var(--text-muted); }
    .stick-circle { width: 70px; height: 70px; border-radius: 50%; border: 2px solid #243048; background: #151d2f; position: relative; margin: 4px auto; }
    .stick-thumb { width: 22px; height: 22px; border-radius: 50%; background: #3b82f6; position: absolute; top: 24px; left: 24px; transition: transform 0.05s ease-out; }
    .buttons-grid { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .btn-chip { font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; background: #1a2234; border: 1px solid #243048; color: #6b7280; }
    .btn-chip.pressed { background: var(--accent); color: #000; border-color: var(--accent); box-shadow: 0 0 8px var(--accent); }
    .disconnect-btn { width: 100%; margin-top: 12px; padding: 8px; background: transparent; border: 1px solid #374151; color: var(--text-muted); border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; }
    .disconnect-btn:hover { background: rgba(239, 68, 68, 0.2); border-color: var(--danger); color: var(--danger); }
  </style>
</head>
<body>
  <header>
    <div class="logo">
      <h1>GamepadDeck Server (Node.js)</h1>
      <span id="driverBadge" class="badge badge-fallback">Loading...</span>
    </div>
    <div class="stats-bar">
      <div class="stat-item">Uptime: <strong id="uptime">0s</strong></div>
      <div class="stat-item">UDP: <strong id="udpCount">0</strong> pkts</div>
      <div class="stat-item">WS: <strong id="wsCount">0</strong> pkts</div>
    </div>
  </header>
  <main class="grid" id="slotsGrid"></main>
  <script>
    const BTN_MASKS = {
      dpad_up: 0x0001, dpad_down: 0x0002, dpad_left: 0x0004, dpad_right: 0x0008,
      start: 0x0010, back: 0x0020, thumb_l: 0x0040, thumb_r: 0x0080,
      shoulder_l: 0x0100, shoulder_r: 0x0200, guide: 0x0400,
      a: 0x1000, b: 0x2000, x: 0x4000, y: 0x8000
    };
    const slotsGrid = document.getElementById('slotsGrid');
    for (let i = 0; i < 4; i++) {
      const card = document.createElement('div');
      card.className = 'slot-card';
      card.id = 'slot-' + i;
      card.innerHTML = \`
        <div class="slot-header">
          <div class="slot-title"><span class="player-indicator"></span>Player \${i + 1}</div>
          <div class="slot-metrics">
            <div class="metric"><span id="pps-\${i}">0</span> PPS</div>
            <div class="metric"><span id="rtt-\${i}">0.0</span> ms</div>
          </div>
        </div>
        <div class="gamepad-visual">
          <div class="triggers-row">
            <div><span>LT: <strong id="lt-val-\${i}">0</strong></span><div class="trigger-bar-bg"><div id="lt-bar-\${i}" class="trigger-bar-fill"></div></div></div>
            <div><span>RT: <strong id="rt-val-\${i}">0</strong></span><div class="trigger-bar-bg"><div id="rt-bar-\${i}" class="trigger-bar-fill"></div></div></div>
          </div>
          <div class="sticks-row">
            <div class="stick-box"><div>LS (LX, LY)</div><div class="stick-circle"><div id="ls-thumb-\${i}" class="stick-thumb"></div></div><div id="ls-coord-\${i}">0, 0</div></div>
            <div class="stick-box"><div>RS (RX, RY)</div><div class="stick-circle"><div id="rs-thumb-\${i}" class="stick-thumb"></div></div><div id="rs-coord-\${i}">0, 0</div></div>
          </div>
          <div class="buttons-grid" id="btns-\${i}">
            <span class="btn-chip" data-btn="a">A</span>
            <span class="btn-chip" data-btn="b">B</span>
            <span class="btn-chip" data-btn="x">X</span>
            <span class="btn-chip" data-btn="y">Y</span>
            <span class="btn-chip" data-btn="shoulder_l">LB</span>
            <span class="btn-chip" data-btn="shoulder_r">RB</span>
            <span class="btn-chip" data-btn="dpad_up">UP</span>
            <span class="btn-chip" data-btn="dpad_down">DOWN</span>
            <span class="btn-chip" data-btn="dpad_left">LEFT</span>
            <span class="btn-chip" data-btn="dpad_right">RIGHT</span>
            <span class="btn-chip" data-btn="start">START</span>
            <span class="btn-chip" data-btn="back">BACK</span>
            <span class="btn-chip" data-btn="guide">GUIDE</span>
          </div>
        </div>
        <button class="disconnect-btn" onclick="disconnectSlot(\${i})">Disconnect Slot</button>
      \`;
      slotsGrid.appendChild(card);
    }
    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        document.getElementById('driverBadge').textContent = data.driver;
        document.getElementById('driverBadge').className = 'badge ' + (data.hardwareEmulated ? 'badge-vigem' : 'badge-fallback');
        document.getElementById('uptime').textContent = data.uptimeSecs + 's';
        document.getElementById('udpCount').textContent = data.totalUdpPackets;
        document.getElementById('wsCount').textContent = data.totalWsPackets;
      } catch (e) {}
    }
    setInterval(fetchStatus, 2000);
    fetchStatus();
    async function disconnectSlot(id) {
      await fetch('/api/slots/' + id + '/disconnect', { method: 'POST' });
    }
    function connectWs() {
      const ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/ws');
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'telemetry') {
            data.slots.forEach(updateSlotUI);
          }
        } catch (e) {}
      };
      ws.onclose = () => setTimeout(connectWs, 1500);
    }
    connectWs();
    function updateSlotUI(slot) {
      const i = slot.slot;
      const card = document.getElementById('slot-' + i);
      if (!card) return;
      if (slot.active) card.classList.add('active'); else card.classList.remove('active');
      document.getElementById('pps-' + i).textContent = slot.pps;
      document.getElementById('rtt-' + i).textContent = slot.rttMs.toFixed(1);
      const st = slot.state;
      document.getElementById('lt-val-' + i).textContent = st.l2;
      document.getElementById('rt-val-' + i).textContent = st.r2;
      document.getElementById('lt-bar-' + i).style.width = ((st.l2 / 255) * 100) + '%';
      document.getElementById('rt-bar-' + i).style.width = ((st.r2 / 255) * 100) + '%';
      document.getElementById('ls-thumb-' + i).style.transform = 'translate(' + ((st.lx / 128) * 22) + 'px,' + ((st.ly / 128) * 22) + 'px)';
      document.getElementById('ls-coord-' + i).textContent = st.lx + ', ' + st.ly;
      document.getElementById('rs-thumb-' + i).style.transform = 'translate(' + ((st.rx / 128) * 22) + 'px,' + ((st.ry / 128) * 22) + 'px)';
      document.getElementById('rs-coord-' + i).textContent = st.rx + ', ' + st.ry;
      document.getElementById('btns-' + i).querySelectorAll('.btn-chip').forEach(chip => {
        const key = chip.getAttribute('data-btn');
        const mask = BTN_MASKS[key];
        if (mask && (st.buttons & mask)) chip.classList.add('pressed'); else chip.classList.remove('pressed');
      });
    }
  </script>
</body>
</html>`;

export class WebServer {
  private server: http.Server;
  private wss: WebSocketServer;
  private manager: GamepadManager;
  private port: number;
  private telemetryInterval?: NodeJS.Timeout;

  private getLanIp(): string | null {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family === "IPv4" && !entry.internal) return entry.address;
      }
    }
    return null;
  }

  constructor(port: number, manager: GamepadManager) {
    this.port = port;
    this.manager = manager;

    this.server = http.createServer((req, res) => {
      // CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = req.url || "/";

      if (url === "/" || url === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(DASHBOARD_HTML);
        return;
      }

      if (url === "/api/status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ...this.manager.getDriverInfo(), lanIp: this.getLanIp() }));
        return;
      }

      if (url === "/api/slots") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(this.manager.getAllSlotsTelemetry()));
        return;
      }

      const matchSlot = url.match(/^\/api\/slots\/(\d+)(\/disconnect)?$/);
      if (matchSlot) {
        const slotId = parseInt(matchSlot[1], 10);
        if (matchSlot[2] === "/disconnect" && req.method === "POST") {
          this.manager.disconnectSlot(slotId);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        const slot = this.manager.getSlotTelemetry(slotId);
        if (slot) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(slot));
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    this.wss = new WebSocketServer({ server: this.server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      const driverInfo = this.manager.getDriverInfo();
      ws.send(JSON.stringify({
        type: "server_info",
        driver: driverInfo.driver,
        hardwareEmulated: driverInfo.hardwareEmulated,
        lanIp: this.getLanIp(),
      }));

      ws.on("message", (data) => {
        const now = Date.now();
        if (typeof data === "string" || (data instanceof Buffer && data[0] === 0x7B)) { // starts with '{'
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === "ping") {
              if (msg.client_ts && msg.slot !== undefined) {
                this.manager.updateRtt(msg.slot, Math.max(0, now - msg.client_ts));
              }
              ws.send(JSON.stringify({
                type: "pong",
                client_ts: msg.client_ts,
                server_ts: now,
              }));
            } else if (msg.type === "controller_meta") {
              this.manager.setControllerMeta(
                Number(msg.slot) || 0,
                String(msg.brand || ""),
                String(msg.name || "")
              );
            } else if (msg.type === "input") {
              const pad = new PadSlot(
                msg.buttons || 0,
                msg.l2 || 0,
                msg.r2 || 0,
                msg.lx || 0,
                msg.ly || 0,
                msg.rx || 0,
                msg.ry || 0
              );
              this.manager.handleSingleSlot(msg.slot || 0, pad, "WebSocket Client");
              if (msg.timestamp) {
                this.manager.updateRtt(msg.slot || 0, Math.max(0, now - msg.timestamp));
              }
            }
          } catch {}
        } else if (data instanceof Buffer) {
          if (data.length === PACKET_LEN) {
            try {
              const pkt = Packet.parse(data);
              this.manager.handlePacket(pkt, "WebSocket Binary");
            } catch {}
          } else if (data.length === 9) {
            const slotIdx = data.readUInt8(0);
            const pad = PadSlot.deserialize(data, 1);
            this.manager.handleSingleSlot(slotIdx, pad, "WebSocket Slot Bin");
          }
        }
      });
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`[HTTP/WS] Server running at http://localhost:${this.port}`);

        // 30 FPS telemetry stream to all WebSocket clients
        this.telemetryInterval = setInterval(() => {
          if (this.wss.clients.size === 0) return;
          const telemetryMsg = JSON.stringify({
            type: "telemetry",
            slots: this.manager.getAllSlotsTelemetry(),
            server_ts: Date.now(),
          });
          for (const client of this.wss.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(telemetryMsg);
            }
          }
        }, 33);

        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.telemetryInterval) clearInterval(this.telemetryInterval);
      this.wss.close(() => {
        this.server.close(() => resolve());
      });
    });
  }
}
