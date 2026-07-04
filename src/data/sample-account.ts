import type { Creative, DailyMetric, Platform } from '../lib/types';

/**
 * Sample account: a lean DTC lead-gen advertiser running across Meta, TikTok,
 * Google, and Taboola — mirroring the contest brief's stated stack. The shapes
 * are hand-designed so the dashboard shows the full spectrum of fatigue states
 * on load, with realistic CTR/CPM/frequency dynamics per platform.
 *
 * This is deterministic: no randomness, so the demo looks identical every time.
 */

interface Shape {
  id: string;
  name: string;
  platform: Platform;
  format: Creative['format'];
  angle: string;
  /** Daily CTR trajectory (length defines the window). */
  ctr: number[];
  /** Daily frequency trajectory. */
  freq: number[];
  /** Daily impressions (kept roughly flat to isolate creative effects). */
  impr: number;
  /** Daily spend. */
  spend: number;
  /** Baseline conversions/day, scaled down as CTR decays. */
  baseConv: number;
  /** Optional hook-rate trajectory for video. */
  hook?: number[];
  startDate: string;
}

function buildMetrics(s: Shape): DailyMetric[] {
  const start = new Date(s.startDate + 'T00:00:00Z');
  return s.ctr.map((c, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const clicks = Math.round(s.impr * c);
    // Conversions loosely track CTR health so CPA inflates as fatigue sets in.
    const health = c / s.ctr[0];
    const conversions = Math.max(1, Math.round(s.baseConv * health));
    return {
      date: iso,
      impressions: s.impr,
      clicks,
      spend: s.spend,
      conversions,
      frequency: s.freq[i],
      ...(s.hook ? { hookRate: s.hook[i] } : {}),
    };
  });
}

const SHAPES: Shape[] = [
  // Healthy Meta static — flat CTR, low frequency.
  {
    id: 'cr_meta_founder',
    name: 'Founder story — "Why I built this"',
    platform: 'meta',
    format: 'static',
    angle: 'founder-story',
    ctr: [0.021, 0.022, 0.021, 0.0215, 0.021, 0.022, 0.0218],
    freq: [1.3, 1.4, 1.5, 1.55, 1.6, 1.62, 1.68],
    impr: 42000,
    spend: 620,
    baseConv: 38,
    startDate: '2026-06-14',
  },
  // Warning TikTok video — CTR sliding, frequency climbing, hook softening.
  {
    id: 'cr_tt_ugc',
    name: 'UGC unboxing — creator #3',
    platform: 'tiktok',
    format: 'video',
    angle: 'social-proof',
    ctr: [0.019, 0.019, 0.0182, 0.017, 0.016, 0.0152, 0.0146],
    freq: [1.9, 2.1, 2.35, 2.55, 2.7, 2.85, 2.95],
    hook: [0.34, 0.33, 0.31, 0.29, 0.27, 0.255, 0.24],
    impr: 88000,
    spend: 540,
    baseConv: 44,
    startDate: '2026-06-14',
  },
  // Fatigued Meta video — steeper decline, frequency near cliff.
  {
    id: 'cr_meta_problem',
    name: 'Problem-agitation — "Still doing this manually?"',
    platform: 'meta',
    format: 'video',
    angle: 'problem-agitation',
    ctr: [0.023, 0.022, 0.0195, 0.017, 0.0145, 0.0128, 0.0115],
    freq: [2.2, 2.6, 2.9, 3.2, 3.4, 3.6, 3.75],
    hook: [0.36, 0.34, 0.30, 0.26, 0.22, 0.19, 0.17],
    impr: 76000,
    spend: 710,
    baseConv: 52,
    startDate: '2026-06-14',
  },
  // Dead Taboola native — collapsed CTR, high frequency, CPA blown out.
  {
    id: 'cr_tab_listicle',
    name: 'Advertorial — "7 tools that replaced my agency"',
    platform: 'taboola',
    format: 'static',
    angle: 'listicle',
    ctr: [0.014, 0.013, 0.011, 0.0085, 0.0065, 0.005, 0.0042],
    freq: [2.8, 3.2, 3.6, 3.9, 4.2, 4.5, 4.7],
    impr: 120000,
    spend: 480,
    baseConv: 30,
    startDate: '2026-06-14',
  },
  // Healthy Google discovery — steady, mid frequency.
  {
    id: 'cr_ggl_benefit',
    name: 'Benefit-led — "Catch fatigue 5 days sooner"',
    platform: 'google',
    format: 'static',
    angle: 'benefit-led',
    ctr: [0.026, 0.025, 0.026, 0.0255, 0.0262, 0.0258, 0.026],
    freq: [1.5, 1.6, 1.65, 1.7, 1.72, 1.75, 1.78],
    impr: 34000,
    spend: 430,
    baseConv: 29,
    startDate: '2026-06-14',
  },
  // Warning Meta carousel — gentle decay, frequency rising past warn.
  {
    id: 'cr_meta_data',
    name: 'Data-driven — "70% of performance is creative"',
    platform: 'meta',
    format: 'carousel',
    angle: 'data-driven',
    ctr: [0.02, 0.0198, 0.019, 0.0182, 0.0172, 0.0165, 0.0159],
    freq: [1.8, 2.0, 2.25, 2.45, 2.6, 2.72, 2.82],
    impr: 51000,
    spend: 560,
    baseConv: 40,
    startDate: '2026-06-14',
  },
  // Fatigued TikTok video — fast burn typical of short-form.
  {
    id: 'cr_tt_trend',
    name: 'Trend-jack — "POV: your ROAS tanked"',
    platform: 'tiktok',
    format: 'video',
    angle: 'trend-jack',
    ctr: [0.024, 0.022, 0.0185, 0.015, 0.0125, 0.0108, 0.0098],
    freq: [2.4, 2.9, 3.3, 3.6, 3.9, 4.1, 4.3],
    hook: [0.4, 0.37, 0.32, 0.27, 0.23, 0.20, 0.18],
    impr: 95000,
    spend: 650,
    baseConv: 48,
    startDate: '2026-06-14',
  },
  // Healthy Taboola native — stable performer.
  {
    id: 'cr_tab_case',
    name: 'Case study — "How a 2-person team scaled spend"',
    platform: 'taboola',
    format: 'static',
    angle: 'case-study',
    ctr: [0.016, 0.0162, 0.0158, 0.016, 0.0159, 0.0161, 0.016],
    freq: [1.9, 2.0, 2.05, 2.1, 2.12, 2.15, 2.18],
    impr: 98000,
    spend: 400,
    baseConv: 33,
    startDate: '2026-06-14',
  },
];

export const SAMPLE_CREATIVES: Creative[] = SHAPES.map((s) => ({
  id: s.id,
  name: s.name,
  platform: s.platform,
  format: s.format,
  angle: s.angle,
  metrics: buildMetrics(s),
}));

/** Product/offer context used to ground AI angle generation for the sample account. */
export const SAMPLE_OFFER =
  'AdSignal is a creative-fatigue early-warning tool for lean performance media buyers. ' +
  'It catches ad decay days before CPA rises and generates fresh, distinct angles to test. ' +
  'Audience: in-house media buyers and small DTC/lead-gen teams spending across Meta, TikTok, Google, and Taboola.';
