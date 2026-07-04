import type { Creative, Diagnosis } from './types';

/**
 * AI angle generation.
 *
 * Two modes, chosen automatically:
 *  - LIVE:  when GROQ_API_KEY is set, we call Groq's chat completions API
 *           (OpenAI-compatible) for fresh, context-aware angles.
 *  - DEMO:  when no key is present, we synthesise high-quality, deterministic
 *           angles from a curated playbook. This guarantees the demo works with
 *           zero setup and never fails — a deliberate reliability choice.
 *
 * The output shape is identical in both modes so the UI never branches.
 */

// ---------------------------------------------------------------------------
// Groq config — override default model via GROQ_MODEL env var.
// ---------------------------------------------------------------------------

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

export interface RefreshAngle {
  /** The messaging angle/strategy (e.g. "problem-agitation"). */
  angle: string;
  /** Scroll-stopping hook — the first line/opening frame. */
  hook: string;
  /** Primary headline. */
  headline: string;
  /** One-line body / supporting copy. */
  body: string;
  /** Call to action. */
  cta: string;
  /** Why this angle is meaningfully different from the fatigued one. */
  rationale: string;
}

export interface AngleResponse {
  mode: 'live' | 'demo';
  angles: RefreshAngle[];
}

// ---------------------------------------------------------------------------
// Demo playbook — genuinely distinct angles, not cosmetic variations.
// The whole point: variety of *angle*, not ten versions of one idea.
// ---------------------------------------------------------------------------

const PLAYBOOK: Omit<RefreshAngle, 'rationale'>[] = [
  {
    angle: 'problem-agitation',
    hook: 'You found out the creative was dead three days too late.',
    headline: 'Stop discovering fatigue in the CPA report',
    body: 'By the time cost-per-result spikes, you have already burned days of budget on an ad nobody is clicking.',
    cta: 'See fatigue before it costs you',
  },
  {
    angle: 'social-proof',
    hook: 'The 2-person team outspending agencies five times their size.',
    headline: 'How lean teams keep ROAS climbing',
    body: 'They rotate creatives on the leading signal, not the lagging one — and never run a fatigued ad into the ground.',
    cta: 'Run your account like they do',
  },
  {
    angle: 'data-driven',
    hook: 'Creative drives ~70% of ad performance. You are watching the other 30%.',
    headline: 'Your dashboard shows spend. It should show decay.',
    body: 'CTR falls days before CPA moves. Catching that early is the difference between scaling and bleeding.',
    cta: 'Watch the signal that matters',
  },
  {
    angle: 'founder-story',
    hook: 'I killed a winning ad a week too late. Twice. Then I built this.',
    headline: 'Built by a media buyer who got tired of guessing',
    body: 'No more scrolling spreadsheets and eyeballing week-on-week CTR. The tool calls it before the cliff.',
    cta: 'Try what I wish I had',
  },
  {
    angle: 'urgency-loss-aversion',
    hook: 'Three of your creatives hit the cliff in the next 72 hours.',
    headline: 'The refresh queue that is always ready',
    body: 'Stage the next angle before the current one collapses, so delivery never falls off a cliff with nothing behind it.',
    cta: 'Never scramble for a replacement again',
  },
  {
    angle: 'contrarian',
    hook: 'More variations will not fix your ad fatigue.',
    headline: 'Ten versions of one idea is volume, not diversity',
    body: 'The algorithm treats near-identical creatives as the same ad. Distinct angles are what actually reset fatigue.',
    cta: 'Test angles, not clones',
  },
];

function demoAngles(fatiguedAngle: string, count: number): RefreshAngle[] {
  // Prefer angles different from the fatigued one, to maximise conceptual distance.
  const ranked = [...PLAYBOOK].sort((a, b) => {
    const aSame = a.angle === fatiguedAngle ? 1 : 0;
    const bSame = b.angle === fatiguedAngle ? 1 : 0;
    return aSame - bSame;
  });
  return ranked.slice(0, count).map((a) => ({
    ...a,
    rationale:
      a.angle === fatiguedAngle
        ? 'Same angle, fully reworked hook and framing to reset novelty.'
        : `Switches from "${fatiguedAngle}" to "${a.angle}" — a different psychological trigger that reaches a fresh slice of the audience.`,
  }));
}

// ---------------------------------------------------------------------------
// Live mode — Groq via OpenAI-compatible client.
// ---------------------------------------------------------------------------

function buildPrompt(creative: Creative, diagnosis: Diagnosis, offer: string, count: number): string {
  const breached = diagnosis.signals.filter((s) => s.breached).map((s) => `${s.label} (${s.reading})`);
  return [
    `You are a senior performance-creative strategist. A media buyer has a fatigued ad and needs ${count} fresh angles to test.`,
    ``,
    `PRODUCT / OFFER:`,
    offer,
    ``,
    `FATIGUED CREATIVE:`,
    `- Name: ${creative.name}`,
    `- Platform: ${creative.platform}`,
    `- Format: ${creative.format}`,
    `- Current angle: ${creative.angle}`,
    `- Fatigue status: ${diagnosis.status} (score ${diagnosis.score}/100)`,
    `- Breached signals: ${breached.length ? breached.join(', ') : 'none yet, but decaying'}`,
    ``,
    `RULES:`,
    `1. Each angle must use a DIFFERENT psychological trigger from the current one and from each other. Angle diversity resets fatigue; near-duplicate variations do not.`,
    `2. Keep copy platform-appropriate and punchy.`,
    `3. Ground every angle in the real offer above — no generic filler.`,
    ``,
    `Return ONLY a JSON array of exactly ${count} objects, no prose, no markdown fences. Each object:`,
    `{"angle": string, "hook": string, "headline": string, "body": string, "cta": string, "rationale": string}`,
  ].join('\n');
}

async function liveAngles(
  apiKey: string,
  creative: Creative,
  diagnosis: Diagnosis,
  offer: string,
  count: number,
): Promise<RefreshAngle[]> {
  // Imported lazily so demo mode never requires the package to be loaded.
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: buildPrompt(creative, diagnosis, offer, count) }],
  });

  const text = (completion.choices[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('Empty response from Groq');

  // Strip markdown fences if the model includes them despite the instruction.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as RefreshAngle[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Model returned no angles');
  }
  return parsed.slice(0, count);
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

export async function generateAngles(
  creative: Creative,
  diagnosis: Diagnosis,
  offer: string,
  count = 5,
): Promise<AngleResponse> {
  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    try {
      const angles = await liveAngles(apiKey, creative, diagnosis, offer, count);
      return { mode: 'live', angles };
    } catch {
      // Any failure (network, parse, quota) falls back to demo so the app never 500s.
      return { mode: 'demo', angles: demoAngles(creative.angle, count) };
    }
  }

  return { mode: 'demo', angles: demoAngles(creative.angle, count) };
}
