import type { ClientAppMode } from '../types/gamepad';

/** Tauri's monitor observes the local server; phones can send from monitor. */
export function sendsPhysicalInput(mode: ClientAppMode, isDesktop: boolean): boolean {
  return mode !== 'touch' && !(isDesktop && mode === 'monitor');
}

/** Tauri's desktop WebView shares the host with the embedded ViGEm server. */
export function isTauriDesktop(scope: object | undefined): boolean {
  return scope !== undefined && '__TAURI_INTERNALS__' in scope;
}

/** XInput identities cannot distinguish a physical Xbox from a ViGEm target. */
export function enumerateCaptureGamepads<T extends { id: string }>(isDesktop: boolean, enumerate: () => T[]): T[] {
  const pads = enumerate();
  if (!isDesktop) return pads;
  return pads.filter(({ id }) => {
    if (/\b(?:xinput|xbox|x-box|microsoft)\b|\bvendor:\s*045e\b|\b045e[-:]\w{4}\b/i.test(id)) return false;
    return /\b(?:sony|playstation|dualshock|dualsense|nintendo|switch|joy-con)\b|\bvendor:\s*(?:054c|057e)\b|\b(?:054c|057e)[-:]\w{4}\b/i.test(id);
  });
}

export function captureGamepads(enumerate: () => Gamepad[]): Gamepad[] {
  return enumerateCaptureGamepads(
    isTauriDesktop(typeof window === 'undefined' ? undefined : window),
    enumerate,
  );
}
