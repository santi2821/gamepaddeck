import React from 'react';
import { type CSSProperties } from 'react';
import { type ClientAppMode } from '../../types/gamepad';
import { Monitor, Gamepad2, Settings } from 'lucide-react';
import { FOCUS_RING } from '../../lib/ui';

interface MobileDockProps {
  currentMode: ClientAppMode;
  onSelectMode: (mode: ClientAppMode) => void;
  onOpenSettings: () => void;
}

export const MobileDock: React.FC<MobileDockProps> = ({
  currentMode,
  onSelectMode,
  onOpenSettings,
}) => {
  const destinations = [
    {
      id: 'physical' as ClientAppMode,
      label: 'físico',
      icon: Gamepad2,
    },
    {
      id: 'monitor' as ClientAppMode,
      label: 'monitor',
      icon: Monitor,
    },
  ];

  const activeIndex = destinations.findIndex((destination) => destination.id === currentMode);

  return (
    <div className="mobile-dock">
      <nav
        aria-label="navegación móvil"
        className="mobile-nav-glass"
        style={
          {
            '--nav-index': activeIndex === -1 ? 0 : activeIndex,
            '--nav-count': destinations.length + 1,
          } as CSSProperties
        }
      >
        <span
          className="mobile-nav-pill"
          aria-hidden="true"
          style={{ opacity: activeIndex === -1 ? 0 : 1 }}
        />
        {destinations.map((destination, index) => {
          const isActive = activeIndex === index;
          const Icon = destination.icon;
          return (
            <button
              key={destination.id}
              type="button"
              aria-label={destination.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectMode(destination.id)}
              className={`mobile-nav-item ${FOCUS_RING} ${isActive ? 'font-semibold' : ''}`}
            >
              <Icon aria-hidden="true" strokeWidth={isActive ? 2.3 : 1.7} />
              <span aria-hidden="true" className="mobile-nav-label">
                {destination.label}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Ajustes"
          onClick={onOpenSettings}
          className={`mobile-nav-item ${FOCUS_RING}`}
        >
          <Settings aria-hidden="true" strokeWidth={1.7} />
          <span aria-hidden="true" className="mobile-nav-label">
            ajustes
          </span>
        </button>
      </nav>
    </div>
  );
};
