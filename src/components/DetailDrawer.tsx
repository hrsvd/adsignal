'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import type { Creative, Diagnosis } from '@/lib/types';
import type { RefreshAngle } from '@/lib/ai-angles';
import { STATUS_META, PLATFORM_LABEL, money, moneyPrecise, pct, cliffLabel } from '@/lib/format';

/** Full-detail side drawer for one creative. */
export function DetailDrawer({
  creative,
  diagnosis,
  offer,
  onClose,
}: {
  creative: Creative;
  diagnosis: Diagnosis;
  offer: string;
  onClose: () => void;
}) {
  const [angles, setAngles] = useState<RefreshAngle[] | null>(null);
  const [mode, setMode] = useState<'live' | 'demo' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = STATUS_META[diagnosis.status];

  const chartData = creative.metrics.map((m) => ({
    date: m.date.slice(5),
    ctr: m.impressions ? Number(((m.clicks / m.impressions) * 100).toFixed(3)) : 0,
    frequency: Number(m.frequency.toFixed(2)),
  }));

  const cliffCtr = Number((diagnosis.peakCtr * 0.55 * 100).toFixed(3));

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creative, offer, count: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setAngles(data.angles);
      setMode(data.mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${creative.name} details`}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="dh-tags">
              <span className="platform mono">{PLATFORM_LABEL[creative.platform]}</span>
              <span className="status" style={{ color: meta.color, background: meta.tint }}>
                {meta.label} · {diagnosis.score}/100
              </span>
            </div>
            <h2>{creative.name}</h2>
          </div>
          <button className="close" onClick={onClose} aria-label="Close details">
            ✕
          </button>
        </div>

        <div className="rec" style={{ borderColor: meta.color, background: meta.tint }}>
          <span className="rec-dot" style={{ background: meta.color }} />
          {diagnosis.recommendation}
        </div>

        <div className="kpis">
          <div className="kpi">
            <span className="k-label">Days to cliff</span>
            <span className="k-value mono" style={{ color: meta.color }}>
              {cliffLabel(diagnosis.daysUntilCliff)}
            </span>
          </div>
          <div className="kpi">
            <span className="k-label">Spend wasted</span>
            <span className="k-value mono" style={{ color: 'var(--fatigued)' }}>
              {money(diagnosis.wastedSpend)}
            </span>
          </div>
          <div className="kpi">
            <span className="k-label">Peak → now CTR</span>
            <span className="k-value mono">
              {pct(diagnosis.peakCtr)} → {pct(diagnosis.currentCtr)}
            </span>
          </div>
        </div>

        <section className="block">
          <h3>CTR decay & the cliff</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--line-soft)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-mute)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-mute)" fontSize={11} tickLine={false} width={44} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--panel-2)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'var(--text-dim)' }}
                />
                <ReferenceLine
                  y={cliffCtr}
                  stroke="var(--fatigued)"
                  strokeDasharray="3 3"
                  label={{ value: 'cliff', fill: 'var(--fatigued)', fontSize: 10, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="ctr"
                  name="CTR %"
                  stroke={meta.color}
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="block">
          <h3>Signals</h3>
          <div className="signals">
            {diagnosis.signals.map((s) => (
              <div className="signal" key={s.key}>
                <div className="s-top">
                  <span className="s-label">{s.label}</span>
                  <span
                    className="s-reading mono"
                    style={{ color: s.breached ? 'var(--fatigued)' : 'var(--healthy)' }}
                  >
                    {s.reading}
                    {s.breached && <span className="flag">breached</span>}
                  </span>
                </div>
                <div className="s-note">{s.note}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="block">
          <div className="gen-head">
            <h3>Refresh angles</h3>
            <button className="gen-btn" onClick={generate} disabled={loading}>
              {loading ? 'Generating…' : angles ? 'Regenerate' : 'Generate angles'}
            </button>
          </div>
          <p className="gen-sub">
            Distinct angles that reset fatigue — not cosmetic variations of the tired one.
          </p>

          {error && <div className="error">{error}</div>}

          {loading && (
            <div className="skeletons">
              {[0, 1, 2].map((i) => (
                <div className="skel" key={i} />
              ))}
            </div>
          )}

          {angles && !loading && (
            <>
              {mode === 'demo' && (
                <div className="mode-note">
                  Demo mode — deterministic sample angles. Set an Anthropic API key for live Claude generation.
                </div>
              )}
              <div className="angles">
                {angles.map((a, i) => (
                  <div className="angle-card" key={i} style={{ animationDelay: `${i * 50}ms` }}>
                    <span className="a-angle mono">{a.angle}</span>
                    <div className="a-hook">“{a.hook}”</div>
                    <div className="a-line">
                      <span className="a-tag">Headline</span> {a.headline}
                    </div>
                    <div className="a-line">
                      <span className="a-tag">Body</span> {a.body}
                    </div>
                    <div className="a-line">
                      <span className="a-tag">CTA</span> {a.cta}
                    </div>
                    <div className="a-rationale">{a.rationale}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(4, 8, 16, 0.6);
          backdrop-filter: blur(3px);
          z-index: 50;
          display: flex;
          justify-content: flex-end;
          animation: rise 0.2s ease;
        }
        .drawer {
          width: min(560px, 100%);
          height: 100%;
          background: var(--bg);
          border-left: 1px solid var(--line);
          overflow-y: auto;
          padding: 24px 26px 60px;
          box-shadow: -20px 0 60px rgba(0, 0, 0, 0.4);
        }
        .drawer-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .dh-tags {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }
        .platform {
          font-size: 11px;
          color: var(--accent);
          background: var(--accent-tint);
          padding: 2px 7px;
          border-radius: 5px;
        }
        .status {
          font-size: 11px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 20px;
        }
        h2 {
          font-size: 20px;
          line-height: 1.25;
        }
        .close {
          background: var(--panel);
          border: 1px solid var(--line);
          color: var(--text-dim);
          width: 32px;
          height: 32px;
          border-radius: 8px;
          font-size: 13px;
          flex: none;
          transition: all 0.15s ease;
        }
        .close:hover {
          border-color: var(--fatigued);
          color: var(--fatigued);
        }
        .rec {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid;
          border-radius: var(--radius-sm);
          padding: 12px 14px;
          font-size: 13.5px;
          font-weight: 500;
          margin-bottom: 18px;
        }
        .rec-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex: none;
        }
        .kpis {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 22px;
        }
        .kpi {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 12px 14px;
        }
        .k-label {
          display: block;
          font-size: 10px;
          color: var(--text-mute);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .k-value {
          font-size: 17px;
          font-weight: 600;
        }
        .block {
          margin-bottom: 26px;
        }
        .block h3 {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-dim);
          margin-bottom: 12px;
        }
        .chart-wrap {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 14px 10px 8px;
        }
        .signals {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .signal {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 11px 14px;
        }
        .s-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3px;
        }
        .s-label {
          font-size: 13px;
          font-weight: 500;
        }
        .s-reading {
          font-size: 14px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .flag {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--fatigued-tint);
          color: var(--fatigued);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: var(--font-body);
        }
        .s-note {
          font-size: 12px;
          color: var(--text-mute);
        }
        .gen-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .gen-btn {
          background: var(--accent);
          color: #04121a;
          border: none;
          border-radius: var(--radius-sm);
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .gen-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .gen-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .gen-sub {
          font-size: 12.5px;
          color: var(--text-mute);
          margin: 6px 0 14px;
        }
        .mode-note {
          font-size: 11.5px;
          color: var(--warning);
          background: var(--warning-tint);
          border-radius: 6px;
          padding: 8px 11px;
          margin-bottom: 12px;
        }
        .error {
          font-size: 12.5px;
          color: var(--fatigued);
          background: var(--fatigued-tint);
          border-radius: 6px;
          padding: 10px 12px;
          margin-bottom: 12px;
        }
        .skeletons,
        .angles {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .skel {
          height: 96px;
          border-radius: var(--radius-sm);
          background: linear-gradient(90deg, var(--panel) 25%, var(--panel-2) 37%, var(--panel) 63%);
          background-size: 800px 100%;
          animation: shimmer 1.3s infinite linear;
        }
        .angle-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 14px 16px;
          animation: rise 0.35s ease both;
        }
        .a-angle {
          display: inline-block;
          font-size: 11px;
          color: var(--accent);
          background: var(--accent-tint);
          padding: 2px 8px;
          border-radius: 5px;
          margin-bottom: 8px;
        }
        .a-hook {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
          line-height: 1.35;
          margin-bottom: 10px;
          color: var(--text);
        }
        .a-line {
          font-size: 13px;
          color: var(--text-dim);
          margin-bottom: 5px;
          line-height: 1.45;
        }
        .a-tag {
          display: inline-block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-mute);
          min-width: 58px;
        }
        .a-rationale {
          font-size: 12px;
          color: var(--text-mute);
          font-style: italic;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--line-soft);
        }
      `}</style>
    </div>
  );
}
