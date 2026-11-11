import { afterEach, describe, expect, it, vi } from 'vitest';
import { startInputPolling, sameGamepadState, samePadReport, sameReports } from '../lib/input-polling';
import { createEmptyNormalizedState, createEmptyPadReport } from '../services/protocol';

afterEach(() => vi.useRealTimers());
describe('input polling and presentation', () => {
  it('polls every 8ms independently of animation frames and stops cleanly', () => {
    vi.useFakeTimers();
    const poll = vi.fn();
    const stop = startInputPolling(poll);
    vi.advanceTimersByTime(4000);
    expect(poll).toHaveBeenCalledTimes(500);
    stop();
    vi.advanceTimersByTime(100);
    expect(poll).toHaveBeenCalledTimes(500);
  });
  it('detects every visible controller field', () => {
    const state = createEmptyNormalizedState();
    expect(sameGamepadState(state, { ...state })).toBe(true);
    for (const key of Object.keys(state) as (keyof typeof state)[]) {
      const changed = { ...state, [key]: typeof state[key] === 'boolean' ? !state[key] : 0.5 };
      expect(sameGamepadState(state, changed), key).toBe(false);
    }
  });
  it('detects changes and removals in each telemetry slot', () => {
    const report = createEmptyPadReport();
    expect(samePadReport(report, {...report})).toBe(true);
    for (const key of Object.keys(report) as (keyof typeof report)[]) {
      expect(samePadReport(report, {...report, [key]: 1}), key).toBe(false);
    }
    expect(sameReports({0: report}, {0: {...report}})).toBe(true);
    expect(sameReports({0: report}, {})).toBe(false);
    expect(sameReports({0: report}, {0: report, 1: report})).toBe(false);
  });
});
