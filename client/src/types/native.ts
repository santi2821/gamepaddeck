export interface AndroidGamepadBridge {
  scanQr?: () => void;
  toast?: (message: string) => void;
  setOrientation?: (orientation: 'portrait' | 'landscape') => void;
  setServer?: (host: string, port: number) => void;
  setSlot?: (slot: number) => void;
  sendReport?: (
    slot: number,
    buttons: number,
    l2: number,
    r2: number,
    lx: number,
    ly: number,
    rx: number,
    ry: number,
  ) => void;
  vibrate?: (ms: number) => void;
}

declare global {
  interface Window {
    AndroidGamepad?: AndroidGamepadBridge;
    __gamepadDeckServer?: { host: string; port: number };
    onServerDiscovered?: (host: string, port: number) => void;
    onQrScanned?: (raw: string) => void;
  }
}
