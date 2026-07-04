import { NextResponse } from 'next/server';
import { parseCsv } from '@/lib/csv';

/**
 * POST /api/parse
 * Body: { csv: string }
 * Returns: { creatives, rowCount, warnings } parsed from an ad-level CSV export.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const { csv } = (body ?? {}) as { csv?: string };
  if (typeof csv !== 'string' || csv.trim().length === 0) {
    return NextResponse.json({ error: 'A non-empty "csv" string is required.' }, { status: 400 });
  }
  if (csv.length > 5_000_000) {
    return NextResponse.json({ error: 'File too large (limit 5MB).' }, { status: 413 });
  }

  const result = parseCsv(csv);
  if (result.creatives.length === 0) {
    return NextResponse.json(
      { error: result.warnings[0] ?? 'No creatives could be parsed from the file.' },
      { status: 422 },
    );
  }
  return NextResponse.json(result, { status: 200 });
}
