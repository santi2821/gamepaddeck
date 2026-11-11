import { test, describe } from "node:test";
import assert from "node:assert";
import dgram from "node:dgram";
import { GamepadManager } from "../src/gamepad-manager.js";
import { UdpServer } from "../src/udp-server.js";
import { Packet, BTN_A, BTN_SHOULDER_R } from "../src/protocol.js";

describe("UDP Server Integration Tests", () => {
  test("receives and decodes 36-byte packet over loopback", async () => {
    const manager = new GamepadManager();
    const serverPort = 19876;
    const server = new UdpServer(serverPort, manager);
    await server.start();

    const client = dgram.createSocket("udp4");
    const pkt = new Packet(77, 0x01, 0); // Slot 0 active
    pkt.slots[0].buttons = BTN_A | BTN_SHOULDER_R;
    pkt.slots[0].l2 = 240;
    pkt.slots[0].lx = -99;
    const buf = pkt.serialize();

    await new Promise<void>((resolve, reject) => {
      client.send(buf, serverPort, "127.0.0.1", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Wait a brief moment for event loop
    await new Promise((r) => setTimeout(r, 60));

    const slot0 = manager.getSlotTelemetry(0);
    assert.ok(slot0);
    assert.strictEqual(slot0.active, true);
    assert.strictEqual(slot0.state.buttons, BTN_A | BTN_SHOULDER_R);
    assert.strictEqual(slot0.state.l2, 240);
    assert.strictEqual(slot0.state.lx, -99);
    assert.strictEqual(slot0.packetsReceived, 1);

    client.close();
    await server.stop();
  });
});
