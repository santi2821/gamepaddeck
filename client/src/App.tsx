import React, { useState, useEffect, useRef } from 'react';
import {
  type ClientAppMode,
  type ClientConfig,
  type NormalizedGamepadState,
  type PadReport,
  type PlayerSlotType,
  type SlotControllerMeta,
  PLAYER_SLOTS,
} from './types/gamepad';
import {
  createEmptyNormalizedState,
  normalizedToPadReport,
} from './services/protocol';
import {
  getConnectedGamepads,
  identifyGamepad,
  onGamepadConnectionChange,
  type PhysicalGamepadInfo,
} from './services/gamepad-api';
import { socketService, type ServerInfo } from './services/websocket';
import { haptics } from './services/haptics';

import { Sidebar } from './components/Layout/Sidebar';
import { MobileDock } from './components/Layout/MobileDock';
import { TouchGamepad } from './components/TouchGamepad/TouchGamepad';
import { PhysicalGamepadView } from './components/PhysicalGamepad/PhysicalGamepadView';
import { PcDashboard } from './components/PcDashboard/PcDashboard';
import { CalibrationModal } from './components/Calibration/CalibrationModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import Sheet from './components/Sheet';
import QRCode from 'qrcode';
import {
  RotateCcw,
  Maximize2,
  Minimize2,
  Settings as SettingsIcon,
  Copy,
  Check,
  Monitor as MonitorIcon,
} from 'lucide-react';
import { BTN, BTN_ICON, INPUT, pillSmall } from './lib/ui';
import { autoAssignGamepadSlots, assignGamepadSlot, gamepadSlotKey, type GamepadSlotMap } from './lib/slot-map';
import { isControllerSkin } from './lib/controller-skins';
import { isNativeShell } from './lib/platform';
import { captureGamepads, isTauriDesktop, sendsPhysicalInput } from './lib/capture-origin';
import { parseJoinLink } from './lib/join-link';
import { sameGamepadState, samePadReport, sameReports, startInputPolling, pollPhysicalPads } from './lib/input-polling';

const CONFIG_STORAGE_KEY = 'gamepaddeck_config_v1';

const isInternalServerUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname;
    return host === 'tauri.localhost' || host === 'appassets.androidplatform.net';
  } catch {
    return true;
  }
};

export const App: React.FC = () => {
  // Read initial query params
  const getInitialParams = () => {
    if (typeof window === 'undefined') return { slot: 0 as PlayerSlotType, mode: 'monitor' as ClientAppMode };
    const params = new URLSearchParams(window.location.search);
    const slotParam = parseInt(params.get('slot') || '0', 10);
    const validSlot = (slotParam >= 0 && slotParam <= 3 ? slotParam : 0) as PlayerSlotType;
    const modeParam = params.get('mode') as ClientAppMode;
    // The touch gamepad is hidden for now; monitor is the default surface.
    const defaultMode: ClientAppMode = 'monitor';
    const validMode = (['touch', 'physical', 'monitor', 'calibrate'] as ClientAppMode[]).includes(modeParam)
      ? modeParam
      : defaultMode;
    return { slot: validSlot, mode: validMode };
  };

  const initialParams = getInitialParams();
  const nativeShell = isNativeShell();

  const sanitizeSlotMap = (value: unknown): GamepadSlotMap => {
    if (!value || typeof value !== 'object') return {};
    const map: GamepadSlotMap = {};
    for (const [id, slot] of Object.entries(value as Record<string, unknown>)) {
      if (slot === 0 || slot === 1 || slot === 2 || slot === 3) {
        map[id] = slot as PlayerSlotType;
      }
    }
    return map;
  };

  // Load config from localStorage
  const loadConfig = (): ClientConfig => {
    const defaults: ClientConfig = {
      serverUrl: socketService.getDefaultUrl(),
      useBinaryProtocol: true,
      slot: initialParams.slot,
      deadzone: 0.12,
      vibrationEnabled: true,
      vibrationIntensity: 'medium',
      touchHaptics: true,
      wakeLock: true,
      invertY: false,
      monitorSkin: 'auto',
      slotSkins: ['auto', 'auto', 'auto', 'auto'],
      slotMap: {},
    };

    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ClientConfig>;
        const slotSkins = Array.from({ length: 4 }, (_, index) =>
          isControllerSkin(parsed.slotSkins?.[index]) ? parsed.slotSkins![index] : 'auto',
        );
        return {
          ...defaults,
          ...parsed,
          slot: initialParams.slot,
          serverUrl:
            parsed.serverUrl && !isInternalServerUrl(parsed.serverUrl)
              ? parsed.serverUrl
              : defaults.serverUrl,
          monitorSkin: isControllerSkin(parsed.monitorSkin) ? parsed.monitorSkin : 'auto',
          slotSkins,
          slotMap: sanitizeSlotMap(parsed.slotMap),
        };
      }
    } catch {
      // Fallback
    }

    return defaults;
  };

  const [config, setConfig] = useState<ClientConfig>(loadConfig);
  const [mode, setMode] = useState<ClientAppMode>(initialParams.mode);
  const [gameState, setGameState] = useState<NormalizedGamepadState>(createEmptyNormalizedState);
  const [networkStats, setNetworkStats] = useState(socketService.getStats());
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [slotsTelemetry, setSlotsTelemetry] = useState<Record<number, PadReport>>({});
  const [slotActive, setSlotActive] = useState<Record<number, boolean>>({});
  const [slotMeta, setSlotMeta] = useState<Record<number, SlotControllerMeta>>({});

  // Physical Gamepad State
  const [connectedGamepads, setConnectedGamepads] = useState<PhysicalGamepadInfo[]>([]);
  const [selectedGamepadIndex, setSelectedGamepadIndex] = useState<number>(0);
  const [gamepadRefreshTick, setGamepadRefreshTick] = useState<number>(0);
  const [pollingHz, setPollingHz] = useState<number>(0);

  // UI Modals & Orientation
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [qrSlot, setQrSlot] = useState<PlayerSlotType>(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);

  // Refs for high-speed transmission loop
  const gameStateRef = useRef<NormalizedGamepadState>(gameState);
  gameStateRef.current = gameState;

  const configRef = useRef<ClientConfig>(config);
  configRef.current = config;

  const modeRef = useRef<ClientAppMode>(mode);
  modeRef.current = mode;

  const selectedGamepadIndexRef = useRef(selectedGamepadIndex);
  useEffect(() => { selectedGamepadIndexRef.current = selectedGamepadIndex; }, [selectedGamepadIndex]);

  const calibrationOpenRef = useRef(isCalibrationOpen);
  calibrationOpenRef.current = isCalibrationOpen;

  const wakeLockRef = useRef<any>(null);

  // Save config changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore
    }
    haptics.setEnabled(config.vibrationEnabled);
    haptics.setIntensity(config.vibrationIntensity);
    socketService.setUrl(config.serverUrl);
  }, [config]);

  // The Android shell reports the PC found over mDNS.
  useEffect(() => {
    const apply = (host: string, port: number) => {
      if (!host || !port) return;
      const url = `ws://${host}:${port}/ws`;
      setConfig((prev) => (prev.serverUrl === url ? prev : { ...prev, serverUrl: url }));
    };
    const handleDiscovered = (event: Event) => {
      const detail = (event as CustomEvent<{ host: string; port: number }>).detail;
      if (detail) apply(detail.host, detail.port);
    };
    window.addEventListener('gamepaddeck-server-discovered', handleDiscovered);
    const initial = window.__gamepadDeckServer;
    if (initial) apply(initial.host, initial.port);
    return () => window.removeEventListener('gamepaddeck-server-discovered', handleDiscovered);
  }, []);

  // The Android shell forwards the QR scanned by the phone camera.
  useEffect(() => {
    window.onQrScanned = (raw: string) => {
      const link = parseJoinLink(raw);
      if (!link) {
        window.AndroidGamepad?.toast?.('El QR no es un enlace de GamepadDeck');
        return;
      }
      setConfig((prev) =>
        prev.serverUrl === link.wsUrl && prev.slot === link.slot
          ? prev
          : { ...prev, serverUrl: link.wsUrl, slot: link.slot },
      );
      if (link.mode) setMode(link.mode);
      window.AndroidGamepad?.toast?.('Celular vinculado a la PC');
    };
    return () => {
      delete window.onQrScanned;
    };
  }, []);

  // Monitor and settings stay portrait; the full-screen touch pad rotates.
  useEffect(() => {
    window.AndroidGamepad?.setOrientation?.(mode === 'touch' ? 'landscape' : 'portrait');
  }, [mode]);

  // Connect socket and listen to stats
  useEffect(() => {
    socketService.connect();

    const unsubStats = socketService.onStats((stats) => {
      setNetworkStats(stats);
    });

    const unsubServerInfo = socketService.onServerInfo((info) => {
      setServerInfo(info);
    });

    const unsubMonitor = socketService.onMonitorSlot((slot, report) => {
      if (modeRef.current !== 'monitor') return;
      setSlotsTelemetry((prev) => samePadReport(prev[slot], report) ? prev : ({
        ...prev,
        [slot]: report,
      }));
    });

    const unsubTelemetry = socketService.onTelemetry((slots) => {
      const reports: Record<number, PadReport> = {};
      const metas: Record<number, SlotControllerMeta> = {};
      const actives: Record<number, boolean> = {};

      slots.forEach((entry) => {
        const state = entry.state;
        actives[entry.slot] = entry.active;
        reports[entry.slot] = {
          buttons: state?.buttons ?? 0,
          l2: state?.l2 ?? 0,
          r2: state?.r2 ?? 0,
          lx: state?.lx ?? 0,
          ly: state?.ly ?? 0,
          rx: state?.rx ?? 0,
          ry: state?.ry ?? 0,
        };
        if (entry.meta?.brand || entry.meta?.name) {
          metas[entry.slot] = entry.meta;
        }
      });

      setSlotMeta((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(metas);
        if (
          prevKeys.length === nextKeys.length &&
          nextKeys.every(
            (key) =>
              prev[Number(key)]?.brand === metas[Number(key)]?.brand &&
              prev[Number(key)]?.name === metas[Number(key)]?.name,
          )
        ) {
          return prev;
        }
        return metas;
      });

      setSlotActive((prev) =>
        prev[0] === actives[0] &&
        prev[1] === actives[1] &&
        prev[2] === actives[2] &&
        prev[3] === actives[3]
          ? prev
          : actives,
      );

      if (modeRef.current === 'monitor') {
        setSlotsTelemetry((prev) => sameReports(prev, reports) ? prev : reports);
      }
    });

    return () => {
      unsubStats();
      unsubServerInfo();
      unsubMonitor();
      unsubTelemetry();
      socketService.disconnect();
    };
  }, []);

  // Screen Wake Lock API
  useEffect(() => {
    const requestWakeLock = async () => {
      if (config.wakeLock && 'wakeLock' in navigator) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch {
          // May fail if tab not active
        }
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && config.wakeLock) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [config.wakeLock]);

  // Orientation Listener
  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window !== 'undefined') {
        const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
        setIsPortrait(portrait);
      }
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Physical Gamepad Auto-Detection & Connection Events
  useEffect(() => {
    const refreshGamepads = () => {
      const pads = captureGamepads(getConnectedGamepads);
      const infos = pads.map(identifyGamepad);
      setConnectedGamepads(infos);

      setConfig((prev) => {
        const next = autoAssignGamepadSlots(prev.slotMap, infos);
        return next === prev.slotMap ? prev : { ...prev, slotMap: next };
      });

      if (infos.length > 0 && !infos.some((g) => g.index === selectedGamepadIndex)) {
        setSelectedGamepadIndex(infos[0].index);
      }
    };

    refreshGamepads();

    // Chrome only exposes gamepads after a user gesture on Android; refresh on
    // the first tap so the shell detects Bluetooth/USB pads without a reload.
    const handlePointerDown = () => refreshGamepads();
    window.addEventListener('pointerdown', handlePointerDown);

    const cleanup = onGamepadConnectionChange(
      () => refreshGamepads(),
      () => refreshGamepads()
    );

    return () => {
      cleanup();
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [selectedGamepadIndex, gamepadRefreshTick]);

  // Announce which physical controller owns each virtual slot so monitors can
  // show the matching artwork and name, regardless of the current tab.
  useEffect(() => {
    const desired = new Map<number, SlotControllerMeta>();
    if (sendsPhysicalInput(mode, isTauriDesktop(window))) connectedGamepads.forEach((gamepad) => {
      const slot = config.slotMap[gamepadSlotKey(gamepad)];
      if (slot !== undefined) {
        desired.set(slot, { brand: gamepad.brand, name: gamepad.name });
      }
    });
    socketService.syncControllerMeta(desired);
  }, [connectedGamepads, config.slotMap, mode]);

  const handleAssignGamepadSlot = (gamepadId: string, slot: PlayerSlotType) => {
    setConfig((prev) => ({
      ...prev,
      slotMap: assignGamepadSlot(prev.slotMap, gamepadId, slot),
    }));
  };

  // Input polling is independent of the display refresh rate.
  useEffect(() => {
    let previewFrame: number | null = null;
    let pendingPreview: { state: NormalizedGamepadState; index: number } | null = null;
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let previousSlots = new Set<PlayerSlotType>();

    const loop = () => {
      const currentTime = performance.now();
      frameCount++;
      if (currentTime - lastFpsTime >= 1000) {
        setPollingHz(Math.round((frameCount * 1000) / (currentTime - lastFpsTime)));
        frameCount = 0;
        lastFpsTime = currentTime;
      }

      const currentMode = modeRef.current;
      const currentConfig = configRef.current;

      let reportToSend: PadReport | null = null;
      let currentSlots = new Set<PlayerSlotType>();

      if (sendsPhysicalInput(currentMode, isTauriDesktop(window))) {
        const pads = captureGamepads(getConnectedGamepads);
        currentSlots = pollPhysicalPads(pads, currentConfig.slotMap, currentConfig.deadzone, currentConfig.invertY, (slot, report, norm, pad) => {
          if (pad.index === selectedGamepadIndexRef.current &&
              (currentMode === 'physical' || calibrationOpenRef.current)) {
            pendingPreview = { state: norm, index: pad.index };
            if (previewFrame === null) {
              previewFrame = requestAnimationFrame(() => {
                previewFrame = null;
                const next = pendingPreview;
                pendingPreview = null;
                if (next && next.index === selectedGamepadIndexRef.current && modeRef.current !== 'touch' &&
                    (modeRef.current === 'physical' || calibrationOpenRef.current)) {
                  setGameState((prev) => sameGamepadState(prev, next.state) ? prev : next.state);
                }
              });
            }
          }
          socketService.sendReport(slot, report, currentConfig.useBinaryProtocol, true);
        });
      } else if (currentMode === 'touch') {
        currentSlots.add(currentConfig.slot);
        reportToSend = normalizedToPadReport(gameStateRef.current, currentConfig.invertY);
        if (reportToSend) {
          socketService.sendReport(
            currentConfig.slot,
            reportToSend,
            currentConfig.useBinaryProtocol,
            true
          );
        }
      }

      for (const slot of previousSlots) {
        if (!currentSlots.has(slot)) socketService.releaseSlot(slot);
      }
      previousSlots = currentSlots;

    };

    const stopPolling = startInputPolling(loop);
    return () => {
      stopPolling();
      if (previewFrame !== null) cancelAnimationFrame(previewFrame);
    };
  }, []);

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleUpdateConfig = (updates: Partial<ClientConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const handleResetServerUrl = () => {
    const defaultUrl = socketService.getDefaultUrl();
    setConfig((prev) => ({ ...prev, serverUrl: defaultUrl }));
  };

  const getJoinUrl = (s: PlayerSlotType) => {
    if (typeof window === 'undefined') return '';
    const host = serverInfo?.lanIp || window.location.hostname || 'localhost';
    return `http://${host}:8765/?slot=${s}&mode=touch`;
  };

  const currentJoinUrl = getJoinUrl(qrSlot);

  useEffect(() => {
    if (!isQrModalOpen || !currentJoinUrl) return;
    QRCode.toDataURL(currentJoinUrl, {
      width: 260,
      margin: 1,
      color: { dark: '#080808', light: '#ffffff' },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error(err));
  }, [isQrModalOpen, currentJoinUrl]);

  const handleCopyUrl = () => {
    if (!currentJoinUrl) return;
    navigator.clipboard.writeText(currentJoinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQrAction = (slot: PlayerSlotType) => {
    if (nativeShell && window.AndroidGamepad?.scanQr) {
      window.AndroidGamepad.scanQr();
      return;
    }
    setQrSlot(slot);
    setIsQrModalOpen(true);
  };

  return (
    <div className="w-screen h-screen flex relative bg-canvas text-ink-2 overflow-hidden select-none">
      {/* Background RomDeck Matte Vignette */}
      <div className="romdeck-bg" />

      {/* DESKTOP FLOATING SIDEBAR (RomDeck style). The touch gamepad is a
          full-screen controller, so the shell steps aside in that mode. */}
      {mode !== 'touch' && (
        <Sidebar
          currentMode={mode}
          onSelectMode={setMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenCalibration={() => setIsCalibrationOpen(true)}
          onOpenQrModal={() => handleQrAction(0)}
          qrLabel={nativeShell ? 'Escanear QR' : undefined}
          networkStats={networkStats}
          serverInfo={serverInfo}
        />
      )}

      {/* PORTRAIT ROTATE HINT: a floating pill so it never covers the controls */}
      {isPortrait && mode === 'touch' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-4">
          <div className="floating-layer flex items-center gap-2 rounded-full border border-warning/30 bg-warning/15 px-3.5 py-2 text-xs font-medium text-warning">
            <RotateCcw size={13} aria-hidden="true" />
            <span>Girá el celular en horizontal para un mejor agarre</span>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT CONTENT CONTAINER */}
      <main className={`app-content ${mode === 'touch' ? 'app-content--flush' : ''}`}>
        {/* FLOATING CONTROLS FOR THE FULL-SCREEN TOUCH GAMEPAD */}
        {mode === 'touch' && (
          <div className="absolute inset-x-0 bottom-2 z-30 flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode('monitor')}
              className={`${BTN_ICON} floating-layer bg-nav-glass`}
              title="Salir al monitor"
              aria-label="Salir al monitor"
            >
              <MonitorIcon size={16} />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className={`${BTN_ICON} floating-layer bg-nav-glass`}
              title="Pantalla completa"
              aria-label="Pantalla completa"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={`${BTN_ICON} floating-layer bg-nav-glass`}
              title="Ajustes"
              aria-label="Ajustes"
            >
              <SettingsIcon size={16} />
            </button>
          </div>
        )}

        {/* ACTIVE VIEW CONTENT */}
        <div
          className={`relative flex w-full flex-1 ${
            mode === 'touch' ? 'h-full overflow-hidden' : ''
          }`}
        >
          {mode === 'touch' && (
            <TouchGamepad
              state={gameState}
              onStateUpdate={setGameState}
              slot={config.slot}
              onSlotChange={(newSlot) => handleUpdateConfig({ slot: newSlot })}
              deadzone={config.deadzone}
            />
          )}

          {mode === 'physical' && (
            <PhysicalGamepadView
              connectedGamepads={connectedGamepads}
              selectedGamepadIndex={selectedGamepadIndex}
              onSelectGamepad={setSelectedGamepadIndex}
              state={gameState}
              slot={config.slot}
              slotMap={config.slotMap}
              onAssignSlot={handleAssignGamepadSlot}
              onRefreshGamepads={() => setGamepadRefreshTick((tick) => tick + 1)}
              pollingHz={pollingHz}
              hardwareEmulated={serverInfo?.hardwareEmulated ?? null}
            />
          )}

          {mode === 'monitor' && (
            <PcDashboard
              slotsState={slotsTelemetry}
              slotActive={slotActive}
              slotMeta={slotMeta}
              monitorSkin={config.monitorSkin}
              slotSkins={config.slotSkins}
              latencyMs={networkStats.latencyMs}
              packetsPerSec={networkStats.packetsPerSec}
              onQrAction={handleQrAction}
              nativeShell={nativeShell}
              hardwareEmulated={serverInfo?.hardwareEmulated ?? null}
            />
          )}
        </div>
      </main>

      {/* MOBILE FLOATING DOCK (When not in Touch Gamepad mode) */}
      {mode !== 'touch' && (
        <MobileDock
          currentMode={mode}
          onSelectMode={setMode}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* MODALS */}
      <CalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        state={gameState}
        deadzone={config.deadzone}
        onDeadzoneChange={(dz) => handleUpdateConfig({ deadzone: dz })}
        slot={config.slot}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onUpdateConfig={handleUpdateConfig}
        onResetServerUrl={handleResetServerUrl}
        defaultServerUrl={socketService.getDefaultUrl()}
        slotMeta={slotMeta}
        serverInfo={serverInfo}
      />

      {/* GLOBAL QR PAIRING SHEET */}
      <Sheet
        open={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title={`Vincular celular a ${PLAYER_SLOTS[qrSlot].name}`}
      >
        <div className="space-y-5">
          <p className="max-w-sm text-xs leading-relaxed text-ink-3">
            Escaneá este código QR con la cámara de tu teléfono para abrir el mando web o enlazar la app Android.
          </p>

          <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-pop">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Código QR de emparejamiento" className="block h-52 w-52 rounded-lg" />
            ) : (
              <div className="flex h-52 w-52 items-center justify-center font-mono text-xs text-canvas">
                generando QR…
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                readOnly
                aria-label="enlace de emparejamiento"
                value={currentJoinUrl}
                className={`${INPUT} min-w-0 w-full select-all font-mono text-xs sm:flex-1`}
              />
              <button type="button" onClick={handleCopyUrl} className={`${BTN} shrink-0 justify-center`}>
                {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
                <span>{copied ? 'copiado' : 'copiar'}</span>
              </button>
            </div>
            <p className="text-xs leading-relaxed text-ink-4">
              El celular y esta PC tienen que estar en la misma red Wi-Fi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-ink-4">
              slot
            </span>
            {([0, 1, 2, 3] as PlayerSlotType[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={qrSlot === s}
                onClick={() => setQrSlot(s)}
                className={pillSmall(qrSlot === s)}
              >
                {PLAYER_SLOTS[s].name}
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </div>
  );
};

export default App;
