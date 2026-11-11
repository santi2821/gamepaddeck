import { describe, it, expect } from 'vitest';
import { applyDeadzone, clamp } from '../services/protocol';

describe('Virtual Thumbstick Math & Deadzone Processing', () => {
  it('suppresses small perturbations within deadzone threshold', () => {
    // 0.12 deadzone
    const center = applyDeadzone(0.05, 0.05, 0.12);
    expect(center.x).toBe(0);
    expect(center.y).toBe(0);
    expect(center.magnitude).toBe(0);

    const slightTilt = applyDeadzone(0.1, 0.0, 0.12);
    expect(slightTilt.x).toBe(0);
    expect(slightTilt.y).toBe(0);
  });

  it('smoothly scales inputs exceeding deadzone without jarring jump', () => {
    const deadzone = 0.2;
    // Right above deadzone: 0.25 on X
    const res = applyDeadzone(0.25, 0.0, deadzone);
    expect(res.x).toBeGreaterThan(0);
    expect(res.x).toBeLessThan(0.1); // Smooth transition close to 0
    expect(res.y).toBe(0);

    // Full deflection (1.0)
    const full = applyDeadzone(1.0, 0.0, deadzone);
    expect(full.x).toBeCloseTo(1.0, 3);
    expect(full.magnitude).toBeCloseTo(1.0, 3);
  });

  it('clamps diagonal deflections to unit circle (magnitude <= 1.0)', () => {
    // If a corner gives x=1.0, y=1.0, magnitude is sqrt(2) ~= 1.414
    const corner = applyDeadzone(1.0, 1.0, 0.1);
    expect(corner.magnitude).toBeLessThanOrEqual(1.0);
    expect(Math.hypot(corner.x, corner.y)).toBeLessThanOrEqual(1.0001);
  });

  it('preserves deflection angle perfectly', () => {
    const inputX = 0.6;
    const inputY = 0.8; // Angle: atan2(0.8, 0.6) = 0.927 rad
    const filtered = applyDeadzone(inputX, inputY, 0.15);

    const origAngle = Math.atan2(inputY, inputX);
    const filterAngle = Math.atan2(filtered.y, filtered.x);
    expect(filterAngle).toBeCloseTo(origAngle, 4);
  });

  it('safely clamps values to range', () => {
    expect(clamp(-5, -1, 1)).toBe(-1);
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(0.5, -1, 1)).toBe(0.5);
  });
});
