import type { Creative, Diagnosis } from './types';
import { diagnose, summariseAccount } from './fatigue-engine';

/**
 * Weekly narrative — turns the account state into the plain-English "what changed
 * and what to do" brief a buyer would otherwise write by hand every Monday.
 * Dual-mode (live Groq / deterministic demo), same as angle generation.
 */

// ---------------------------------------------------------------------------
// Groq config — mirrors the constant in ai-angles.ts.
// ---------------------------------------------------------------------------

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';

export interface NarrativeResponse {
  mode: 'live' | 'demo';
  narrative: string;
}

function fmtMoney(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function demoNarrative(creatives: Creative[]): string {
  const summary = summariseAccount(creatives);
  const diagnoses = creatives.map((c) => ({ c, d: diagnose(c) }));

  const dead = diagnoses.filter((x) => x.d.status === 'dead');
  const fatigued = diagnoses.filter((x) => x.d.status === 'fatigued');
  const warning = diagnoses
    .filter((x) => x.d.status === 'warning')
    .sort((a, b) => (a.d.daysUntilCliff ?? 99) - (b.d.daysUntilCliff ?? 99));
  const healthy = diagnoses.filter((x) => x.d.status === 'healthy');

  const lines: string[] = [];

  lines.push(
    `This week across ${summary.totalCreatives} creatives you spent ${fmtMoney(summary.totalSpend)}, ` +
      `of which roughly ${fmtMoney(summary.totalWastedSpend)} went to creatives already past their prime.`,
  );

  if (dead.length || fatigued.length) {
    const names = [...dead, ...fatigued].map((x) => `"${x.c.name}"`).join(', ');
    lines.push(
      `Act now: ${dead.length + fatigued.length} creative${dead.length + fatigued.length > 1 ? 's have' : ' has'} ` +
        `crossed into fatigue — ${names}. Pause or rotate ${dead.length + fatigued.length > 1 ? 'these' : 'this'} today ` +
        `and promote a fresh angle from the queue.`,
    );
  }

  if (warning.length) {
    const soonest = warning[0];
    lines.push(
      `Watch closely: ${warning.length} creative${warning.length > 1 ? 's are' : ' is'} decaying. ` +
        `The most urgent is "${soonest.c.name}", projected to hit the cliff in about ` +
        `${Math.round(soonest.d.daysUntilCliff ?? 0)} days. Stage its replacement before then, not after.`,
    );
  }

  if (healthy.length) {
    lines.push(
      `Keep running: ${healthy.length} creative${healthy.length > 1 ? 's are' : ' is'} still healthy. ` +
        `Archive the top performer${healthy.length > 1 ? 's' : ''} into your winners library so the next iteration ` +
        `starts from a proven base rather than a blank page.`,
    );
  }

  lines.push(
    `Bottom line: your fastest ROI this week is rotating the fatigued creatives and queuing angles behind the two ` +
      `warnings — that protects roughly ${fmtMoney(summary.totalWastedSpend)} of spend from leaking further.`,
  );

  return lines.join('\n\n');
}

function buildPrompt(creatives: Creative[]): string {
  const rows = creatives.map((c) => {
    const d = diagnose(c);
    const cliff = d.daysUntilCliff === null ? 'n/a' : `${d.daysUntilCliff}d`;
    return `- ${c.name} [${c.platform}/${c.format}] status=${d.status} score=${d.score} cliff=${cliff} wasted=$${d.wastedSpend}`;
  });
  const s = summariseAccount(creatives);
  return [
    `You are a performance-marketing analyst writing the Monday brief for a media buyer.`,
    `Summarise the account state below in plain English: what changed, what is urgent, and what to do this week.`,
    `Be specific, name creatives, lead with dollars and actions. 3-5 short paragraphs, no bullet lists, no markdown headers.`,
    ``,
    `Account: ${s.totalCreatives} creatives, total spend $${s.totalSpend}, estimated wasted spend $${s.totalWastedSpend}, ${s.imminentCliffs} imminent cliffs.`,
    `Creatives:`,
    ...rows,
  ].join('\n');
}

async function liveNarrative(apiKey: string, creatives: Creative[]): Promise<string> {
  // Imported lazily so demo mode never requires the package to be loaded.
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey, baseURL: GROQ_BASE_URL });

  const completion = await client.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: 900,
    messages: [{ role: 'user', content: buildPrompt(creatives) }],
  });

  const text = (completion.choices[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('Empty narrative from Groq');
  return text;
}

export async function generateNarrative(creatives: Creative[]): Promise<NarrativeResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey) {
    try {
      return { mode: 'live', narrative: await liveNarrative(apiKey, creatives) };
    } catch {
      return { mode: 'demo', narrative: demoNarrative(creatives) };
    }
  }
  return { mode: 'demo', narrative: demoNarrative(creatives) };
}
