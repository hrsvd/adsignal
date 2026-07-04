'use client';

import { useMemo, useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { Creative, Diagnosis, FatigueStatus } from '@/lib/types';
import { diagnose, summariseAccount } from '@/lib/fatigue-engine';
import { SAMPLE_CREATIVES, SAMPLE_OFFER } from '@/data/sample-account';
import { STATUS_META, PLATFORM_LABEL } from '@/lib/format';
import { SummaryBar } from '@/components/SummaryBar';
import { CreativeCard } from '@/components/CreativeCard';
import { DetailDrawer } from '@/components/DetailDrawer';
import { NarrativePanel } from '@/components/NarrativePanel';

type SortKey = 'severity' | 'wasted' | 'cliff' | 'name';
type StatusFilter = FatigueStatus | 'all';

const SEVERITY_ORDER: Record<FatigueStatus, number> = { dead: 0, fatigued: 1, warning: 2, healthy: 3 };

export default function Dashboard() {
  const [creatives, setCreatives] = useState<Creative[] | null>(null);
  const [offer, setOffer] = useState<string>(SAMPLE_OFFER);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('severity');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Diagnose all creatives once, memoised.
  const diagnoses = useMemo(() => {
    if (!creatives) return new Map<string, Diagnosis>();
    return new Map(creatives.map((c) => [c.id, diagnose(c)]));
  }, [creatives]);

  const summary = useMemo(
    () => (creatives ? summariseAccount(creatives) : null),
    [creatives],
  );

  const visible = useMemo(() => {
    if (!creatives) return [];
    let list = creatives.filter((c) => {
      const d = diagnoses.get(c.id)!;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (query && !`${c.name} ${c.angle} ${c.platform}`.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const da = diagnoses.get(a.id)!;
      const db = diagnoses.get(b.id)!;
      switch (sort) {
        case 'severity':
          return SEVERITY_ORDER[da.status] - SEVERITY_ORDER[db.status] || db.score - da.score;
        case 'wasted':
          return db.wastedSpend - da.wastedSpend;
        case 'cliff':
          return (da.daysUntilCliff ?? 999) - (db.daysUntilCliff ?? 999);
        case 'name':
          return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [creatives, diagnoses, statusFilter, query, sort]);

  function loadSample() {
    setCreatives(SAMPLE_CREATIVES);
    setOffer(SAMPLE_OFFER);
    setUploadError(null);
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not parse the file.');
      setCreatives(data.creatives);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const selectedCreative = creatives?.find((c) => c.id === selected) ?? null;
  const selectedDiagnosis = selected ? diagnoses.get(selected) ?? null : null;

  return (
    <main className="page">
      <header className="top">
        <div className="brand">
          <span className="pulse-icon" aria-hidden>
            <span className="ring" />
            <span className="core" />
          </span>
          <div>
            <div className="logo">
              Ad<span className="logo-accent">Signal</span>
            </div>
            <div className="tag mono">creative fatigue · early-warning monitor</div>
          </div>
        </div>
        <div className="top-actions">
          <a
            className="ghost"
            href="https://github.com/your-handle/adsignal"
            target="_blank"
            rel="noreferrer"
          >
            View code
          </a>
        </div>
      </header>

      {!creatives ? (
        <section className="hero">
          <div className="hero-inner">
            <h1 className="hero-title">
              Your creatives are dying <span className="em">days before</span> your CPA report admits it.
            </h1>
            <p className="hero-sub">
              CTR decays first. Frequency creeps. By the time cost-per-result spikes, you&apos;ve already
              burned budget on an ad nobody&apos;s clicking. AdSignal watches the leading signals, forecasts
              the cliff, and writes you fresh angles to test.
            </p>
            <div className="hero-cta">
              <button className="primary" onClick={loadSample}>
                Load sample account
              </button>
              <button
                className="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Reading…' : 'Upload a CSV'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
            </div>
            {uploadError && <div className="hero-error">{uploadError}</div>}
            <div className="hero-hint mono">
              CSV columns: creative_id, creative_name, platform, format, angle, date, impressions, clicks,
              spend, conversions, frequency, hook_rate
            </div>
          </div>
        </section>
      ) : (
        <>
          {summary && <SummaryBar summary={summary} />}

          <div className="controls">
            <div className="search">
              <input
                placeholder="Search creatives, angles, platforms…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search creatives"
              />
            </div>

            <div className="filters">
              <div className="chip-row" role="group" aria-label="Filter by status">
                <button
                  className={`chip ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
                {(Object.keys(STATUS_META) as FatigueStatus[]).map((s) => (
                  <button
                    key={s}
                    className={`chip ${statusFilter === s ? 'active' : ''}`}
                    onClick={() => setStatusFilter(s)}
                    style={statusFilter === s ? { borderColor: STATUS_META[s].color, color: STATUS_META[s].color } : {}}
                  >
                    <span className="chip-dot" style={{ background: STATUS_META[s].color }} />
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>

              <select
                className="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort creatives"
              >
                <option value="severity">Sort: severity</option>
                <option value="wasted">Sort: spend wasted</option>
                <option value="cliff">Sort: nearest cliff</option>
                <option value="name">Sort: name</option>
              </select>
            </div>
          </div>

          <div className="layout">
            <div className="grid">
              {visible.length === 0 ? (
                <div className="no-results">
                  No creatives match those filters. Clear the search or pick a different status.
                </div>
              ) : (
                visible.map((c, i) => (
                  <CreativeCard
                    key={c.id}
                    creative={c}
                    diagnosis={diagnoses.get(c.id)!}
                    onSelect={() => setSelected(c.id)}
                    index={i}
                  />
                ))
              )}
            </div>

            <aside className="side">
              <NarrativePanel creatives={creatives} />
              <div className="reset">
                <button className="reset-btn" onClick={() => setCreatives(null)}>
                  ← Load a different account
                </button>
              </div>
            </aside>
          </div>
        </>
      )}

      {selectedCreative && selectedDiagnosis && (
        <DetailDrawer
          creative={selectedCreative}
          diagnosis={selectedDiagnosis}
          offer={offer}
          onClose={() => setSelected(null)}
        />
      )}

      <footer className="foot mono">
        AdSignal · leading-indicator fatigue detection · built for performance media buyers
      </footer>

      <style jsx>{`
        .page {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto;
          padding: 22px 24px 40px;
        }
        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pulse-icon {
          position: relative;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
        }
        .ring {
          position: absolute;
          inset: 0;
          border: 2px solid var(--accent);
          border-radius: 50%;
          opacity: 0.35;
          animation: pulse 2s ease-in-out infinite;
        }
        .core {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent);
        }
        .logo {
          font-family: var(--font-display);
          font-size: 21px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .logo-accent {
          color: var(--accent);
        }
        .tag {
          font-size: 11px;
          color: var(--text-mute);
          letter-spacing: 0.02em;
        }
        .ghost {
          font-size: 13px;
          color: var(--text-dim);
          border: 1px solid var(--line);
          padding: 7px 14px;
          border-radius: var(--radius-sm);
          transition: all 0.15s ease;
        }
        .ghost:hover {
          border-color: var(--accent-dim);
          color: var(--accent);
        }

        .hero {
          min-height: 62vh;
          display: grid;
          place-items: center;
          text-align: center;
        }
        .hero-inner {
          max-width: 680px;
          animation: rise 0.5s ease both;
        }
        .hero-title {
          font-size: clamp(28px, 5vw, 46px);
          line-height: 1.1;
          letter-spacing: -0.025em;
          margin-bottom: 20px;
        }
        .em {
          color: var(--warning);
        }
        .hero-sub {
          font-size: 16px;
          line-height: 1.6;
          color: var(--text-dim);
          margin: 0 auto 30px;
          max-width: 580px;
        }
        .hero-cta {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .primary {
          background: var(--accent);
          color: #04121a;
          border: none;
          border-radius: var(--radius-sm);
          padding: 13px 26px;
          font-size: 15px;
          font-weight: 600;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(77, 208, 225, 0.25);
        }
        .secondary {
          background: var(--panel);
          color: var(--text);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 13px 26px;
          font-size: 15px;
          font-weight: 600;
          transition: border-color 0.15s ease;
        }
        .secondary:hover:not(:disabled) {
          border-color: var(--accent-dim);
        }
        .secondary:disabled {
          opacity: 0.6;
        }
        .hero-error {
          margin-top: 18px;
          font-size: 13px;
          color: var(--fatigued);
          background: var(--fatigued-tint);
          display: inline-block;
          padding: 10px 14px;
          border-radius: 8px;
        }
        .hero-hint {
          margin-top: 26px;
          font-size: 11px;
          color: var(--text-mute);
          line-height: 1.6;
          max-width: 560px;
          margin-left: auto;
          margin-right: auto;
        }

        .controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin: 26px 0 18px;
          flex-wrap: wrap;
        }
        .search input {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          color: var(--text);
          font-size: 14px;
          width: 300px;
          max-width: 100%;
          transition: border-color 0.15s ease;
        }
        .search input:focus {
          border-color: var(--accent-dim);
          outline: none;
        }
        .search input::placeholder {
          color: var(--text-mute);
        }
        .filters {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .chip-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .chip {
          background: var(--panel);
          border: 1px solid var(--line);
          color: var(--text-dim);
          border-radius: 20px;
          padding: 7px 13px;
          font-size: 12.5px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: all 0.15s ease;
        }
        .chip:hover {
          border-color: var(--accent-dim);
        }
        .chip.active {
          background: var(--panel-2);
          color: var(--text);
          border-color: var(--accent-dim);
        }
        .chip-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .sort {
          background: var(--panel);
          border: 1px solid var(--line);
          color: var(--text-dim);
          border-radius: var(--radius-sm);
          padding: 9px 12px;
          font-size: 13px;
          font-family: inherit;
        }
        .sort:focus {
          outline: none;
          border-color: var(--accent-dim);
        }

        .layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 20px;
          align-items: start;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 14px;
        }
        .side {
          position: sticky;
          top: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .no-results {
          grid-column: 1 / -1;
          text-align: center;
          color: var(--text-mute);
          font-size: 14px;
          padding: 60px 20px;
          border: 1px dashed var(--line);
          border-radius: var(--radius);
        }
        .reset-btn {
          width: 100%;
          background: transparent;
          border: 1px solid var(--line);
          color: var(--text-dim);
          border-radius: var(--radius-sm);
          padding: 11px;
          font-size: 13px;
          transition: all 0.15s ease;
        }
        .reset-btn:hover {
          border-color: var(--accent-dim);
          color: var(--accent);
        }

        .foot {
          margin-top: 44px;
          padding-top: 20px;
          border-top: 1px solid var(--line-soft);
          font-size: 11px;
          color: var(--text-mute);
          text-align: center;
          letter-spacing: 0.02em;
        }

        @media (max-width: 900px) {
          .layout {
            grid-template-columns: 1fr;
          }
          .side {
            position: static;
          }
        }
      `}</style>
    </main>
  );
}
