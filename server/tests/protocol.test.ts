import { test, describe } from "node:test";
import assert from "node:assert";
import {
  MAGIC,
  PACKET_LEN,
  PadSlot,
  Packet,
  BTN_A,
  BTN_B,
  BTN_X,
  BTN_Y,
  BTN_START,
  BTN_BACK,
  BTN_DPAD_UP,
  BTN_SHOULDER_R,
} from "../src/protocol.js";

describe("Protocol Unit Tests", () => {
  test("exact packet length must be 36 bytes", () => {
    const pkt = new Packet();
    const buf = pkt.serialize();
    assert.strictEqual(buf.length, PACKET_LEN);
    assert.strictEqual(buf.length, 36);
  });

  test("magic byte validation", () => {
    const buf = Buffer.alloc(36);
    buf.writeUInt8(MAGIC, 0);
    const pkt = Packet.parse(buf);
    assert.ok(pkt);

    buf.writeUInt8(0x55, 0);
    assert.throws(() => Packet.parse(buf), /Invalid magic byte/);
  });

  test("invalid packet length raises error", () => {
    const short = Buffer.alloc(35);
    short.writeUInt8(MAGIC, 0);
    assert.throws(() => Packet.parse(short), /Invalid packet length: 35/);

    const long = Buffer.alloc(37);
    long.writeUInt8(MAGIC, 0);
    assert.throws(() => Packet.parse(long), /Invalid packet length: 37/);
  });

  test("roundtrip all 4 slots and button bitmasks", () => {
    const pkt = new Packet(42, 0x0f, 0x01);

    // Slot 0
    pkt.slots[0].buttons = BTN_A | BTN_SHOULDER_R | BTN_DPAD_UP;
    pkt.slots[0].l2 = 255;
    pkt.slots[0].r2 = 128;
    pkt.slots[0].lx = -128;
    pkt.slots[0].ly = 127;
    pkt.slots[0].rx = -50;
    pkt.slots[0].ry = 50;

    // Slot 1
    pkt.slots[1].buttons = BTN_B | BTN_START;
    pkt.slots[1].r2 = 255;

    // Slot 2
    pkt.slots[2].buttons = BTN_X;
    pkt.slots[2].lx = 64;
    pkt.slots[2].ly = -64;

    // Slot 3
    pkt.slots[3].buttons = BTN_Y | BTN_BACK;
    pkt.slots[3].rx = 127;
    pkt.slots[3].ry = -128;

    const serialized = pkt.serialize();
    assert.strictEqual(serialized.length, 36);
    assert.strictEqual(serialized[0], MAGIC);
    assert.strictEqual(serialized[1], 42);
    assert.strictEqual(serialized[2], 0x0f);

    const decoded = Packet.parse(serialized);
    assert.strictEqual(decoded.seq, 42);
    assert.strictEqual(decoded.activeMask, 0x0f);
    assert.strictEqual(decoded.flags, 0x01);

    // Slot 0 checks
    assert.strictEqual(decoded.slots[0].buttons, BTN_A | BTN_SHOULDER_R | BTN_DPAD_UP);
    assert.strictEqual(decoded.slots[0].l2, 255);
    assert.strictEqual(decoded.slots[0].r2, 128);
    assert.strictEqual(decoded.slots[0].lx, -128);
    assert.strictEqual(decoded.slots[0].ly, 127);
    assert.strictEqual(decoded.slots[0].rx, -50);
    assert.strictEqual(decoded.slots[0].ry, 50);

    const btnState0 = decoded.slots[0].getButtonState();
    assert.strictEqual(btnState0.a, true);
    assert.strictEqual(btnState0.shoulderR, true);
    assert.strictEqual(btnState0.dpadUp, true);
    assert.strictEqual(btnState0.b, false);
    assert.strictEqual(btnState0.x, false);

    // Slot 1 checks
    assert.strictEqual(decoded.slots[1].buttons, BTN_B | BTN_START);
    assert.strictEqual(decoded.slots[1].r2, 255);

    // Slot 2 checks
    assert.strictEqual(decoded.slots[2].buttons, BTN_X);
    assert.strictEqual(decoded.slots[2].lx, 64);
    assert.strictEqual(decoded.slots[2].ly, -64);

    // Slot 3 checks
    assert.strictEqual(decoded.slots[3].buttons, BTN_Y | BTN_BACK);
    assert.strictEqual(decoded.slots[3].rx, 127);
    assert.strictEqual(decoded.slots[3].ry, -128);
  });
});
