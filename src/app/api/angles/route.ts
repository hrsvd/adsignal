import { NextResponse } from 'next/server';
import { generateAngles } from '@/lib/ai-angles';
import { diagnose } from '@/lib/fatigue-engine';
import type { Creative } from '@/lib/types';

/**
 * POST /api/angles
 * Body: { creative: Creative, offer: string, count?: number }
 * Returns: { mode, angles } — AI-generated (or demo) refresh angles for a creative.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const { creative, offer, count } = (body ?? {}) as {
    creative?: Creative;
    offer?: string;
    count?: number;
  };

  if (!creative || typeof creative !== 'object' || !Array.isArray(creative.metrics)) {
    return NextResponse.json(
      { error: 'A "creative" object with a "metrics" array is required.' },
      { status: 400 },
    );
  }
  if (creative.metrics.length === 0) {
    return NextResponse.json(
      { error: 'The creative has no metrics to analyse.' },
      { status: 422 },
    );
  }
  if (offer !== undefined && typeof offer !== 'string') {
    return NextResponse.json({ error: '"offer" must be a string.' }, { status: 400 });
  }

  const safeCount = Math.min(Math.max(Number.isFinite(count) ? Number(count) : 5, 1), 6);
  const safeOffer = offer && offer.trim().length > 0 ? offer.trim() : 'A performance-advertising product.';

  try {
    const diagnosis = diagnose(creative);
    const result = await generateAngles(creative, diagnosis, safeOffer, safeCount);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Could not generate angles. Please try again.' },
      { status: 500 },
    );
  }
}
