import type { Creative, DailyMetric, Platform } from './types';

/**
 * Minimal, dependency-free CSV parser for ad-level daily performance exports.
 *
 * Expected columns (header row, case-insensitive, order-independent):
 *   creative_id, creative_name, platform, format, angle,
 *   date, impressions, clicks, spend, conversions, frequency, hook_rate(optional)
 *
 * Rows for the same creative_id are grouped into one Creative with a sorted
 * metrics series. Designed to accept the kind of flat export every ad platform
 * and BI tool can produce.
 */

const VALID_PLATFORMS: Platform[] = ['meta', 'tiktok', 'google', 'taboola'];
const VALID_FORMATS: Creative['format'][] = ['video', 'static', 'carousel'];

export interface CsvParseResult {
  creatives: Creative[];
  rowCount: number;
  warnings: string[];
}

/** Split a CSV line honouring simple double-quoted fields. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function num(v: string | undefined): number {
  const n = Number((v ?? '').replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function parseCsv(text: string): CsvParseResult {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { creatives: [], rowCount: 0, warnings: ['The file has no data rows.'] };
  }

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name);

  const idIdx = col('creative_id');
  const dateIdx = col('date');
  if (idIdx === -1 || dateIdx === -1) {
    return {
      creatives: [],
      rowCount: 0,
      warnings: ['Missing required columns: "creative_id" and "date" are mandatory.'],
    };
  }

  const nameIdx = col('creative_name');
  const platIdx = col('platform');
  const fmtIdx = col('format');
  const angleIdx = col('angle');
  const imprIdx = col('impressions');
  const clickIdx = col('clicks');
  const spendIdx = col('spend');
  const convIdx = col('conversions');
  const freqIdx = col('frequency');
  const hookIdx = col('hook_rate');

  const grouped = new Map<string, { meta: Partial<Creative>; metrics: DailyMetric[] }>();
  let rowCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const id = cells[idIdx];
    if (!id) continue;
    rowCount++;

    const platRaw = (cells[platIdx] ?? '').toLowerCase() as Platform;
    const fmtRaw = (cells[fmtIdx] ?? '').toLowerCase() as Creative['format'];
    const platform = VALID_PLATFORMS.includes(platRaw) ? platRaw : 'meta';
    const format = VALID_FORMATS.includes(fmtRaw) ? fmtRaw : 'static';

    const metric: DailyMetric = {
      date: cells[dateIdx],
      impressions: num(cells[imprIdx]),
      clicks: num(cells[clickIdx]),
      spend: num(cells[spendIdx]),
      conversions: num(cells[convIdx]),
      frequency: num(cells[freqIdx]),
    };
    if (hookIdx !== -1 && cells[hookIdx]) {
      metric.hookRate = num(cells[hookIdx]);
    }

    if (!grouped.has(id)) {
      grouped.set(id, {
        meta: {
          id,
          name: nameIdx !== -1 ? cells[nameIdx] || id : id,
          platform,
          format,
          angle: angleIdx !== -1 ? cells[angleIdx] || 'unspecified' : 'unspecified',
        },
        metrics: [],
      });
    }
    grouped.get(id)!.metrics.push(metric);
  }

  const creatives: Creative[] = [];
  for (const { meta, metrics } of grouped.values()) {
    metrics.sort((a, b) => a.date.localeCompare(b.date));
    if (metrics.length < 4) {
      warnings.push(`"${meta.name}" has only ${metrics.length} days — forecasts need at least 4.`);
    }
    creatives.push({
      id: meta.id as string,
      name: meta.name as string,
      platform: meta.platform as Platform,
      format: meta.format as Creative['format'],
      angle: meta.angle as string,
      metrics,
    });
  }

  return { creatives, rowCount, warnings };
}
