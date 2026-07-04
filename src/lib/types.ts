/**
 * Core domain types for AdSignal.
 *
 * A `Creative` is a single ad (one image/video + copy) running inside an ad set.
 * We reason about fatigue at the creative level because campaign- and adset-level
 * averages hide the exact asset that is decaying — per-ad visibility is the whole point.
 */

export type Platform = 'meta' | 'tiktok' | 'google' | 'taboola';

/** One day of delivery metrics for a single creative. */
export interface DailyMetric {
  /** ISO date, e.g. "2026-06-14". */
  date: string;
  impressions: number;
  clicks: number;
  /** Ad spend in account currency for the day. */
  spend: number;
  /** Conversions (leads/purchases) attributed to the day. */
  conversions: number;
  /**
   * Average impressions per unique user on the day.
   * Frequency is the pressure gauge: the same person seeing the same ad repeatedly
   * is what drives audience-level fatigue.
   */
  frequency: number;
  /**
   * Thumb-stop / hook rate for video (share of impressions that watch past 3s),
   * expressed 0–1. Optional because static creatives have no hook rate.
   */
  hookRate?: number;
}

export interface Creative {
  id: string;
  name: string;
  platform: Platform;
  /** Format drives fatigue speed — short-form video burns faster than static. */
  format: 'video' | 'static' | 'carousel';
  /** The messaging angle this creative uses. Angle diversity is the real lever. */
  angle: string;
  /** Chronologically ordered daily metrics, oldest first. */
  metrics: DailyMetric[];
}

/** Fatigue classification, ordered by severity. */
export type FatigueStatus = 'healthy' | 'warning' | 'fatigued' | 'dead';

/** A single named signal that fed the diagnosis, with a human-readable reading. */
export interface Signal {
  key: 'ctrDecay' | 'cpmRise' | 'frequency' | 'hookDecay' | 'cpaInflation';
  label: string;
  /** Formatted value shown in the UI, e.g. "-22%" or "3.8x". */
  reading: string;
  /** Whether this individual signal has breached its threshold. */
  breached: boolean;
  /** Short plain-English explanation of what the reading means. */
  note: string;
}

export interface Diagnosis {
  creativeId: string;
  status: FatigueStatus;
  /** 0–100 composite fatigue score; higher = more fatigued. */
  score: number;
  signals: Signal[];
  /**
   * Projected days until the creative hits the performance "cliff"
   * (rapid, non-linear collapse). null when not enough data or already dead.
   */
  daysUntilCliff: number | null;
  /**
   * Estimated ad spend already wasted since decay began, in account currency.
   * Founders think in dollars — this makes the cost of inaction visible.
   */
  wastedSpend: number;
  /** One-line recommended action in the interface's own voice. */
  recommendation: string;
  /** Peak CTR observed in the baseline window, for chart annotation. */
  peakCtr: number;
  /** Most recent CTR, for chart annotation. */
  currentCtr: number;
}

/** Account-level rollup for the dashboard header. */
export interface AccountSummary {
  totalCreatives: number;
  byStatus: Record<FatigueStatus, number>;
  totalWastedSpend: number;
  /** Total spend across all creatives in the loaded window. */
  totalSpend: number;
  /** Creatives projected to hit the cliff within 3 days. */
  imminentCliffs: number;
}
