import { describe, it, expect } from 'vitest';
import {
  diagnose,
  summariseAccount,
  forecastDaysUntilCliff,
  estimateWastedSpend,
  THRESHOLDS,
} from '../fatigue-engine';
import type { Creative, DailyMetric } from '../types';

/**
 * Test fixtures build daily series by intent rather than by hand, so each test
 * states the *shape* of performance it wants (steady, decaying, collapsed).
 */

function day(over: Partial<DailyMetric> & { date: string }): DailyMetric {
  return {
    impressions: 10000,
    clicks: 200, // 2% CTR baseline
    spend: 100,
    conversions: 10, // $10 CPA baseline
    frequency: 1.5,
    ...over,
  };
}

/** A steady, healthy creative: flat CTR, low frequency. */
function healthySeries(): DailyMetric[] {
  return Array.from({ length: 7 }, (_, i) =>
    day({ date: `2026-06-0${i + 1}`, clicks: 200, frequency: 1.4 + i * 0.02 }),
  );
}

/** Gentle CTR decay with rising frequency — should read as warning, not dead. */
function warningSeries(): DailyMetric[] {
  const ctrs = [0.02, 0.02, 0.0195, 0.018, 0.017, 0.0162, 0.0155]; // ~22% off peak
  return ctrs.map((c, i) =>
    day({
      date: `2026-06-0${i + 1}`,
      clicks: Math.round(10000 * c),
      frequency: 1.8 + i * 0.18, // climbs toward ~2.9
    }),
  );
}

/** Steep collapse: CTR halved, frequency past the cliff, CPA inflated. */
function deadSeries(): DailyMetric[] {
  const ctrs = [0.021, 0.02, 0.017, 0.014, 0.011, 0.009, 0.008]; // ~60% off peak
  return ctrs.map((c, i) =>
    day({
      date: `2026-06-0${i + 1}`,
      clicks: Math.round(10000 * c),
      frequency: 3.0 + i * 0.35, // well past 3.5
      conversions: Math.max(1, 10 - i), // CPA rising
      spend: 100,
    }),
  );
}

function makeCreative(id: string, metrics: DailyMetric[], over: Partial<Creative> = {}): Creative {
  return {
    id,
    name: `Creative ${id}`,
    platform: 'meta',
    format: 'static',
    angle: 'problem-agitation',
    metrics,
    ...over,
  };
}

describe('diagnose — status classification', () => {
  it('classifies a steady creative as healthy', () => {
    const d = diagnose(makeCreative('h', healthySeries()));
    expect(d.status).toBe('healthy');
    expect(d.score).toBeLessThan(THRESHOLDS.SCORE_WARNING);
  });

  it('classifies a gently decaying creative as warning', () => {
    const d = diagnose(makeCreative('w', warningSeries()));
    expect(['warning', 'fatigued']).toContain(d.status);
    expect(d.score).toBeGreaterThanOrEqual(THRESHOLDS.SCORE_WARNING);
  });

  it('classifies a collapsed creative as fatigued or dead', () => {
    const d = diagnose(makeCreative('x', deadSeries()));
    expect(['fatigued', 'dead']).toContain(d.status);
    expect(d.score).toBeGreaterThanOrEqual(THRESHOLDS.SCORE_FATIGUED);
  });
});

describe('signals', () => {
  it('flags CTR decay before CPA on a warning creative (leading vs lagging)', () => {
    const d = diagnose(makeCreative('w', warningSeries()));
    const ctr = d.signals.find((s) => s.key === 'ctrDecay')!;
    const cpa = d.signals.find((s) => s.key === 'cpaInflation')!;
    expect(ctr.breached).toBe(true);
    // The whole thesis: CTR breaches while CPA is still fine.
    expect(cpa.breached).toBe(false);
  });

  it('includes a hook-rate signal only when video data is present', () => {
    const withHook = healthySeries().map((m) => ({ ...m, hookRate: 0.3 }));
    const staticD = diagnose(makeCreative('s', healthySeries()));
    const videoD = diagnose(makeCreative('v', withHook, { format: 'video' }));
    expect(staticD.signals.some((s) => s.key === 'hookDecay')).toBe(false);
    expect(videoD.signals.some((s) => s.key === 'hookDecay')).toBe(true);
  });
});

describe('forecastDaysUntilCliff', () => {
  it('returns null for a stable creative', () => {
    expect(forecastDaysUntilCliff(healthySeries())).toBeNull();
  });

  it('returns a positive horizon for a decaying creative', () => {
    const days = forecastDaysUntilCliff(warningSeries());
    expect(days).not.toBeNull();
    expect(days as number).toBeGreaterThan(0);
  });

  it('returns 0 when already at or past the cliff', () => {
    const days = forecastDaysUntilCliff(deadSeries());
    expect(days).toBe(0);
  });

  it('returns null when there is insufficient data', () => {
    expect(forecastDaysUntilCliff([day({ date: '2026-06-01' })])).toBeNull();
  });
});

describe('estimateWastedSpend', () => {
  it('is zero for a healthy creative', () => {
    expect(estimateWastedSpend(healthySeries())).toBe(0);
  });

  it('is positive once decay begins', () => {
    expect(estimateWastedSpend(deadSeries())).toBeGreaterThan(0);
  });
});

describe('summariseAccount', () => {
  it('rolls up counts, spend, and imminent cliffs', () => {
    const creatives = [
      makeCreative('h', healthySeries()),
      makeCreative('w', warningSeries()),
      makeCreative('x', deadSeries()),
    ];
    const s = summariseAccount(creatives);
    expect(s.totalCreatives).toBe(3);
    expect(s.byStatus.healthy).toBe(1);
    expect(s.byStatus.healthy + s.byStatus.warning + s.byStatus.fatigued + s.byStatus.dead).toBe(3);
    expect(s.totalSpend).toBeGreaterThan(0);
    expect(s.totalWastedSpend).toBeGreaterThan(0);
  });
});
