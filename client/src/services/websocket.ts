import {
  type NetworkStats,
  type PadReport,
  type PlayerSlotType,
  type SlotControllerMeta,
} from '../types/gamepad';
import {
  build36BytePacket,
  buildCompactSlotPacket,
  buildJsonReport,
  parse36BytePacket,
} from './protocol';

export type MessageHandler = (data: any) => void;
export type MonitorSlotHandler = (slot: number, report: PadReport) => void;
export type TelemetryHandler = (slots: SlotTelemetry[]) => void;

// WebSocket's own buffer cannot be recalled. Keep it small and preserve a
// bounded sequence of input transitions in our queue while it drains.
const MAX_INPUT_BUFFERED_BYTES = 144;
const MAX_QUEUED_REPORTS_PER_SLOT = 32;
const INPUT_RETRY_MS = 8;
const PING_TIMEOUT_MS = 10000;

type PendingInput =
  | { kind: 'report'; slot: PlayerSlotType; report: PadReport; useBinary: boolean; full36Byte: boolean }
  | { kind: 'release'; slot: PlayerSlotType };

export interface SlotTelemetry {
  slot: number;
  active: boolean;
  meta?: SlotControllerMeta;
  state: PadReport;
}

export interface ServerInfo {
  driver: string;
  hardwareEmulated: boolean;
  lanIp: string | null;
}

export interface DiscoveredServer {
  host: string;
  port: number;
}

export function getDiscoveredServer(): DiscoveredServer | null {
  if (typeof window === 'undefined') return null;
  const server = (window as Window & { __gamepadDeckServer?: DiscoveredServer })
    .__gamepadDeckServer;
  return server?.host && server.port ? server : null;
}

export class GamepadDeckSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private autoReconnect: boolean = true;
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  private pingInterval: any = null;

  private stats: NetworkStats = {
    status: 'disconnected',
    latencyMs: 0,
    jitterMs: 0,
    packetsPerSec: 0,
    bytesSent: 0,
    lastPongReceived: 0,
  };

  private packetsInWindow: number = 0;
  private windowTimer: any = null;
  private pingSentTime: number = 0;
  private pingToken: number | null = null;
  private sequenceCounter: number = 0;
  private inputQueue: PendingInput[] = [];
  private inputTimer: ReturnType<typeof setTimeout> | null = null;
  private droppedInputTransitions = 0;

  private onStatsChangeCallbacks: Set<(stats: NetworkStats) => void> = new Set();
  private onMonitorSlotCallbacks: Set<MonitorSlotHandler> = new Set();
  private onTelemetryCallbacks: Set<TelemetryHandler> = new Set();
  private onServerInfoCallbacks: Set<(info: ServerInfo) => void> = new Set();
  private controllerMeta = new Map<number, SlotControllerMeta>();

  constructor(customUrl?: string) {
    this.url = customUrl || this.getDefaultUrl();
  }

  public getDefaultUrl(): string {
    if (typeof window === 'undefined') {
      return 'ws://localhost:9876/ws';
    }
    const params = new URLSearchParams(window.location.search);
    const wsParam = params.get('ws');
    if (wsParam) return wsParam;

    const discovered = getDiscoveredServer();
    if (discovered) return `ws://${discovered.host}:${discovered.port}/ws`;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    // Tauri serves the UI from its internal origin; the engine listens on loopback.
    const connectHost = host === 'tauri.localhost' ? '127.0.0.1' : host;
    // The gamepad engine serves the WebSocket on 8765; Vite dev ports and
    // `vite preview` don't host it, so don't derive the port from location.
    return `${protocol}//${connectHost}:8765/ws`;
  }

  public setUrl(newUrl: string): void {
    if (this.url !== newUrl) {
      this.url = newUrl;
      this.reconnect();
    }
  }

  public getUrl(): string {
    return this.url;
  }

  public getStats(): NetworkStats {
    return { ...this.stats };
  }

  /** Number of queued reports evicted after a slot exceeded its queue limit. */
  public getDroppedInputTransitions(): number {
    return this.droppedInputTransitions;
  }

  public onStats(cb: (stats: NetworkStats) => void): () => void {
    this.onStatsChangeCallbacks.add(cb);
    cb(this.stats);
    return () => this.onStatsChangeCallbacks.delete(cb);
  }

  public onMonitorSlot(cb: MonitorSlotHandler): () => void {
    this.onMonitorSlotCallbacks.add(cb);
    return () => this.onMonitorSlotCallbacks.delete(cb);
  }

  public onTelemetry(cb: TelemetryHandler): () => void {
    this.onTelemetryCallbacks.add(cb);
    return () => this.onTelemetryCallbacks.delete(cb);
  }

  public onServerInfo(cb: (info: ServerInfo) => void): () => void {
    this.onServerInfoCallbacks.add(cb);
    return () => this.onServerInfoCallbacks.delete(cb);
  }

  /** Publish the controller identity that owns each slot. Slots missing from
   *  the map are cleared. Stored so reconnects re-announce automatically. */
  public syncControllerMeta(desired: Map<number, SlotControllerMeta>): void {
    for (let slot = 0; slot < 4; slot++) {
      const next = desired.get(slot);
      const previous = this.controllerMeta.get(slot);

      if (!next) {
        if (previous) {
          this.controllerMeta.delete(slot);
          this.sendControllerMeta(slot, undefined);
        }
        continue;
      }

      if (
        !previous ||
        previous.brand !== next.brand ||
        previous.name !== next.name
      ) {
        this.controllerMeta.set(slot, next);
        this.sendControllerMeta(slot, next);
      }
    }
  }

  private sendControllerMeta(slot: number, meta: SlotControllerMeta | undefined): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        type: 'controller_meta',
        slot,
        brand: meta?.brand ?? '',
        name: meta?.name ?? '',
      }),
    );
  }

  private notifyStats() {
    this.onStatsChangeCallbacks.forEach((cb) => cb({ ...this.stats }));
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.stats.status = 'connecting';
    this.notifyStats();

    try {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        if (this.ws !== ws) return;
        this.stats.status = 'connected';
        this.reconnectAttempts = 0;
        this.notifyStats();
        this.startPingLoop();
        this.startMetricsWindow();
        this.controllerMeta.forEach((meta, slot) => this.sendControllerMeta(slot, meta));
      };

      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        this.stats.status = 'disconnected';
        this.notifyStats();
        this.cleanupTimers();
        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        if (this.ws !== ws) return;
        this.stats.status = 'error';
        this.notifyStats();
      };

      ws.onmessage = (event) => {
        if (this.ws !== ws) return;
        this.handleMessage(event);
      };
    } catch {
      this.stats.status = 'error';
      this.notifyStats();
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.autoReconnect = false;
    this.cleanupTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.stats.status = 'disconnected';
    this.notifyStats();
  }

  public reconnect(): void {
    this.disconnect();
    this.autoReconnect = true;
    this.connect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(5000, 500 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startPingLoop(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.ws.bufferedAmount < MAX_INPUT_BUFFERED_BYTES) {
        const now = performance.now();
        if (this.pingToken !== null && now - this.pingSentTime < PING_TIMEOUT_MS) return;
        this.pingSentTime = now;
        this.pingToken = Date.now();
        const pingMsg = JSON.stringify({
          type: 'ping',
          client_ts: this.pingToken,
        });
        this.ws.send(pingMsg);
      }
    }, 1000);
  }

  private startMetricsWindow(): void {
    if (this.windowTimer) clearInterval(this.windowTimer);
    this.windowTimer = setInterval(() => {
      this.stats.packetsPerSec = this.packetsInWindow;
      this.packetsInWindow = 0;
      this.notifyStats();
    }, 1000);
  }

  private cleanupTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.windowTimer) clearInterval(this.windowTimer);
    this.pingToken = null;
    if (this.inputTimer !== null) clearTimeout(this.inputTimer);
    this.inputTimer = null;
    // Never replay a previous connection's input or releases on a new owner.
    this.inputQueue = [];
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'pong' && this.pingToken !== null && msg.client_ts === this.pingToken) {
          const now = performance.now();
          const rtt = Math.max(0, now - this.pingSentTime);
          this.pingToken = null;
          const jitter = Math.abs(rtt - this.stats.latencyMs);
          this.stats.latencyMs = Math.round(rtt * 10) / 10;
          this.stats.jitterMs = Math.round(jitter * 10) / 10;
          this.stats.lastPongReceived = Date.now();
          this.notifyStats();
        } else if (msg.type === 'server_info') {
          this.onServerInfoCallbacks.forEach((cb) =>
            cb({
              driver: String(msg.driver || ''),
              hardwareEmulated: !!msg.hardwareEmulated,
              lanIp: typeof msg.lanIp === 'string' && msg.lanIp ? msg.lanIp : null,
            }),
          );
        } else if (msg.type === 'telemetry' && Array.isArray(msg.slots)) {
          const slots: SlotTelemetry[] = msg.slots
            .map((entry: any) => ({
              slot: Number(entry.slot) || 0,
              active: !!entry.active,
              meta:
                entry.meta && (entry.meta.brand || entry.meta.name)
                  ? { brand: String(entry.meta.brand || ''), name: String(entry.meta.name || '') }
                  : undefined,
              state: {
                buttons: entry.state?.buttons ?? 0,
                l2: entry.state?.l2 ?? 0,
                r2: entry.state?.r2 ?? 0,
                lx: entry.state?.lx ?? 0,
                ly: entry.state?.ly ?? 0,
                rx: entry.state?.rx ?? 0,
                ry: entry.state?.ry ?? 0,
              },
            }))
            .filter((entry: SlotTelemetry) => entry.slot >= 0 && entry.slot < 4);

          this.onTelemetryCallbacks.forEach((cb) => cb(slots));
        } else if (msg.type === 'state_sync' && typeof msg.slot === 'number') {
          // Monitor feed from other players
          this.onMonitorSlotCallbacks.forEach((cb) =>
            cb(msg.slot, {
              buttons: msg.buttons ?? 0,
              l2: msg.l2 ?? 0,
              r2: msg.r2 ?? 0,
              lx: msg.lx ?? 0,
              ly: msg.ly ?? 0,
              rx: msg.rx ?? 0,
              ry: msg.ry ?? 0,
            })
          );
        }
      } catch {
        // Ignored
      }
    } else if (event.data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(event.data);
      if (bytes.length === 36) {
        const parsed = parse36BytePacket(bytes);
        if (parsed.valid) {
          for (let s = 0; s < 4; s++) {
            if ((parsed.activeMask & (1 << s)) !== 0) {
              this.onMonitorSlotCallbacks.forEach((cb) => cb(s, parsed.slots[s]));
            }
          }
        }
      }
    }
  }

  /**
   * Send controller report to server
   */
  public sendReport(
    slot: PlayerSlotType,
    report: PadReport,
    useBinary: boolean = true,
    full36Byte: boolean = true
  ): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    const entry: PendingInput = { kind: 'report', slot, report: { ...report }, useBinary, full36Byte };
    if (this.inputQueue.length === 0 && this.ws.bufferedAmount < MAX_INPUT_BUFFERED_BYTES) {
      return this.sendInput(entry);
    }

    // Compact stick-only changes, but never merge across a button/trigger
    // transition or a release for this slot.
    let lastForSlot: PendingInput | undefined;
    for (let i = this.inputQueue.length - 1; i >= 0; i--) {
      if (this.inputQueue[i].slot === slot) { lastForSlot = this.inputQueue[i]; break; }
    }
    if (lastForSlot?.kind === 'report' && lastForSlot.report.buttons === report.buttons &&
        lastForSlot.report.l2 === report.l2 && lastForSlot.report.r2 === report.r2 &&
        lastForSlot.useBinary === useBinary && lastForSlot.full36Byte === full36Byte) {
      lastForSlot.report = { ...report };
    } else {
      const slotReports = this.inputQueue.filter((item) => item.slot === slot && item.kind === 'report');
      if (slotReports.length >= MAX_QUEUED_REPORTS_PER_SLOT) {
        const oldest = this.inputQueue.findIndex((item) => item.slot === slot && item.kind === 'report');
        this.inputQueue.splice(oldest, 1);
        this.droppedInputTransitions++;
      }
      this.inputQueue.push(entry);
    }
    this.scheduleInputFlush();
    return true;
  }

  /** Ask the server to release only a slot owned by this connection. */
  public releaseSlot(slot: PlayerSlotType): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    // A stopped source must not replay its old input after release.
    this.inputQueue = this.inputQueue.filter((item) => item.slot !== slot);
    this.inputQueue.push({ kind: 'release', slot });
    this.flushInput();
    return true;
  }

  private scheduleInputFlush(): void {
    if (this.inputTimer !== null || this.inputQueue.length === 0) return;
    this.inputTimer = setTimeout(() => {
      this.inputTimer = null;
      this.flushInput();
    }, INPUT_RETRY_MS);
  }

  private flushInput(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    while (this.ws.bufferedAmount < MAX_INPUT_BUFFERED_BYTES && this.inputQueue.length > 0) {
      const entry = this.inputQueue[0];
      if (!this.sendInput(entry)) break;
      this.inputQueue.shift();
    }
    this.scheduleInputFlush();
  }

  private sendInput(entry: PendingInput): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    if (entry.kind === 'release') {
      try {
        this.ws.send(JSON.stringify({ type: 'release_slot', slot: entry.slot }));
        return true;
      } catch { return false; }
    }

    const { slot, report, useBinary, full36Byte } = entry;

    this.sequenceCounter = (this.sequenceCounter + 1) & 0xff;

    try {
      if (useBinary) {
        let packet: Uint8Array;
        if (full36Byte) {
          packet = build36BytePacket(slot, report, this.sequenceCounter);
        } else {
          packet = buildCompactSlotPacket(slot, report, this.sequenceCounter);
        }
        this.ws.send(packet.buffer as ArrayBuffer);
        this.stats.bytesSent += packet.byteLength;
      } else {
        const json = buildJsonReport(slot, report, Date.now());
        this.ws.send(json);
        this.stats.bytesSent += json.length;
      }

      this.packetsInWindow++;
      return true;
    } catch {
      return false;
    }
  }
}

export const socketService = new GamepadDeckSocket();
