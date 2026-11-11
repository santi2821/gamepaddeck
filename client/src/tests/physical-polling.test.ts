import { afterEach, describe, expect, it, vi } from 'vitest';
import { pollPhysicalPads, startInputPolling } from '../lib/input-polling';
import { gamepadSlotKey } from '../lib/slot-map';
import { GamepadDeckSocket } from '../services/websocket';
import { parse36BytePacket } from '../services/protocol';
import type { PlayerSlotType } from '../types/gamepad';

class FakeSocket {
  static OPEN = 1; static CONNECTING = 0;
  readyState = 1; bufferedAmount = 0; binaryType = '';
  send = vi.fn(); close = vi.fn();
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('physical input pipeline', () => {
  it.each([1, 2, 3, 4])('captures and sends %i pads independently of a 24 Hz display', (count) => {
    vi.useFakeTimers(); vi.stubGlobal('WebSocket', FakeSocket);
    const socket = new GamepadDeckSocket('ws://test'); socket.connect();
    const ws = (socket as unknown as {ws: FakeSocket}).ws;
    const pads = Array.from({length: count}, (_, index) => ({
      id: 'same controller', index, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({length: 17}, () => ({pressed: false, touched: false, value: 0})),
    } as unknown as Gamepad));
    const map = Object.fromEntries(pads.map((pad, index) => [gamepadSlotKey(pad), index as PlayerSlotType]));
    const poll = () => pollPhysicalPads(pads, map, 0.12, false, (slot, report) => socket.sendReport(slot, report, true, true));
    const stop = startInputPolling(poll);
    vi.advanceTimersByTime(8);
    (pads[0].buttons as GamepadButton[])[0] = {pressed: true, touched: true, value: 1};
    vi.advanceTimersByTime(8);
    (pads[0].buttons as GamepadButton[])[0] = {pressed: false, touched: false, value: 0};
    vi.advanceTimersByTime(3984);
    stop();
    expect(ws.send).toHaveBeenCalledTimes(count * 500);
    const packets = ws.send.mock.calls.map(([data]) => parse36BytePacket(new Uint8Array(data as ArrayBuffer)));
    expect(packets[count].slots[0].buttons).toBe(0x1000);
    expect(packets[count * 2].slots[0].buttons).toBe(0);
    expect(pollPhysicalPads(pads.slice(0, -1), map, 0.12, false, () => {})).toEqual(new Set(Array.from({length: count - 1}, (_, i) => i)));
    socket.disconnect();
  });
});
