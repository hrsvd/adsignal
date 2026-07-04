'use client';

import { useState } from 'react';
import type { Creative } from '@/lib/types';

/** The "Monday brief" panel — generates a plain-English account narrative. */
export function NarrativePanel({ creatives }: { creatives: Creative[] }) {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [mode, setMode] = useState<'live' | 'demo' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatives }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setNarrative(data.narrative);
      setMode(data.mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="p-head">
        <div>
          <h3>This week&apos;s brief</h3>
          <p className="p-sub">What changed, what&apos;s urgent, what to do — in plain English.</p>
        </div>
        <button className="btn" onClick={generate} disabled={loading}>
          {loading ? 'Writing…' : narrative ? 'Refresh brief' : 'Write the brief'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="lines">
          <div className="l" style={{ width: '92%' }} />
          <div className="l" style={{ width: '100%' }} />
          <div className="l" style={{ width: '78%' }} />
          <div className="l" style={{ width: '88%' }} />
        </div>
      )}

      {narrative && !loading && (
        <div className="body">
          {mode === 'demo' && (
            <div className="mode-note">
              Demo mode — generated deterministically. Add an Anthropic API key for live Claude narration.
            </div>
          )}
          {narrative.split('\n\n').map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}

      {!narrative && !loading && !error && (
        <div className="empty">Generate a shareable summary of the whole account&apos;s creative health.</div>
      )}

      <style jsx>{`
        .panel {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: var(--radius);
          padding: 20px 22px;
        }
        .p-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
        }
        h3 {
          font-size: 16px;
        }
        .p-sub {
          font-size: 12.5px;
          color: var(--text-mute);
          margin: 4px 0 0;
        }
        .btn {
          background: transparent;
          color: var(--accent);
          border: 1px solid var(--accent-dim);
          border-radius: var(--radius-sm);
          padding: 8px 15px;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .btn:hover:not(:disabled) {
          background: var(--accent-tint);
        }
        .btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .body p {
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-dim);
          margin: 0 0 12px;
        }
        .body p:first-of-type {
          color: var(--text);
        }
        .mode-note {
          font-size: 11.5px;
          color: var(--warning);
          background: var(--warning-tint);
          border-radius: 6px;
          padding: 8px 11px;
          margin-bottom: 14px;
        }
        .error {
          font-size: 12.5px;
          color: var(--fatigued);
          background: var(--fatigued-tint);
          border-radius: 6px;
          padding: 10px 12px;
        }
        .empty {
          font-size: 13px;
          color: var(--text-mute);
        }
        .lines {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .l {
          height: 13px;
          border-radius: 4px;
          background: linear-gradient(90deg, var(--panel-2) 25%, var(--line) 37%, var(--panel-2) 63%);
          background-size: 800px 100%;
          animation: shimmer 1.3s infinite linear;
        }
      `}</style>
    </div>
  );
}
