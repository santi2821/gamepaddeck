import type { ClientAppMode, PlayerSlotType } from '../types/gamepad';

export interface ParsedJoinLink {
  wsUrl: string;
  slot: PlayerSlotType;
  mode: ClientAppMode | null;
}

export function parseJoinLink(raw: string): ParsedJoinLink | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (!url.hostname) return null;

  const params = url.searchParams;
  const wsParam = params.get('ws')?.trim();
  const wsUrl = wsParam || `ws://${url.hostname}:8765/ws`;
  if (!/^wss?:\/\//i.test(wsUrl)) return null;

  const rawSlot = Number.parseInt(params.get('slot') || '0', 10);
  const slot = (rawSlot >= 0 && rawSlot <= 3 ? rawSlot : 0) as PlayerSlotType;
  const modeParam = params.get('mode');

  return {
    wsUrl,
    slot,
    mode: modeParam === 'touch' || modeParam === 'monitor' || modeParam === 'physical'
      ? (modeParam as ClientAppMode)
      : null,
  };
}
