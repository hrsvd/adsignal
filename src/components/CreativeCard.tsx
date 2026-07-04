'use client';

import type { Creative, Diagnosis } from '@/lib/types';
import { STATUS_META, PLATFORM_LABEL, money, cliffLabel } from '@/lib/format';
import { DecaySparkline } from './DecaySparkline';

/**
 * A single creative's vitals card. Colour-coded by status, with the signature
 * decay sparkline, the cliff countdown, and the dollars-wasted readout.
 */
export function CreativeCard({
  creative,
  diagnosis,
  onSelect,
  index,
}: {
  creative: Creative;
  diagnosis: Diagnosis;
  onSelect: () => void;
  index: number;
}) {
  const meta = STATUS_META[diagnosis.status];
  const imminent =
    diagnosis.daysUntilCliff !== null && diagnosis.daysUntilCliff <= 3 && diagnosis.status !== 'healthy';

  return (
    <button
      className="card"
      onClick={onSelect}
      style={{ animationDelay: `${index * 40}ms` }}
      aria-label={`${creative.name}, status ${meta.label}. Open details.`}
    >
      <span className="edge" style={{ background: meta.color }} aria-hidden />

      <div className="head">
        <div className="tags">
          <span className="platform mono">{PLATFORM_LABEL[creative.platform]}</span>
          <span className="format">{creative.format}</span>
        </div>
        <span className="status" style={{ color: meta.color, background: meta.tint }}>
          {meta.label}
        </span>
      </div>

      <div className="name">{creative.name}</div>
      <div className="angle mono">angle: {creative.angle}</div>

      <div className="chart">
        <DecaySparkline
          metrics={creative.metrics}
          color={meta.color}
          daysUntilCliff={diagnosis.daysUntilCliff}
        />
      </div>

      <div className="metrics">
        <div className="metric">
          <span className="m-label">Cliff</span>
          <span className="m-value mono" style={{ color: imminent ? 'var(--warning)' : 'var(--text)' }}>
            {cliffLabel(diagnosis.daysUntilCliff)}
            {imminent && <span className="ping" style={{ background: 'var(--warning)' }} />}
          </span>
        </div>
        <div className="metric">
          <span className="m-label">Wasted</span>
          <span
            className="m-value mono"
            style={{ color: diagnosis.wastedSpend > 0 ? 'var(--fatigued)' : 'var(--text-mute)' }}
          >
            {money(diagnosis.wastedSpend)}
          </span>
        </div>
        <div className="metric">
          <span className="m-label">Score</span>
          <span className="m-value mono">{diagnosis.score}</span>
        </div>
      </div>

      <style jsx>{`
        .card {
          position: relative;
          text-align: left;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 16px 18px 14px 20px;
          overflow: hidden;
          transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
          animation: rise 0.4s ease both;
          color: var(--text);
          width: 100%;
        }
        .card:hover {
          border-color: var(--accent-dim);
          transform: translateY(-2px);
          box-shadow: var(--shadow);
        }
        .edge {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .tags {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .platform {
          font-size: 11px;
          color: var(--accent);
          background: var(--accent-tint);
          padding: 2px 7px;
          border-radius: 5px;
          letter-spacing: 0.02em;
        }
        .format {
          font-size: 11px;
          color: var(--text-mute);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .status {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 20px;
          letter-spacing: 0.02em;
        }
        .name {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          line-height: 1.3;
          margin-bottom: 4px;
          color: var(--text);
        }
        .angle {
          font-size: 11px;
          color: var(--text-mute);
          margin-bottom: 12px;
        }
        .chart {
          margin: 4px -4px 12px;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          border-top: 1px solid var(--line-soft);
          padding-top: 12px;
        }
        .metric {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .m-label {
          font-size: 10px;
          color: var(--text-mute);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .m-value {
          font-size: 15px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .ping {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          animation: pulse 1.4s ease-in-out infinite;
        }
      `}</style>
    </button>
  );
}
