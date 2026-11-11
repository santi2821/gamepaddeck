import { describe, it, expect } from 'vitest';
import { identifyGamepad, normalizePhysicalGamepad, physicalGamepadToPadReport } from '../services/gamepad-api';
import { GamepadButtons } from '../types/gamepad';
import { build36BytePacket, parse36BytePacket } from '../services/protocol';

function createMockGamepad(id: string, overrides: Partial<Gamepad> = {}): Gamepad {
  const buttons: GamepadButton[] = Array(18)
    .fill(0)
    .map(() => ({ pressed: false, touched: false, value: 0 }));

  const axes = [0, 0, 0, 0];

  return {
    id,
    index: 0,
    connected: true,
    timestamp: 1000,
    mapping: 'standard',
    axes,
    buttons,
    vibrationActuator: null as any,
    ...overrides,
  } as Gamepad;
}

describe('HTML5 Gamepad API Detection & Normalization', () => {
  it('correctly identifies Sony DualSense (PS5)', () => {
    const gp = createMockGamepad('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)');
    const info = identifyGamepad(gp);
    expect(info.brand).toBe('sony');
    expect(info.name).toContain('DualSense');
  });

  it('correctly identifies Xbox Wireless Controller', () => {
    const gp = createMockGamepad('Xbox 360 Controller (XInput STANDARD GAMEPAD)');
    const info = identifyGamepad(gp);
    expect(info.brand).toBe('xbox');
    expect(info.name).toContain('Xbox');
  });

  it('correctly identifies Nintendo Switch Pro Controller', () => {
    const gp = createMockGamepad('Pro Controller (Vendor: 057e Product: 2009)');
    const info = identifyGamepad(gp);
    expect(info.brand).toBe('nintendo');
    expect(info.name).toContain('Switch');
  });

  it('maps standard button presses to normalized state', () => {
    const gp = createMockGamepad('Generic Gamepad');
    const mutableButtons = gp.buttons as GamepadButton[];
    const mutableAxes = gp.axes as number[];

    // Button 0 = A
    mutableButtons[0] = { pressed: true, touched: true, value: 1.0 };
    // Button 6 = LT trigger (analog 0.75)
    mutableButtons[6] = { pressed: true, touched: true, value: 0.75 };
    // Button 12 = D-Pad Up
    mutableButtons[12] = { pressed: true, touched: true, value: 1.0 };
    // Axes: LX = 0.5, LY = -0.5
    mutableAxes[0] = 0.5;
    mutableAxes[1] = -0.5;

    const norm = normalizePhysicalGamepad(gp, 0.1);
    expect(norm.a).toBe(true);
    expect(norm.b).toBe(false);
    expect(norm.dpadUp).toBe(true);
    expect(norm.lt).toBe(0.75);
    expect(norm.lx).toBeGreaterThan(0.3);
    expect(norm.ly).toBeLessThan(-0.3);
  });

  it.each([
    [0, GamepadButtons.A], [1, GamepadButtons.B],
    [2, GamepadButtons.X], [3, GamepadButtons.Y],
    [4, GamepadButtons.LB], [5, GamepadButtons.RB],
    [8, GamepadButtons.BACK], [9, GamepadButtons.START],
    [10, GamepadButtons.LS], [11, GamepadButtons.RS],
    [12, GamepadButtons.DPAD_UP], [13, GamepadButtons.DPAD_DOWN],
    [14, GamepadButtons.DPAD_LEFT], [15, GamepadButtons.DPAD_RIGHT],
    [16, GamepadButtons.GUIDE],
  ])('maps standard DualShock 4 button %i to the matching XInput bit', (index, bit) => {
    const gp = createMockGamepad('Wireless Controller (Vendor: 054c Product: 09cc)');
    (gp.buttons as GamepadButton[])[index] = { pressed: true, touched: true, value: 1 };
    const report = physicalGamepadToPadReport(gp, 0);
    expect(parse36BytePacket(build36BytePacket(0, report)).slots[0].buttons).toBe(bit);
  });

  it('preserves held PS4 sticks and analog triggers while buttons change', () => {
    const gp = createMockGamepad('Wireless Controller (Vendor: 054c Product: 09cc)', {
      axes: [-1, -1, 1, 1],
    });
    const buttons = gp.buttons as GamepadButton[];
    buttons[6] = { pressed: false, touched: true, value: 0.5 };
    buttons[7] = { pressed: true, touched: true, value: 1 };
    const before = physicalGamepadToPadReport(gp, 0);
    buttons[0] = { pressed: true, touched: true, value: 1 };
    const pressed = parse36BytePacket(build36BytePacket(0, physicalGamepadToPadReport(gp, 0))).slots[0];
    expect(pressed).toEqual({ ...before, buttons: GamepadButtons.A });
    expect(pressed.l2).toBe(128);
    expect(pressed.r2).toBe(255);
    expect(pressed.ly).toBeLessThan(0);
    expect(pressed.ry).toBeGreaterThan(0);
    buttons[0] = { pressed: false, touched: false, value: 0 };
    expect(physicalGamepadToPadReport(gp, 0)).toEqual(before);
  });
});
