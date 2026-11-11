import { test, describe } from "node:test";
import assert from "node:assert";
import { GamepadManager } from "../src/gamepad-manager.js";
import { Packet, PadSlot, BTN_A, BTN_B, BTN_X } from "../src/protocol.js";

describe("GamepadManager Unit Tests", () => {
  test("slot lifecycle and packet ingestion", () => {
    const mgr = new GamepadManager();
    const info = mgr.getDriverInfo();
    assert.ok(info.driver);
    assert.strictEqual(info.totalUdpPackets, 0);

    const pkt = new Packet(1, 0x01, 0); // Slot 0 active
    pkt.slots[0].buttons = BTN_A | BTN_B;
    pkt.slots[0].l2 = 250;

    mgr.handlePacket(pkt, "127.0.0.1:9876");

    const slot0 = mgr.getSlotTelemetry(0);
    assert.ok(slot0);
    assert.strictEqual(slot0.active, true);
    assert.strictEqual(slot0.state.buttons, BTN_A | BTN_B);
    assert.strictEqual(slot0.state.l2, 250);
    assert.strictEqual(slot0.packetsReceived, 1);
    assert.strictEqual(slot0.source, "127.0.0.1:9876");

    const slot1 = mgr.getSlotTelemetry(1);
    assert.ok(slot1);
    assert.strictEqual(slot1.active, false);
    assert.strictEqual(slot1.packetsReceived, 0);

    // Disconnect slot 0
    mgr.disconnectSlot(0);
    const slot0After = mgr.getSlotTelemetry(0);
    assert.strictEqual(slot0After?.active, false);
    assert.strictEqual(slot0After?.state.buttons, 0);
  });

  test("single slot input via WebSocket", () => {
    const mgr = new GamepadManager();
    const pad = new PadSlot(BTN_X, 0, 255, 100, -100, 0, 0);

    mgr.handleSingleSlot(2, pad, "WebSocket Client");
    const slot2 = mgr.getSlotTelemetry(2);
    assert.ok(slot2);
    assert.strictEqual(slot2.active, true);
    assert.strictEqual(slot2.state.buttons, BTN_X);
    assert.strictEqual(slot2.state.r2, 255);
    assert.strictEqual(slot2.state.lx, 100);
    assert.strictEqual(slot2.state.ly, -100);

    mgr.updateRtt(2, 5.2);
    assert.strictEqual(mgr.getSlotTelemetry(2)?.rttMs, 5.2);
  });

  test("controller metadata is announced and cleared per slot", () => {
    const mgr = new GamepadManager();
    mgr.setControllerMeta(1, "sony", "Sony DualSense (PS5)");

    assert.deepStrictEqual(mgr.getSlotTelemetry(1)?.meta, {
      brand: "sony",
      name: "Sony DualSense (PS5)",
    });
    assert.strictEqual(mgr.getSlotTelemetry(0)?.meta, undefined);

    mgr.setControllerMeta(1, "", "");
    assert.strictEqual(mgr.getSlotTelemetry(1)?.meta, undefined);
  });
});
