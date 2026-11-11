import { test, describe } from "node:test";
import assert from "node:assert";
import { WebSocket } from "ws";
import { GamepadManager } from "../src/gamepad-manager.js";
import { WebServer } from "../src/web-server.js";
import { BTN_B, BTN_Y } from "../src/protocol.js";

describe("WebSocket & HTTP Integration Tests", () => {
  test("handles ping/pong and input messages over WebSocket", async () => {
    const manager = new GamepadManager();
    const serverPort = 18765;
    const server = new WebServer(serverPort, manager);
    await server.start();

    const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`);

    await new Promise<void>((resolve) => {
      ws.on("open", () => resolve());
    });

    // 1. Send Ping
    let gotPong = false;
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "pong") {
          assert.strictEqual(msg.client_ts, 1700000000000);
          assert.ok(msg.server_ts);
          gotPong = true;
        }
      } catch {}
    });

    ws.send(JSON.stringify({
      type: "ping",
      client_ts: 1700000000000,
      slot: 1,
    }));

    // 2. Send Input
    ws.send(JSON.stringify({
      type: "input",
      slot: 1,
      buttons: BTN_B | BTN_Y,
      l2: 0,
      r2: 255,
      lx: 80,
      ly: -80,
      rx: 0,
      ry: 0,
      timestamp: 1700000000000,
    }));

    await new Promise((r) => setTimeout(r, 100));
    assert.strictEqual(gotPong, true);

    const slot1 = manager.getSlotTelemetry(1);
    assert.ok(slot1);
    assert.strictEqual(slot1.active, true);
    assert.strictEqual(slot1.state.buttons, BTN_B | BTN_Y);
    assert.strictEqual(slot1.state.r2, 255);
    assert.strictEqual(slot1.state.lx, 80);
    assert.strictEqual(slot1.state.ly, -80);

    ws.close();
    await server.stop();
  });
});
