import { describe, expect, it } from 'vitest';
import { parseJoinLink } from '../lib/join-link';

describe('parseJoinLink', () => {
  it('parses the PC join link and derives the WebSocket URL', () => {
    expect(parseJoinLink('http://192.168.1.20:8765/?slot=2&mode=touch')).toEqual({
      wsUrl: 'ws://192.168.1.20:8765/ws',
      slot: 2,
      mode: 'touch',
    });
  });

  it('keeps an explicit ws parameter', () => {
    expect(
      parseJoinLink('http://192.168.1.20:5188/?ws=ws://192.168.1.20:9000/ws&slot=1&mode=monitor'),
    ).toEqual({
      wsUrl: 'ws://192.168.1.20:9000/ws',
      slot: 1,
      mode: 'monitor',
    });
  });

  it('falls back to slot 0 for invalid slots', () => {
    expect(parseJoinLink('http://10.0.0.5:8765/?slot=9')?.slot).toBe(0);
  });

  it('does not switch mode when the link omits it', () => {
    expect(parseJoinLink('http://10.0.0.5:8765/?slot=3')?.mode).toBeNull();
  });

  it('rejects non-GamepadDeck values', () => {
    expect(parseJoinLink('hola')).toBeNull();
    expect(parseJoinLink('http://10.0.0.5:8765/?ws=http://nope')).toBeNull();
  });
});
