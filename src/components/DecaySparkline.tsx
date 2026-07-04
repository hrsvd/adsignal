'use client';

import type { DailyMetric } from '@/lib/types';

/**
 * The signature visual: a compact CTR sparkline that draws the actual decay
 * curve, marks the peak baseline, and projects a dotted line to the cliff point.
 * Pure inline SVG — no chart lib needed, so it renders instantly and scales.
 */
export function DecaySparkline({
  metrics,
  color,
  daysUntilCliff,
  width = 220,
  height = 64,
}: {
  metrics: DailyMetric[];
  color: string;
  daysUntilCliff: number | null;
  width?: number;
  height?: number;
}) {
  const series = metrics.map((m) => (m.impressions ? m.clicks / m.impressions : 0));
  if (series.length < 2) return null;

  const pad = 6;
  const w = width;
  const h = height;

  // Baseline peak = mean of first 3 points.
  const peak = series.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, series.length);
  const cliffCtr = peak * 0.55;

  // Project future points if we have a forecast.
  const projected: number[] = [];
  if (daysUntilCliff !== null && daysUntilCliff > 0) {
    const last = series[series.length - 1];
    const steps = Math.min(Math.ceil(daysUntilCliff), 8);
    const slope = (cliffCtr - last) / steps;
    for (let i = 1; i <= steps; i++) projected.push(last + slope * i);
  }

  const all = [...series, ...projected, peak, cliffCtr];
  const max = Math.max(...all) * 1.08;
  const min = Math.min(...all) * 0.92;
  const range = max - min || 1;
  const totalPts = series.length + projected.length;

  const x = (i: number) => pad + (i / Math.max(1, totalPts - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - pad * 2);

  const solidPath = series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
  const projPath =
    projected.length > 0
      ? `M ${x(series.length - 1)} ${y(series[series.length - 1])} ` +
        projected.map((v, i) => `L ${x(series.length + i)} ${y(v)}`).join(' ')
      : '';

  const areaPath =
    solidPath +
    ` L ${x(series.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`;

  const cliffY = y(cliffCtr);
  const gradId = `g-${color.replace(/[^a-z0-9]/gi, '')}-${width}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`CTR trend, ${daysUntilCliff === null ? 'stable' : `cliff in about ${Math.round(daysUntilCliff)} days`}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Cliff threshold line */}
      <line
        x1={pad}
        y1={cliffY}
        x2={w - pad}
        y2={cliffY}
        stroke="var(--fatigued)"
        strokeWidth="1"
        strokeDasharray="2 3"
        opacity="0.5"
      />

      {/* Area under the actual curve */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Actual decay curve */}
      <path d={solidPath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Projected path to the cliff */}
      {projPath && (
        <path
          d={projPath}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="3 3"
          opacity="0.65"
          strokeLinecap="round"
        />
      )}

      {/* Current point */}
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="3" fill={color} />

      {/* Cliff endpoint marker */}
      {projected.length > 0 && (
        <circle
          cx={x(totalPts - 1)}
          cy={y(projected[projected.length - 1])}
          r="3"
          fill="none"
          stroke="var(--fatigued)"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
