/**
 * Device Haptics Service via navigator.vibrate
 */

export class HapticsService {
  private enabled: boolean = true;
  private intensity: 'light' | 'medium' | 'strong' = 'medium';

  constructor(enabled: boolean = true, intensity: 'light' | 'medium' | 'strong' = 'medium') {
    this.enabled = enabled;
    this.intensity = intensity;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public setIntensity(intensity: 'light' | 'medium' | 'strong') {
    this.intensity = intensity;
  }

  private getMultiplier(): number {
    switch (this.intensity) {
      case 'light':
        return 0.6;
      case 'strong':
        return 1.4;
      default:
        return 1.0;
    }
  }

  public trigger(durationMs: number | number[]): void {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) {
      return;
    }

    try {
      const mult = this.getMultiplier();
      if (typeof durationMs === 'number') {
        navigator.vibrate(Math.max(5, Math.round(durationMs * mult)));
      } else {
        const pattern = durationMs.map((d, i) =>
          i % 2 === 0 ? Math.max(5, Math.round(d * mult)) : d
        );
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignored if user hasn't interacted with DOM yet or vibration not supported
    }
  }

  public buttonPress(): void {
    this.trigger(12);
  }

  public stickClick(): void {
    this.trigger([15, 30, 20]);
  }

  public triggerPull(): void {
    this.trigger(22);
  }

  public bumperPress(): void {
    this.trigger(16);
  }

  public slotChange(): void {
    this.trigger([20, 40, 20]);
  }

  public heavyImpact(): void {
    this.trigger([50, 40, 80]);
  }
}

export const haptics = new HapticsService();
