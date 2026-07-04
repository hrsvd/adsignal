'use client';

import type { AccountSummary } from '@/lib/types';
import { STATUS_META, money } from '@/lib/format';

/**
 * Account KPI bar. Leads with wasted spend (the dollar figure a founder cares
 * about) and the count of imminent cliffs (the urgency).
 */
export function SummaryBar({ summary }: { summary: AccountSummary }) {
  const stats: { label: string; value: string; sub?: string; accent?: string }[] = [
    {
      label: 'Spend leaking to fatigue',
      value: money(summary.totalWastedSpend),
      sub: `of ${money(summary.totalSpend)} total`,
      accent: 'var(--fatigued)',
    },
    {
      label: 'Cliffs within 3 days',
      value: String(summary.imminentCliffs),
      sub: 'need a replacement queued',
      accent: 'var(--warning)',
    },
    {
      label: 'Creatives monitored',
      value: String(summary.totalCreatives),
      sub: 'across all platforms',
      accent: 'var(--accent)',
    },
  ];

  return (
    <div className="summary">
      <div className="summary-stats">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value mono" style={{ color: s.accent }}>
              {s.value}
            </div>
            {s.sub && <div className="stat-sub mono">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="status-legend">
        {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((k) => (
          <div className="legend-item" key={k}>
            <span className="dot" style={{ background: STATUS_META[k].color }} />
            <span className="legend-count mono">{summary.byStatus[k]}</span>
            <span className="legend-label">{STATUS_META[k].label}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .summary {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          align-items: stretch;
          justify-content: space-between;
        }
        .summary-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(160px, 1fr));
          gap: 14px;
          flex: 1 1 480px;
        }
        .stat {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 16px 18px;
          animation: rise 0.4s ease both;
        }
        .stat-label {
          font-size: 12px;
          color: var(--text-mute);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 8px;
        }
        .stat-value {
          font-size: 30px;
          font-weight: 600;
          line-height: 1;
        }
        .stat-sub {
          font-size: 12px;
          color: var(--text-dim);
          margin-top: 6px;
        }
        .status-legend {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 16px 20px;
          flex: 0 1 auto;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }
        .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex: none;
        }
        .legend-count {
          color: var(--text);
          font-weight: 600;
          min-width: 18px;
        }
        .legend-label {
          color: var(--text-dim);
        }
        @media (max-width: 560px) {
          .summary-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
