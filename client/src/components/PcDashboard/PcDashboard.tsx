import React from 'react';
import {
  type ControllerSkin,
  type PadReport,
  type PlayerSlotType,
  type SlotControllerMeta,
  PLAYER_SLOTS,
} from '../../types/gamepad';
import { padReportToNormalized } from '../../services/protocol';
import { QrCode, ScanLine, Smartphone } from 'lucide-react';
import PageHeading from '../ui/PageHeading';
import {
  BTN_ICON,
  BTN_PRIMARY,
  PANEL,
} from '../../lib/ui';
import { resolveControllerBrand } from '../../lib/controller-skins';
import { RealControllerVisualizer } from './RealControllerVisualizer';

interface PcDashboardProps {
  slotsState: Record<number, PadReport>;
  slotActive: Record<number, boolean>;
  slotMeta: Record<number, SlotControllerMeta>;
  monitorSkin: ControllerSkin;
  slotSkins: ControllerSkin[];
  latencyMs: number;
  packetsPerSec: number;
  onQrAction: (slot: PlayerSlotType) => void;
  nativeShell: boolean;
  hardwareEmulated: boolean | null;
}

function signed(value: number | undefined): string {
  const number = value ?? 0;
  if (number === 0) return '0.00';
  return `${number > 0 ? '+' : ''}${number.toFixed(2)}`;
}

const Counter: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-baseline gap-1.5">
    <span className="text-[11px] text-ink-4">{label}</span>
    <strong className="font-mono text-[13px] font-medium tabular text-ink-1">{value}</strong>
  </div>
);

export const PcDashboard: React.FC<PcDashboardProps> = ({
  slotsState,
  slotActive,
  slotMeta: slotControllerMeta,
  monitorSkin,
  slotSkins,
  latencyMs,
  packetsPerSec,
  onQrAction,
  nativeShell,
  hardwareEmulated,
}) => {
  const handleOpenQr = (slot: PlayerSlotType) => {
    onQrAction(slot);
  };

  const activeCount = ([0, 1, 2, 3] as PlayerSlotType[]).filter(
    (slot) => slotActive[slot] === true,
  ).length;

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeading
        title="Monitor"
        description={
          hardwareEmulated === false
            ? 'Supervisión en vivo de los cuatro slots virtuales (modo fallback, sin mando en la PC) y de los mandos que se conectan por Wi-Fi o USB.'
            : 'Supervisión en vivo de los cuatro slots virtuales ViGEmBus (Xbox 360) y de los mandos que se conectan por Wi-Fi o USB.'
        }
        actions={
          <button type="button" onClick={() => handleOpenQr(0)} className={BTN_PRIMARY}>
            {nativeShell ? (
              <ScanLine size={16} aria-hidden="true" />
            ) : (
              <QrCode size={16} aria-hidden="true" />
            )}
            <span>{nativeShell ? 'Escanear QR' : 'Vincular celular'}</span>
          </button>
        }
      />

      <div className={`${PANEL} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4`}>
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 rounded-full bg-success ${activeCount > 0 ? 'animate-pulse-led' : ''}`}
          />
          <span className="text-[13px] font-medium text-ink-1">
            {activeCount === 0 ? 'sin mandos activos' : `${activeCount} de 4 en uso`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Counter label="juego" value={activeCount} />
          <Counter label="latencia" value={latencyMs > 0 ? `${latencyMs.toFixed(1)} ms` : '< 1 ms'} />
          <Counter label="tasa" value={packetsPerSec > 0 ? `${packetsPerSec}/s` : '60 Hz'} />
          <Counter label="red" value="udp 9876" />
          <Counter label="socket" value="ws 8765" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {([0, 1, 2, 3] as PlayerSlotType[]).map((slotIndex) => {
          const slotMeta = PLAYER_SLOTS[slotIndex];
          const report = slotsState[slotIndex];
          const connected = slotActive[slotIndex] === true;
          const norm = report ? padReportToNormalized(report) : null;
          const controller = slotControllerMeta[slotIndex];
          const brand = resolveControllerBrand(
            slotSkins[slotIndex] ?? 'auto',
            controller,
            monitorSkin,
          );

          return (
            <article
              key={slotIndex}
              className={`${PANEL} flex flex-col gap-4 p-5 transition-shadow duration-200 ${
                connected ? 'shadow-card' : ''
              }`}
              style={connected ? { boxShadow: `inset 0 0 0 1px ${slotMeta.color}55` } : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slotMeta.color }}
                  />
                  <div className="min-w-0">
                    <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink-1">
                      {slotMeta.name}
                    </h2>
                    <p className="truncate text-xs text-ink-4">
                      {controller?.name ?? `virtual device #${slotIndex + 1}`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: connected ? slotMeta.color : 'var(--color-ink-4)' }}
                  >
                    {connected ? 'conectado' : 'en espera'}
                  </span>
                  {!nativeShell && (
                    <button
                      type="button"
                      onClick={() => handleOpenQr(slotIndex)}
                      className={BTN_ICON}
                      aria-label={`Vincular QR para ${slotMeta.name}`}
                      title={`Vincular QR para ${slotMeta.name}`}
                    >
                      <QrCode size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div className="py-1">
                <RealControllerVisualizer
                  state={norm}
                  accentColor={slotMeta.color}
                  brand={brand}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'lt', label: 'lt', value: norm?.lt ?? 0 },
                  { key: 'rt', label: 'rt', value: norm?.rt ?? 0 },
                ].map((trigger) => (
                  <div key={trigger.key}>
                    <div className="flex items-baseline justify-between pb-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-4">
                      <span>{trigger.label}</span>
                      <span className="tabular text-ink-2">
                        {Math.round(trigger.value * 100)}%
                      </span>
                    </div>
                    <div className="rd-meter" aria-hidden="true">
                      <span
                        style={{
                          transform: `scaleX(${trigger.value})`,
                          backgroundColor:
                            trigger.key === 'lt' ? slotMeta.color : 'var(--color-ink-1)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div className="flex items-center gap-4 font-mono text-[11px] tabular text-ink-4">
                  <span>
                    ls <span className="text-ink-2">{signed(norm?.lx)}, {signed(norm?.ly)}</span>
                  </span>
                  <span>
                    rs <span className="text-ink-2">{signed(norm?.rx)}, {signed(norm?.ry)}</span>
                  </span>
                </div>

                {!nativeShell && (
                  <button
                    type="button"
                    onClick={() => handleOpenQr(slotIndex)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full text-[11px] font-medium text-ink-3 transition-colors hover:text-ink-1 md:min-h-9"
                  >
                    <Smartphone size={13} aria-hidden="true" />
                    <span>conectar teléfono</span>
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
