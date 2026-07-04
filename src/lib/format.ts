import type { FatigueStatus, Platform } from './types';

/** Visual + copy metadata for each fatigue status, driven by CSS custom properties. */
export const STATUS_META: Record<
  FatigueStatus,
  { label: string; color: string; tint: string; blurb: string }
> = {
  healthy: {
    label: 'Healthy',
    color: 'var(--healthy)',
    tint: 'var(--healthy-tint)',
    blurb: 'Performing well',
  },
  warning: {
    label: 'Warning',
    color: 'var(--warning)',
    tint: 'var(--warning-tint)',
    blurb: 'Decaying — stage a replacement',
  },
  fatigued: {
    label: 'Fatigued',
    color: 'var(--fatigued)',
    tint: 'var(--fatigued-tint)',
    blurb: 'Rotate within 24h',
  },
  dead: {
    label: 'Dead',
    color: 'var(--dead)',
    tint: 'var(--dead-tint)',
    blurb: 'Pause now',
  },
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  meta: 'Meta',
  tiktok: 'TikTok',
  google: 'Google',
  taboola: 'Taboola',
};

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export function moneyPrecise(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function cliffLabel(days: number | null): string {
  if (days === null) return 'stable';
  if (days <= 0) return 'at cliff';
  if (days < 1) return '<1 day';
  return `${Math.round(days)}d`;
}
