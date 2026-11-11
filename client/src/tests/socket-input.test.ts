import { afterEach, describe, expect, it, vi } from 'vitest';
import { GamepadDeckSocket } from '../services/websocket';
import { createEmptyPadReport, parse36BytePacket } from '../services/protocol';
import { sendsPhysicalInput } from '../lib/capture-origin';

class FakeSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = 1;
  bufferedAmount = 0;
  binaryType = '';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn();
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('input transport', () => {
  it('sends four controllers at 125 Hz without backlog when 144 bytes drain every 8 ms', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    let bytes = 0;
    ws.send.mockImplementation((data: ArrayBuffer) => {
      bytes += data.byteLength;
      ws.bufferedAmount += data.byteLength;
    });
    for (let tick = 0; tick < 125; tick++) {
      for (const slot of [0, 1, 2, 3] as const) {
        expect(client.sendReport(slot, { ...createEmptyPadReport(), buttons: tick % 2 })).toBe(true);
      }
      expect(ws.bufferedAmount).toBe(144);
      expect(ws.send).toHaveBeenCalledTimes((tick + 1) * 4);
      ws.bufferedAmount = 0;
      vi.advanceTimersByTime(8);
    }
    expect(ws.send).toHaveBeenCalledTimes(500);
    expect(bytes).toBe(18000);
    expect(client.getDroppedInputTransitions()).toBe(0);
    client.disconnect();
  });

  it('drains four queued controllers in one retry when the socket has capacity', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.bufferedAmount = 144;
    for (const slot of [0, 1, 2, 3] as const) client.sendReport(slot, { ...createEmptyPadReport(), buttons: slot + 1 });
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(8);
    expect(ws.send).toHaveBeenCalledTimes(4);
    expect(ws.send.mock.calls.map(([data]) => parse36BytePacket(new Uint8Array(data as ArrayBuffer)).activeMask)).toEqual([1, 2, 4, 8]);
    client.disconnect();
  });

  it('accepts a pong delayed beyond the next ping interval', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.onopen?.();
    vi.advanceTimersByTime(1000);
    const ping = JSON.parse(ws.send.mock.calls[0][0] as string);
    vi.advanceTimersByTime(1500);
    ws.onmessage?.({ data: JSON.stringify({ type: 'pong', client_ts: ping.client_ts }) });
    expect(client.getStats().latencyMs).toBe(1500);
    client.disconnect();
  });

  it('stops draining at the buffer threshold and resumes without reordering', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.bufferedAmount = 144;
    for (let i = 0; i < 8; i++) client.sendReport(0, { ...createEmptyPadReport(), buttons: i % 2 });
    ws.send.mockImplementation((data: ArrayBuffer) => { ws.bufferedAmount += data.byteLength; });
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(8);
    expect(ws.bufferedAmount).toBe(144);
    expect(ws.send).toHaveBeenCalledTimes(4);
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(8);
    expect(ws.send.mock.calls.map(([data]) => parse36BytePacket(new Uint8Array(data as ArrayBuffer)).slots[0].buttons)).toEqual([0, 1, 0, 1, 0, 1, 0, 1]);
    client.disconnect();
  });

  it('retries a queued report after send throws without spinning', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.bufferedAmount = 144;
    client.sendReport(0, { ...createEmptyPadReport(), buttons: 1 });
    ws.bufferedAmount = 0;
    ws.send.mockImplementationOnce(() => { throw new Error('send failed'); });
    vi.advanceTimersByTime(8);
    expect(ws.send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(8);
    expect(ws.send).toHaveBeenCalledTimes(2);
    expect(parse36BytePacket(new Uint8Array(ws.send.mock.calls[1][0] as ArrayBuffer)).slots[0].buttons).toBe(1);
    client.disconnect();
  });

  it('sends another ping after an unanswered ping expires', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.onopen?.();
    vi.advanceTimersByTime(10000);
    expect(ws.send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(ws.send).toHaveBeenCalledTimes(2);
    client.disconnect();
  });

  it('replays a complete short button and trigger press during congestion in order', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    const neutral = createEmptyPadReport();
    ws.bufferedAmount = 4096;
    client.sendReport(0, neutral);
    client.sendReport(0, { ...neutral, buttons: 0x4000, l2: 200, lx: 10 });
    client.sendReport(0, { ...neutral, buttons: 0x4000, l2: 200, lx: 40 });
    client.sendReport(0, { ...neutral, lx: 80 });
    expect(ws.send).not.toHaveBeenCalled();
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(24);
    const reports = ws.send.mock.calls.map(([data]) => parse36BytePacket(new Uint8Array(data as ArrayBuffer)).slots[0]);
    expect(reports.map(({ buttons, l2, lx }) => [buttons, l2, lx])).toEqual([
      [0, 0, 0], [0x4000, 200, 40], [0, 0, 80],
    ]);
    client.disconnect();
  });

  it('keeps a press and release in order until the buffer recovers', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.bufferedAmount = 4096;
    expect(client.sendReport(0, { ...createEmptyPadReport(), buttons: 0x4000 })).toBe(true);
    expect(client.sendReport(0, createEmptyPadReport())).toBe(true);
    expect(ws.send).not.toHaveBeenCalled();
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(16);
    expect(ws.send.mock.calls.map(([data]) => parse36BytePacket(new Uint8Array(data as ArrayBuffer)).slots[0].buttons)).toEqual([0x4000, 0]);
    client.disconnect();
  });

  it('bounds a stalled 180 Hz stream to four binary reports', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.send.mockImplementation((data: ArrayBuffer) => { ws.bufferedAmount += data.byteLength; });
    let sent = 0;
    for (let frame = 0; frame < 180; frame++) {
      if (client.sendReport(0, createEmptyPadReport())) sent++;
    }
    expect(sent).toBe(180);
    expect(ws.send).toHaveBeenCalledTimes(4);
    expect(ws.bufferedAmount).toBe(144);
    ws.bufferedAmount = 0;
    expect(client.sendReport(0, { ...createEmptyPadReport(), buttons: 0x4000 })).toBe(true);
    vi.advanceTimersByTime(16);
    const latest = ws.send.mock.calls.at(-1)?.[0] as ArrayBuffer;
    expect(parse36BytePacket(new Uint8Array(latest)).slots[0].buttons).toBe(0x4000);
    client.disconnect();
  });

  it('bounds each slot independently and reports transition overflow', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.bufferedAmount = 4096;
    for (let i = 0; i < 40; i++) client.sendReport(0, { ...createEmptyPadReport(), buttons: i % 2 });
    client.sendReport(1, { ...createEmptyPadReport(), buttons: 4 });
    expect(client.getDroppedInputTransitions()).toBe(8);
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(300);
    const packets = ws.send.mock.calls.map(([data]) => parse36BytePacket(new Uint8Array(data as ArrayBuffer)));
    expect(packets).toHaveLength(33);
    expect(packets.at(-2)?.slots[0].buttons).toBe(1);
    expect(packets.at(-1)?.slots[1].buttons).toBe(4);
    client.disconnect();
  });

  it('cancels a stopped slot’s pending input, retains other slots, and sends an ownership-checked release', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.bufferedAmount = 4096;
    client.sendReport(0, { ...createEmptyPadReport(), buttons: 1 });
    client.sendReport(1, { ...createEmptyPadReport(), buttons: 2 });
    expect(client.releaseSlot(0)).toBe(true);
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(16);
    expect(parse36BytePacket(new Uint8Array(ws.send.mock.calls[0][0] as ArrayBuffer)).slots[1].buttons).toBe(2);
    expect(JSON.parse(ws.send.mock.calls[1][0] as string)).toEqual({ type: 'release_slot', slot: 0 });
    client.disconnect();
  });

  it('does not replay pending input or releases after reconnect', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const old = (client as unknown as { ws: FakeSocket }).ws;
    old.bufferedAmount = 4096;
    client.sendReport(0, { ...createEmptyPadReport(), buttons: 1 });
    client.releaseSlot(1);
    client.reconnect();
    const current = (client as unknown as { ws: FakeSocket }).ws;
    vi.advanceTimersByTime(32);
    expect(current.send).not.toHaveBeenCalled();
    client.disconnect();
  });

  it('releases before new input when the same slot is reacquired during congestion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.bufferedAmount = 4096;
    client.sendReport(0, { ...createEmptyPadReport(), buttons: 1 });
    client.releaseSlot(0);
    client.sendReport(0, { ...createEmptyPadReport(), buttons: 2 });
    ws.bufferedAmount = 0;
    vi.advanceTimersByTime(16);
    expect(JSON.parse(ws.send.mock.calls[0][0] as string)).toEqual({ type: 'release_slot', slot: 0 });
    expect(parse36BytePacket(new Uint8Array(ws.send.mock.calls[1][0] as ArrayBuffer)).slots[0].buttons).toBe(2);
    client.disconnect();
  });

  it('matches pongs to the ping that was sent', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const ws = (client as unknown as { ws: FakeSocket }).ws;
    ws.onopen?.();
    vi.advanceTimersByTime(1000);
    const ping = JSON.parse(ws.send.mock.calls[0][0] as string);
    expect(ping.client_ts).toBeTypeOf('number');
    ws.onmessage?.({ data: JSON.stringify({ type: 'pong', client_ts: ping.client_ts + 1 }) });
    expect(client.getStats().lastPongReceived).toBe(0);
    ws.onmessage?.({ data: JSON.stringify({ type: 'pong', client_ts: ping.client_ts }) });
    expect(client.getStats().lastPongReceived).toBeGreaterThan(0);
    client.disconnect();
  });

  it('keeps the new connection and its timers when the old socket closes late', () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
    const client = new GamepadDeckSocket('ws://test');
    client.connect();
    const old = (client as unknown as { ws: FakeSocket }).ws;
    old.onopen?.();
    client.reconnect();
    const current = (client as unknown as { ws: FakeSocket }).ws;
    current.onopen?.();
    old.onclose?.();
    expect(client.getStats().status).toBe('connected');
    vi.advanceTimersByTime(1000);
    expect(current.send).toHaveBeenCalledOnce();
    client.disconnect();
  });

  it('does not let a monitoring client overwrite another client holding X', () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const phone = new GamepadDeckSocket('ws://test');
    const pc = new GamepadDeckSocket('ws://test');
    phone.connect();
    pc.connect();
    const phoneWs = (phone as unknown as { ws: FakeSocket }).ws;
    const pcWs = (pc as unknown as { ws: FakeSocket }).ws;
    for (let frame = 0; frame < 180; frame++) {
      phone.sendReport(0, { ...createEmptyPadReport(), buttons: 0x4000 });
      if (sendsPhysicalInput('monitor', true)) pc.sendReport(0, createEmptyPadReport());
    }
    expect(pcWs.send).not.toHaveBeenCalled();
    expect(phoneWs.send).toHaveBeenCalledTimes(180);
    expect(phoneWs.send.mock.calls.every(([packet]) =>
      parse36BytePacket(new Uint8Array(packet as ArrayBuffer)).slots[0].buttons === 0x4000,
    )).toBe(true);
    expect(sendsPhysicalInput('physical', true)).toBe(true);
    expect(sendsPhysicalInput('monitor', false)).toBe(true);
    expect(sendsPhysicalInput('physical', false)).toBe(true);
    expect(sendsPhysicalInput('touch', false)).toBe(false);
    phone.disconnect();
    pc.disconnect();
  });
});
