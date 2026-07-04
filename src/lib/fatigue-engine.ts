/**
 * Fatigue engine — the analytical core of AdSignal.
 *
 * Design goal: catch creative fatigue from LEADING indicators (CTR decay, rising
 * frequency, hook-rate decay) days before it shows up in the LAGGING indicator
 * everyone watches (CPA). This mirrors observability practice: alert on the signal
 * that precedes the incident, not the outage itself.
 *
 * Every function here is pure (no I/O, no dates from the wall clock) so it is
 * trivially testable and deterministic. Thresholds are grounded in 2026
 * performance-marketing benchmarks and documented inline.
 */

import type {
  Creative,
  DailyMetric,
  Diagnosis,
  FatigueStatus,
  Signal,
  AccountSummary,
} from './types';

// ---------------------------------------------------------------------------
// Thresholds. Named, documented, and centralised so another engineer can tune
// them per-account without hunting through logic.
// ---------------------------------------------------------------------------

export const THRESHOLDS = {
  /** Days of early delivery treated as the "peak" baseline. */
  BASELINE_WINDOW: 3,
  /** Days of recent delivery compared against the baseline. */
  RECENT_WINDOW: 3,

  /** CTR decline vs. baseline that counts as a fatigue signal. Meta studies show
   *  ~15%+ CTR drop is the reliable early tell, well before CPA moves. */
  CTR_DECAY_WARN: 0.15,
  /** Steeper CTR collapse indicating advanced fatigue. */
  CTR_DECAY_SEVERE: 0.35,

  /** CPM rise vs. baseline that signals the auction is penalising the creative. */
  CPM_RISE_WARN: 0.1,

  /** Prospecting frequency where performance starts sliding. */
  FREQ_WARN: 2.5,
  /** Frequency cliff — past here, delivery collapses onto saturated users. */
  FREQ_SEVERE: 3.5,

  /** Hook-rate (thumb-stop) decline that means the opening has fatigued. */
  HOOK_DECAY_WARN: 0.2,

  /** CPA inflation vs. baseline confirming fatigue has reached the money metric. */
  CPA_INFLATION_WARN: 0.2,

  /** Composite-score bands mapping to status. */
  SCORE_WARNING: 25,
  SCORE_FATIGUED: 55,
  SCORE_DEAD: 80,
} as const;

// ---------------------------------------------------------------------------
// Small metric helpers.
// ---------------------------------------------------------------------------

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const safeDiv = (a: number, b: number): number => (b === 0 ? 0 : a / b);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round = (x: number, dp = 2): number => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

/** Aggregate CTR across a slice of days (weighted by impressions, not a mean of ratios). */
function ctr(days: DailyMetric[]): number {
  return safeDiv(sum(days.map((d) => d.clicks)), sum(days.map((d) => d.impressions)));
}

/** Aggregate CPM (cost per 1000 impressions) across a slice of days. */
function cpm(days: DailyMetric[]): number {
  return safeDiv(sum(days.map((d) => d.spend)), sum(days.map((d) => d.impressions))) * 1000;
}

/** Aggregate CPA (cost per conversion) across a slice of days. */
function cpa(days: DailyMetric[]): number {
  return safeDiv(sum(days.map((d) => d.spend)), sum(days.map((d) => d.conversions)));
}

/** Impression-weighted mean hook rate; returns null when no video data present. */
function hookRate(days: DailyMetric[]): number | null {
  const withHook = days.filter((d) => typeof d.hookRate === 'number');
  if (withHook.length === 0) return null;
  const numerator = sum(withHook.map((d) => (d.hookRate as number) * d.impressions));
  const denominator = sum(withHook.map((d) => d.impressions));
  return safeDiv(numerator, denominator);
}

/** Latest-day frequency (the pressure right now). */
function currentFrequency(days: DailyMetric[]): number {
  return days.length ? days[days.length - 1].frequency : 0;
}

function baselineSlice(m: DailyMetric[]): DailyMetric[] {
  return m.slice(0, THRESHOLDS.BASELINE_WINDOW);
}
function recentSlice(m: DailyMetric[]): DailyMetric[] {
  return m.slice(-THRESHOLDS.RECENT_WINDOW);
}

/** Percentage decline from baseline→recent (positive = got worse for CTR/hook). */
function decline(baseline: number, recent: number): number {
  if (baseline === 0) return 0;
  return (baseline - recent) / baseline;
}
/** Percentage rise from baseline→recent (positive = got worse for CPM/CPA). */
function rise(baseline: number, recent: number): number {
  if (baseline === 0) return 0;
  return (recent - baseline) / baseline;
}

// ---------------------------------------------------------------------------
// Signals.
// ---------------------------------------------------------------------------

function buildSignals(m: DailyMetric[]): Signal[] {
  const base = baselineSlice(m);
  const recent = recentSlice(m);

  const ctrDecay = decline(ctr(base), ctr(recent));
  const cpmRise = rise(cpm(base), cpm(recent));
  const freq = currentFrequency(m);
  const cpaInflation = rise(cpa(base), cpa(recent));

  const baseHook = hookRate(base);
  const recentHook = hookRate(recent);
  const hookDecay = baseHook !== null && recentHook !== null ? decline(baseHook, recentHook) : null;

  const pct = (x: number) => `${x >= 0 ? '-' : '+'}${Math.abs(Math.round(x * 100))}%`;
  const pctUp = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;

  const signals: Signal[] = [
    {
      key: 'ctrDecay',
      label: 'CTR decay',
      reading: pct(ctrDecay),
      breached: ctrDecay >= THRESHOLDS.CTR_DECAY_WARN,
      note:
        ctrDecay >= THRESHOLDS.CTR_DECAY_WARN
          ? 'Click-through is falling — the earliest sign of fatigue.'
          : 'Click-through is holding steady.',
    },
    {
      key: 'cpmRise',
      label: 'CPM rise',
      reading: pctUp(cpmRise),
      breached: cpmRise >= THRESHOLDS.CPM_RISE_WARN,
      note:
        cpmRise >= THRESHOLDS.CPM_RISE_WARN
          ? 'Delivery is getting more expensive at the same scale.'
          : 'Media cost is stable.',
    },
    {
      key: 'frequency',
      label: 'Frequency',
      reading: `${round(freq, 1)}x`,
      breached: freq >= THRESHOLDS.FREQ_WARN,
      note:
        freq >= THRESHOLDS.FREQ_SEVERE
          ? 'Past the cliff — the same people are seeing this repeatedly.'
          : freq >= THRESHOLDS.FREQ_WARN
            ? 'Rising exposure to the same audience.'
            : 'Healthy exposure spread.',
    },
    {
      key: 'cpaInflation',
      label: 'CPA inflation',
      reading: pctUp(cpaInflation),
      breached: cpaInflation >= THRESHOLDS.CPA_INFLATION_WARN,
      note:
        cpaInflation >= THRESHOLDS.CPA_INFLATION_WARN
          ? 'Cost per result is climbing — fatigue has reached the money metric.'
          : 'Cost per result is under control.',
    },
  ];

  if (hookDecay !== null) {
    signals.push({
      key: 'hookDecay',
      label: 'Hook rate',
      reading: pct(hookDecay),
      breached: hookDecay >= THRESHOLDS.HOOK_DECAY_WARN,
      note:
        hookDecay >= THRESHOLDS.HOOK_DECAY_WARN
          ? 'The first three seconds have stopped stopping the scroll.'
          : 'The opening is still holding attention.',
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Composite score & status.
// ---------------------------------------------------------------------------

/**
 * Weighted composite fatigue score (0–100). Leading indicators (CTR, frequency,
 * hook) carry more weight than the lagging CPA signal, because acting on the
 * lagging metric alone means acting too late.
 */
function compositeScore(m: DailyMetric[]): number {
  const base = baselineSlice(m);
  const recent = recentSlice(m);

  const ctrDecayRaw = clamp(decline(ctr(base), ctr(recent)), 0, 1);
  // CTR is the primary early signal. Map it so that reaching the warn threshold
  // already contributes meaningfully, and a severe drop saturates the term.
  // Below warn → ramps 0→0.5; between warn and severe → ramps 0.5→1.0.
  let ctrN: number;
  if (ctrDecayRaw <= THRESHOLDS.CTR_DECAY_WARN) {
    ctrN = (ctrDecayRaw / THRESHOLDS.CTR_DECAY_WARN) * 0.5;
  } else {
    const span = THRESHOLDS.CTR_DECAY_SEVERE - THRESHOLDS.CTR_DECAY_WARN;
    ctrN = 0.5 + clamp((ctrDecayRaw - THRESHOLDS.CTR_DECAY_WARN) / span, 0, 1) * 0.5;
  }

  const cpmRiseN = clamp(rise(cpm(base), cpm(recent)) / 0.4, 0, 1);
  const cpaInflN = clamp(rise(cpa(base), cpa(recent)) / 0.5, 0, 1);
  const freq = currentFrequency(m);
  // Normalise frequency onto 0–1 across the warn→severe band. A creative at the
  // warn threshold contributes a partial signal; at/above severe it saturates.
  const freqN = clamp((freq - THRESHOLDS.FREQ_WARN) / (THRESHOLDS.FREQ_SEVERE - THRESHOLDS.FREQ_WARN), 0, 1);

  const baseHook = hookRate(base);
  const recentHook = hookRate(recent);
  const hookDecayN =
    baseHook !== null && recentHook !== null
      ? clamp(decline(baseHook, recentHook) / THRESHOLDS.HOOK_DECAY_WARN, 0, 1)
      : 0;

  // Weights sum to 1. CTR + frequency + hook = leading (0.75); CPM + CPA = lagging (0.25).
  const score =
    ctrN * 0.35 +
    freqN * 0.25 +
    hookDecayN * 0.15 +
    cpmRiseN * 0.1 +
    cpaInflN * 0.15;

  return round(clamp(score * 100, 0, 100), 0);
}

function statusFromScore(score: number): FatigueStatus {
  if (score >= THRESHOLDS.SCORE_DEAD) return 'dead';
  if (score >= THRESHOLDS.SCORE_FATIGUED) return 'fatigued';
  if (score >= THRESHOLDS.SCORE_WARNING) return 'warning';
  return 'healthy';
}

// ---------------------------------------------------------------------------
// Cliff forecast — the signature feature.
// ---------------------------------------------------------------------------

/**
 * Project days until the performance cliff by fitting the recent CTR decay slope
 * and extrapolating to a "cliff CTR" (defined as 55% of peak — the point where
 * decline typically turns non-linear). Deliberately simple and explainable: a
 * linear slope on a daily series, not a black box.
 *
 * Returns null when there isn't enough data, CTR is flat/improving, or the
 * creative is already below the cliff (handled by the caller as "dead").
 */
export function forecastDaysUntilCliff(m: DailyMetric[]): number | null {
  if (m.length < THRESHOLDS.BASELINE_WINDOW + 1) return null;

  const peak = ctr(baselineSlice(m));
  if (peak === 0) return null;

  // Daily CTR series over the trailing window used to estimate the slope.
  const trailing = m.slice(-Math.max(THRESHOLDS.RECENT_WINDOW, 4));
  const series = trailing.map((d) => safeDiv(d.clicks, d.impressions));

  // Least-squares slope of CTR vs. day index.
  const n = series.length;
  const xs = series.map((_, i) => i);
  const meanX = sum(xs) / n;
  const meanY = sum(series) / n;
  const cov = sum(xs.map((x, i) => (x - meanX) * (series[i] - meanY)));
  const varX = sum(xs.map((x) => (x - meanX) ** 2));
  const slope = varX === 0 ? 0 : cov / varX; // CTR change per day (negative when decaying)

  if (slope >= 0) return null; // stable or improving — no cliff in sight

  const cliffCtr = peak * 0.55;
  const currentCtr = series[series.length - 1];
  if (currentCtr <= cliffCtr) return 0; // already at/over the cliff

  const days = (currentCtr - cliffCtr) / -slope;
  return round(clamp(days, 0, 60), 1);
}

// ---------------------------------------------------------------------------
// Wasted spend — dollars lost since decay began.
// ---------------------------------------------------------------------------

/**
 * Estimate spend wasted since fatigue onset. Onset = first recent day whose CTR
 * fell below (peak × (1 − CTR_DECAY_WARN)). From that day on, the "waste" is the
 * spend that produced the below-baseline efficiency gap, approximated as the
 * spend scaled by the fractional CTR shortfall vs. baseline.
 */
export function estimateWastedSpend(m: DailyMetric[]): number {
  const peak = ctr(baselineSlice(m));
  if (peak === 0) return 0;

  const onsetCtr = peak * (1 - THRESHOLDS.CTR_DECAY_WARN);
  let waste = 0;
  let decaying = false;

  for (const d of m) {
    const dayCtr = safeDiv(d.clicks, d.impressions);
    if (!decaying && dayCtr < onsetCtr) decaying = true;
    if (decaying) {
      const shortfall = clamp((peak - dayCtr) / peak, 0, 1);
      waste += d.spend * shortfall;
    }
  }
  return round(waste, 2);
}

// ---------------------------------------------------------------------------
// Recommendation copy — interface voice, active, specific.
// ---------------------------------------------------------------------------

function recommend(status: FatigueStatus, daysUntilCliff: number | null): string {
  switch (status) {
    case 'dead':
      return 'Pause this creative now and promote a fresh angle from the queue.';
    case 'fatigued':
      return 'Rotate this out within 24 hours. Generate refresh angles below.';
    case 'warning':
      return daysUntilCliff !== null
        ? `Stage a replacement — projected to hit the cliff in ~${Math.round(daysUntilCliff)} days.`
        : 'Watch closely and prepare a fresh angle to queue.';
    case 'healthy':
    default:
      return 'Performing well. Keep running and keep the winner in your library.';
  }
}

// ---------------------------------------------------------------------------
// Public API: diagnose one creative, and roll up an account.
// ---------------------------------------------------------------------------

export function diagnose(creative: Creative): Diagnosis {
  const m = creative.metrics;
  const signals = buildSignals(m);
  const score = compositeScore(m);
  const status = statusFromScore(score);

  const peakCtr = round(ctr(baselineSlice(m)), 4);
  const currentCtr = round(ctr(recentSlice(m)), 4);

  // A dead creative has no meaningful "days until cliff" — it's already there.
  const daysUntilCliff = status === 'dead' ? 0 : forecastDaysUntilCliff(m);

  return {
    creativeId: creative.id,
    status,
    score,
    signals,
    daysUntilCliff,
    wastedSpend: estimateWastedSpend(m),
    recommendation: recommend(status, daysUntilCliff),
    peakCtr,
    currentCtr,
  };
}

export function summariseAccount(creatives: Creative[]): AccountSummary {
  const diagnoses = creatives.map(diagnose);
  const byStatus: Record<FatigueStatus, number> = { healthy: 0, warning: 0, fatigued: 0, dead: 0 };
  for (const d of diagnoses) byStatus[d.status] += 1;

  const totalSpend = round(
    sum(creatives.flatMap((c) => c.metrics.map((m) => m.spend))),
    2,
  );

  return {
    totalCreatives: creatives.length,
    byStatus,
    totalWastedSpend: round(sum(diagnoses.map((d) => d.wastedSpend)), 2),
    totalSpend,
    imminentCliffs: diagnoses.filter(
      (d) => d.daysUntilCliff !== null && d.daysUntilCliff <= 3 && d.status !== 'healthy',
    ).length,
  };
}
