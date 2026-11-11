import React from 'react';
import {
  type ClientAppMode,
  type NetworkStats,
  type PlayerSlotType,
  PLAYER_SLOTS,
} from '../types/gamepad';
import {
  Gamepad2,
  Smartphone,
  Monitor,
  Sliders,
  Settings,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { haptics } from '../services/haptics';
import Segmented from './Segmented';
import { BTN_ICON } from '../lib/ui';

interface TopBarProps {
  mode: ClientAppMode;
  onModeChange: (mode: ClientAppMode) => void;
  slot: PlayerSlotType;
  onSlotChange: (slot: PlayerSlotType) => void;
  networkStats: NetworkStats;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onOpenCalibration: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  mode,
  onModeChange,
  slot,
  onSlotChange,
  networkStats,
  isFullscreen,
  onToggleFullscreen,
  onOpenSettings,
  onOpenCalibration,
}) => {
  const isConnected = networkStats.status === 'connected';
  const isConnecting = networkStats.status === 'connecting';

  const getStatusColor = () => {
    if (isConnected) return '#46d08f'; // RomDeck success
    if (isConnecting) return '#fb923c'; // RomDeck warning
    return '#f2616a'; // RomDeck danger
  };

  const modeOptions = [
    {
      value: 'touch' as ClientAppMode,
      label: (
        <span className="flex items-center gap-1.5">
          <Smartphone size={13} />
          <span>Touch</span>
        </span>
      ),
    },
    {
      value: 'physical' as ClientAppMode,
      label: (
        <span className="flex items-center gap-1.5">
          <Gamepad2 size={13} />
          <span>Physical</span>
        </span>
      ),
    },
    {
      value: 'monitor' as ClientAppMode,
      label: (
        <span className="flex items-center gap-1.5">
          <Monitor size={13} />
          <span className="hidden sm:inline">Host</span> Monitor
        </span>
      ),
    },
  ];

  return (
    <header className="w-full h-13 min-h-13 bg-nav-glass border-b border-line px-3 sm:px-4 flex items-center justify-between z-40 relative select-none">
      {/* LEFT: BRAND & PLAYER SLOTS */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-surface-2 border border-line flex items-center justify-center text-ink-1 shadow-sm">
            <Gamepad2 size={15} />
          </div>
          <span className="font-display font-semibold text-sm tracking-tight text-ink-1 hidden sm:inline-flex items-center gap-1">
            GAMEPAD<span className="text-ink-4 font-normal">DECK</span>
          </span>
        </div>

        {/* 4 Player Slots Pills */}
        <div className="flex items-center bg-surface-2 p-1 rounded-full border border-line gap-0.5">
          {([0, 1, 2, 3] as PlayerSlotType[]).map((s) => {
            const meta = PLAYER_SLOTS[s];
            const isSelected = slot === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  haptics.slotChange();
                  onSlotChange(s);
                }}
                className={`transition-all rounded-full px-2.5 py-0.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isSelected
                    ? 'text-canvas shadow-sm font-bold scale-[1.03]'
                    : 'text-ink-3 hover:text-ink-1 hover:bg-surface-3'
                }`}
                style={{
                  backgroundColor: isSelected ? meta.color : 'transparent',
                }}
                title={meta.name}
              >
                P{s + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTER: MODE SWITCHER */}
      <div className="flex items-center">
        <Segmented
          label="App Mode"
          options={modeOptions}
          value={mode}
          onChange={(newMode) => onModeChange(newMode as ClientAppMode)}
          size="sm"
        />
      </div>

      {/* RIGHT: NETWORK STATUS & ACTION ICONS */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Connection pill with latency */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-mono tabular text-ink-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: getStatusColor() }}
          />
          {isConnected ? (
            <span className="text-ink-1 font-semibold">{networkStats.latencyMs}ms</span>
          ) : (
            <span className="text-ink-4">{isConnecting ? 'Conn...' : 'Offline'}</span>
          )}
        </div>

        {/* Calibration button */}
        <button
          type="button"
          onClick={onOpenCalibration}
          className={`${BTN_ICON} h-8 w-8 min-h-8 min-w-8 text-ink-3 hover:text-ink-1`}
          title="Calibrate & Test"
        >
          <Sliders size={14} />
        </button>

        {/* Settings button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className={`${BTN_ICON} h-8 w-8 min-h-8 min-w-8 text-ink-3 hover:text-ink-1`}
          title="Settings"
        >
          <Settings size={14} />
        </button>

        {/* Fullscreen button */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={`${BTN_ICON} h-8 w-8 min-h-8 min-w-8 text-ink-3 hover:text-ink-1`}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>
    </header>
  );
};
