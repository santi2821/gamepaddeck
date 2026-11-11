import { describe, expect, it, vi } from 'vitest';
import { enumerateCaptureGamepads, isTauriDesktop } from '../lib/capture-origin';

const pad = (id: string, index: number) => ({ id, index } as Gamepad);

describe('capture origin', () => {
  it('recognizes Tauri independently of the Android bridge', () => {
    expect(isTauriDesktop({ __TAURI_INTERNALS__: {} })).toBe(true);
    expect(isTauriDesktop({ AndroidGamepad: { scanQr() {} } })).toBe(false);
    expect(isTauriDesktop({})).toBe(false);
  });

  it('keeps the PS4 source after its virtual Xbox appears', () => {
    const ps4 = pad('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 05c4)', 0);
    const virtualXbox = pad('Xbox 360 Controller (XInput STANDARD GAMEPAD)', 1);
    const enumerate = vi.fn().mockReturnValueOnce([ps4]).mockReturnValueOnce([ps4, virtualXbox]);
    expect(enumerateCaptureGamepads(true, enumerate)).toEqual([ps4]);
    expect(enumerateCaptureGamepads(true, enumerate)).toEqual([ps4]);
  });

  it('keeps identifiable Sony and Nintendo but rejects XInput and unknown devices', () => {
    const sony = pad('Sony DualSense', 0);
    const nintendo = pad('Pro Controller (Vendor: 057e Product: 2009)', 1);
    const ambiguous = pad('Sony controller (XInput STANDARD GAMEPAD)', 2);
    const xbox = pad('Xbox Wireless Controller', 3);
    const unknown = pad('Generic Gamepad', 4);
    expect(enumerateCaptureGamepads(true, () => [sony, nintendo, ambiguous, xbox, unknown]))
      .toEqual([sony, nintendo]);
  });

  it('preserves all gamepads for Android and browser clients', () => {
    const pads = [pad('Xbox Wireless Controller', 0), pad('Wireless Controller (Vendor: 054c Product: 05c4)', 1)];
    const enumerate = vi.fn(() => pads);
    expect(enumerateCaptureGamepads(false, enumerate)).toBe(pads);
    expect(enumerate).toHaveBeenCalledOnce();
  });
});
