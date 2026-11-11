import { PadSlot, Packet, NUM_SLOTS } from "./protocol.js";

export interface ControllerMeta {
  brand: string;
  name: string;
}

export interface SlotTelemetry {
  slot: number;
  active: boolean;
  source?: string;
  lastSeenMs: number;
  packetsReceived: number;
  pps: number;
  rttMs: number;
  state: PadSlot;
  meta?: ControllerMeta;
}

interface SlotInternal {
  active: boolean;
  source?: string;
  meta?: ControllerMeta;
  lastSeenMs: number;
  packetsReceived: number;
  packetsWindow: number;
  lastWindowTime: number;
  pps: number;
  rttMs: number;
  state: PadSlot;
}

export class GamepadManager {
  private slots: SlotInternal[] = [];
  private totalUdpPackets = 0;
  private totalWsPackets = 0;
  private startTime = Date.now();
  private driverName = "Fallback (In-Memory / Web Virtual)";
  private hardwareEmulated = false;

  constructor() {
    for (let i = 0; i < NUM_SLOTS; i++) {
      this.slots.push({
        active: false,
        lastSeenMs: 0,
        packetsReceived: 0,
        packetsWindow: 0,
        lastWindowTime: Date.now(),
        pps: 0,
        rttMs: 0,
        state: new PadSlot(),
      });
    }

    // Attempt optional ViGEm integration
    this.initViGEm();
  }

  private initViGEm() {
    try {
      // In Node.js, if native vigem addon is installed (e.g. vigem-client), initialize it.
      // If not, keep clean fallback mode.
      this.driverName = "Fallback (In-Memory / Web Virtual)";
      this.hardwareEmulated = false;
    } catch {
      this.driverName = "Fallback (In-Memory / Web Virtual)";
      this.hardwareEmulated = false;
    }
  }

  getDriverInfo() {
    return {
      driver: this.driverName,
      hardwareEmulated: this.hardwareEmulated,
      uptimeSecs: Math.floor((Date.now() - this.startTime) / 1000),
      totalUdpPackets: this.totalUdpPackets,
      totalWsPackets: this.totalWsPackets,
    };
  }

  handlePacket(packet: Packet, source?: string) {
    this.totalUdpPackets++;
    const now = Date.now();

    for (let i = 0; i < NUM_SLOTS; i++) {
      if (packet.isSlotActive(i)) {
        const slot = this.slots[i];
        slot.active = true;
        slot.lastSeenMs = now;
        slot.packetsReceived++;
        slot.packetsWindow++;
        slot.state = packet.slots[i];
        if (source) slot.source = source;
      }
    }
  }

  handleSingleSlot(slotIdx: number, padState: PadSlot, source?: string) {
    if (slotIdx < 0 || slotIdx >= NUM_SLOTS) return;
    this.totalWsPackets++;
    const now = Date.now();
    const slot = this.slots[slotIdx];

    slot.active = true;
    slot.lastSeenMs = now;
    slot.packetsReceived++;
    slot.packetsWindow++;
    slot.state = padState;
    if (source) slot.source = source;
  }

  updateRtt(slotIdx: number, rttMs: number) {
    if (slotIdx >= 0 && slotIdx < NUM_SLOTS) {
      this.slots[slotIdx].rttMs = rttMs;
    }
  }

  setControllerMeta(slotIdx: number, brand: string, name: string) {
    if (slotIdx < 0 || slotIdx >= NUM_SLOTS) return;
    const slot = this.slots[slotIdx];
    const nextBrand = brand.trim().slice(0, 32);
    const nextName = name.trim().slice(0, 96);

    if (!nextBrand && !nextName) {
      delete slot.meta;
      return;
    }

    slot.meta = { brand: nextBrand, name: nextName };
  }

  disconnectSlot(slotIdx: number) {
    if (slotIdx >= 0 && slotIdx < NUM_SLOTS) {
      const slot = this.slots[slotIdx];
      slot.active = false;
      slot.pps = 0;
      slot.state = new PadSlot();
      delete slot.meta;
    }
  }

  tickMetrics(inactivityTimeoutSecs = 5) {
    const now = Date.now();

    for (let i = 0; i < NUM_SLOTS; i++) {
      const slot = this.slots[i];
      const elapsedSec = (now - slot.lastWindowTime) / 1000;
      if (elapsedSec >= 0.5) {
        slot.pps = Math.round(slot.packetsWindow / elapsedSec);
        slot.packetsWindow = 0;
        slot.lastWindowTime = now;
      }

      if (slot.active && inactivityTimeoutSecs > 0) {
        if ((now - slot.lastSeenMs) / 1000 > inactivityTimeoutSecs) {
          slot.active = false;
          slot.pps = 0;
          slot.state = new PadSlot();
        }
      }
    }
  }

  getSlotTelemetry(slotIdx: number): SlotTelemetry | null {
    if (slotIdx < 0 || slotIdx >= NUM_SLOTS) return null;
    const s = this.slots[slotIdx];
    return {
      slot: slotIdx,
      active: s.active,
      source: s.source,
      lastSeenMs: s.lastSeenMs,
      packetsReceived: s.packetsReceived,
      pps: s.pps,
      rttMs: s.rttMs,
      state: s.state,
      ...(s.meta ? { meta: s.meta } : {}),
    };
  }

  getAllSlotsTelemetry(): SlotTelemetry[] {
    return this.slots.map((_, i) => this.getSlotTelemetry(i)!);
  }
}
