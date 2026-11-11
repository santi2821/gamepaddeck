import React from 'react';
import { type ClientAppMode, type NetworkStats } from '../../types/gamepad';
import type { ServerInfo } from '../../services/websocket';
import {
  Monitor,
  Gamepad2,
  Sliders,
  Settings,
  QrCode,
} from 'lucide-react';
import { FOCUS_RING } from '../../lib/ui';

interface SidebarProps {
  currentMode: ClientAppMode;
  onSelectMode: (mode: ClientAppMode) => void;
  onOpenSettings: () => void;
  onOpenCalibration: () => void;
  onOpenQrModal: () => void;
  qrLabel?: string;
  networkStats: NetworkStats;
  serverInfo: ServerInfo | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentMode,
  onSelectMode,
  onOpenSettings,
  onOpenCalibration,
  onOpenQrModal,
  qrLabel = 'Vincular celular',
  networkStats,
  serverInfo,
}) => {
  const isConnected = networkStats.status === 'connected';
  const serverLabel = !isConnected
    ? 'sin conexión'
    : serverInfo
      ? serverInfo.hardwareEmulated
        ? 'Xbox 360'
        : 'fallback'
      : 'conectado';

  const navItems = [
    {
      id: 'monitor' as ClientAppMode,
      label: 'Monitor',
      icon: Monitor,
    },
    {
      id: 'physical' as ClientAppMode,
      label: 'Mando físico',
      icon: Gamepad2,
    },
  ];

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect
            x="3.6"
            y="7.4"
            width="9.2"
            height="12.6"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
            transform="rotate(-8 8.2 13.7)"
          />
          <rect
            x="11.2"
            y="4"
            width="9.2"
            height="12.6"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
            transform="rotate(8 15.8 10.3)"
          />
          <path d="M15.8 7.4l1.7 2.5-1.7 2.5-1.7-2.5z" fill="currentColor" />
        </svg>
        <span>gamepaddeck</span>
      </div>

      <nav aria-label="navegación principal" className="contents">
        <div className="sidebar-main">
          <p className="sidebar-group-title">modo</p>
          {navItems.map((item) => {
            const isActive = currentMode === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectMode(item.id)}
                className={`sidebar-link ${FOCUS_RING} ${isActive ? 'is-active' : ''}`}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <p className="sidebar-group-title">herramientas</p>
          <button
            type="button"
            onClick={onOpenQrModal}
            className={`sidebar-link ${FOCUS_RING}`}
          >
            <QrCode aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            <span>{qrLabel}</span>
          </button>
          <button
            type="button"
            onClick={onOpenCalibration}
            className={`sidebar-link ${FOCUS_RING}`}
          >
            <Sliders aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            <span>Calibración</span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className={`sidebar-link ${FOCUS_RING}`}
          >
            <Settings aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
            <span>Ajustes</span>
          </button>

          <div className="sidebar-status">
            <div className="sidebar-status-row">
              <span>servidor</span>
              <strong
                className="inline-flex items-center gap-1.5"
                title={serverInfo?.driver || 'driver del servidor'}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    isConnected ? 'bg-success' : 'bg-ink-4'
                  }`}
                />
                {serverLabel}
              </strong>
            </div>
            <div className="sidebar-status-row">
              <span>latencia</span>
              <strong>{isConnected ? `${networkStats.latencyMs.toFixed(1)} ms` : '—'}</strong>
            </div>
            <div className="sidebar-status-row">
              <span>tasa</span>
              <strong>{networkStats.packetsPerSec > 0 ? `${networkStats.packetsPerSec} pkt/s` : '—'}</strong>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
};
