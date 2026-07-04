import { NextResponse } from 'next/server';
import { generateNarrative } from '@/lib/narrative';
import type { Creative } from '@/lib/types';

/**
 * POST /api/narrative
 * Body: { creatives: Creative[] }
 * Returns: { mode, narrative } — the plain-English weekly account brief.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const { creatives } = (body ?? {}) as { creatives?: Creative[] };

  if (!Array.isArray(creatives) || creatives.length === 0) {
    return NextResponse.json(
      { error: 'A non-empty "creatives" array is required.' },
      { status: 400 },
    );
  }
  const allValid = creatives.every((c) => c && Array.isArray(c.metrics) && c.metrics.length > 0);
  if (!allValid) {
    return NextResponse.json(
      { error: 'Every creative must include a non-empty "metrics" array.' },
      { status: 422 },
    );
  }

  try {
    const result = await generateNarrative(creatives);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Could not generate the weekly brief. Please try again.' },
      { status: 500 },
    );
  }
}
