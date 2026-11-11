import React, { useState } from 'react';
import {
  type ClientConfig,
  type PlayerSlotType,
  type SlotControllerMeta,
  PLAYER_SLOTS,
} from '../../types/gamepad';
import Sheet from '../Sheet';
import Segmented from '../Segmented';
import Field from '../ui/Field';
import SwitchRow from '../ui/SwitchRow';
import Section from '../ui/Section';
import { BTN_PRIMARY, BTN_GHOST, BTN_SOFT, CHIP, SELECT } from '../../lib/ui';
import type { ServerInfo } from '../../services/websocket';
import {
  CONTROLLER_SKIN_OPTIONS,
  isControllerSkin,
} from '../../lib/controller-skins';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ClientConfig;
  onUpdateConfig: (newConfig: Partial<ClientConfig>) => void;
  onResetServerUrl: () => void;
  defaultServerUrl: string;
  slotMeta: Record<number, SlotControllerMeta>;
  serverInfo: ServerInfo | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onResetServerUrl,
  defaultServerUrl,
  slotMeta,
  serverInfo,
}) => {
  const [inputUrl, setInputUrl] = useState<string>(config.serverUrl);
  const [saved, setSaved] = useState<boolean>(false);

  const handleSaveUrl = () => {
    onUpdateConfig({ serverUrl: inputUrl.trim() });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const intensityOptions = [
    { value: 'light', label: 'suave' },
    { value: 'medium', label: 'media' },
    { value: 'strong', label: 'fuerte' },
  ];

  return (
    <Sheet
      open={isOpen}
      title="Ajustes"
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <button type="button" onClick={onClose} className={BTN_PRIMARY}>
          listo
        </button>
      }
    >
      <div className="space-y-4">
        <Section
          raised
          title="Controles"
          description="Elegí el arte del monitor para cada slot. Auto usa el control detectado; si no hay detección, usa el skin del monitor."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-[13px] font-medium text-ink-2">Skin del monitor</p>
                <p className="text-xs leading-relaxed text-ink-4">
                  Fallback cuando un slot no tiene control detectado.
                </p>
              </div>
              <Segmented
                label="Skin del monitor"
                options={CONTROLLER_SKIN_OPTIONS}
                value={config.monitorSkin}
                onChange={(value) => onUpdateConfig({ monitorSkin: value })}
                size="sm"
              />
            </div>

            <div className="divide-y divide-line border-t border-line">
              {([0, 1, 2, 3] as PlayerSlotType[]).map((slot) => {
                const controller = slotMeta[slot];
                return (
                  <div
                    key={slot}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: PLAYER_SLOTS[slot].color }}
                      />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink-2">
                          {PLAYER_SLOTS[slot].name}
                        </p>
                        <p className="truncate text-xs text-ink-4">
                          {controller
                            ? `${controller.name} · virtual #${slot + 1}`
                            : `Sin control detectado · virtual #${slot + 1}`}
                        </p>
                      </div>
                    </div>
                    <select
                      aria-label={`Skin para ${PLAYER_SLOTS[slot].name}`}
                      value={config.slotSkins[slot] ?? 'auto'}
                      onChange={(event) => {
                        const next = [...config.slotSkins];
                        next[slot] = isControllerSkin(event.target.value)
                          ? event.target.value
                          : 'auto';
                        onUpdateConfig({ slotSkins: next });
                      }}
                      className={`${SELECT} w-full shrink-0 min-h-11 md:min-h-10 sm:w-36`}
                    >
                      {CONTROLLER_SKIN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <p className="text-xs leading-relaxed text-ink-4">
              {serverInfo?.hardwareEmulated
                ? 'La PC expone cada slot como un mando Xbox 360 (ViGEmBus). Asigná qué control físico va a cada slot desde “Mando físico”.'
                : serverInfo
                  ? 'El servidor corre en modo fallback: los slots se supervisan, pero la PC todavía no recibe un mando virtual. Asigná qué control físico va a cada slot desde “Mando físico”.'
                  : 'La PC expone cada slot como un mando virtual. Asigná qué control físico va a cada slot desde “Mando físico”.'}
            </p>
          </div>
        </Section>

        <Section
          raised
          title="Servidor"
          description="Conexión directa al servidor de baja latencia en Rust + Tokio."
          meta={saved ? <span className={CHIP}>guardado</span> : undefined}
        >
          <div className="space-y-3">
            <Field
              id="server-url"
              label="URL del WebSocket"
              value={inputUrl}
              onChange={(event) => setInputUrl(event.target.value)}
              placeholder="ws://192.168.1.100:9876/ws"
              className="font-mono text-xs"
              hint="Se guarda en este navegador. Usá la IP de la PC que corre el servidor."
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleSaveUrl} className={BTN_SOFT}>
                guardar
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetServerUrl();
                  setInputUrl(defaultServerUrl);
                }}
                className={BTN_GHOST}
              >
                restablecer
              </button>
            </div>
          </div>
        </Section>

        <Section
          raised
          title="Rendimiento"
          description="El protocolo binario manda paquetes de 36 bytes sin serializar JSON."
        >
          <div className="divide-y divide-line">
            <SwitchRow
              id="binary-protocol"
              label="Protocolo binario"
              description={
                config.useBinaryProtocol
                  ? 'Paquetes de 36 bytes zero-copy. Es el modo recomendado.'
                  : 'Modo JSON de compatibilidad para diagnóstico.'
              }
              checked={config.useBinaryProtocol}
              onChange={(checked) => onUpdateConfig({ useBinaryProtocol: checked })}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="space-y-1">
                <p className="text-[13px] font-medium text-ink-2">Invertir eje Y</p>
                <p className="text-xs leading-relaxed text-ink-4">
                  Estilo simulador de vuelo: empujar el stick equivale a bajar.
                </p>
              </div>
              <input
                id="invert-y"
                type="checkbox"
                role="switch"
                aria-label="Invertir eje Y"
                checked={config.invertY}
                onChange={(event) => onUpdateConfig({ invertY: event.target.checked })}
              />
            </div>
          </div>
        </Section>

        <Section
          raised
          title="Háptica"
          description="Respuesta táctil al pulsar botones, gatillos y sticks."
        >
          <div className="divide-y divide-line">
            <SwitchRow
              id="vibration"
              label="Vibración"
              description="Vibra el teléfono con cada pulsación registrada."
              checked={config.vibrationEnabled}
              onChange={(checked) => onUpdateConfig({ vibrationEnabled: checked })}
            />
            {config.vibrationEnabled && (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="text-[13px] font-medium text-ink-2">Intensidad</span>
                <Segmented
                  options={intensityOptions}
                  value={config.vibrationIntensity}
                  onChange={(val) =>
                    onUpdateConfig({ vibrationIntensity: val as ClientConfig['vibrationIntensity'] })
                  }
                  size="sm"
                />
              </div>
            )}
          </div>
        </Section>

        <Section raised title="Pantalla" description="Comportamiento del teléfono mientras jugás.">
          <SwitchRow
            id="wake-lock"
            label="Mantener pantalla activa"
            description="Evita que la pantalla se apague con el mando táctil en uso."
            checked={config.wakeLock}
            onChange={(checked) => onUpdateConfig({ wakeLock: checked })}
          />
        </Section>
      </div>
    </Sheet>
  );
};
