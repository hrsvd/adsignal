# AdSignal

A creative-fatigue early-warning tool for performance media buyers.

---

## Overview

AdSignal monitors ad creatives for fatigue using **leading signals** — CTR decay, rising frequency, hook-rate drop — rather than waiting for cost-per-result to spike. By the time CPA moves, the budget is already wasted; CTR typically falls days earlier. AdSignal catches that early window, forecasts when each creative will hit its performance cliff, quantifies the spend already leaking, and surfaces distinct refresh angles to queue behind the dying ad.

---

## Features

- **Fatigue scoring** — every creative is scored 0–100 and classified as `healthy`, `warning`, `fatigued`, or `dead` using a weighted composite of leading and lagging signals.
- **Cliff countdown** — a least-squares slope fitted to recent daily CTR projects the number of days until the creative hits the performance cliff (55 % of peak CTR). Each card shows the real curve and the dotted projection.
- **Wasted-spend estimate** — dollars already lost since decay began, calculated per creative and rolled up account-wide.
- **Signal breakdown** — per creative: CTR decay, CPM rise, frequency, CPA inflation, and hook-rate (video), each with a plain-English reading and a breached / OK flag.
- **AI refresh angles** — generate up to 6 psychologically distinct angles for a fatigued creative (not cosmetic re-wordings) grounded in the product's actual offer.
- **Weekly brief** — one-click plain-English account summary: what changed, what is urgent, what to do, leading with dollars and named creatives.
- **CSV upload** — load any ad-level CSV export; it is parsed, grouped by creative, and diagnosed instantly. A ready-made sample CSV ships in `public/`.
- **Demo mode + live AI mode** — the app works fully out of the box with no API key. Set `GROQ_API_KEY` to switch both AI features to live Groq output.

---

## Screenshots

<!-- Replace the placeholders below with actual screenshots once deployed. -->

**Dashboard — account overview**
![Dashboard screenshot](docs/screenshots/dashboard.png)

**Creative card — cliff countdown + fatigue score**
![Creative card screenshot](docs/screenshots/creative-card.png)

**Detail drawer — signal breakdown + AI refresh angles**
![Detail drawer screenshot](docs/screenshots/detail-drawer.png)

**Weekly brief panel**
![Weekly brief screenshot](docs/screenshots/weekly-brief.png)

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Charts | Recharts + hand-rolled SVG sparklines |
| AI provider | Groq via OpenAI-compatible Chat Completions API |
| Deployment | Vercel |

---

## Getting started

### Prerequisites

Node 18.17 or later.

### Install and run

```bash
git clone <your-repo-url>
cd adsignal
npm install
npm run dev          # http://localhost:3000
```

Click **Load sample account** — the full demo works without any API key.

### Run tests

```bash
npm test
```

17 unit tests covering status bands, leading-before-lagging behavior, cliff forecast, wasted-spend accounting, and account rollup.

---

## Environment variables

Copy the example file and fill in your key:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | No | Enables live AI mode. Get a free key at [console.groq.com](https://console.groq.com). |
| `GROQ_MODEL` | No | Override the default Groq model (`llama-3.3-70b-versatile`). |

The app runs in demo mode with no key — no setup required.

Both variables are server-side only and never exposed to the client bundle.

---

## Demo mode vs. live AI mode

| | Demo mode | Live AI mode |
|---|---|---|
| **Trigger** | No `GROQ_API_KEY` set | Valid `GROQ_API_KEY` present |
| **Angle generation** | Returns from a curated playbook of 6 distinct angles | Calls Groq for context-aware angles grounded in your offer |
| **Weekly brief** | Deterministic narrative from account diagnosis | Calls Groq for a fresh analyst-style brief |
| **Response shape** | `{ mode: "demo", ... }` | `{ mode: "live", ... }` |
| **Failure behavior** | — | Falls back to demo; app never 500s |

The UI labels which mode produced each output. Any failure in live mode (network error, bad JSON, quota) falls back cleanly to demo.

---

## Using AdSignal

### Load the sample account

Click **Load sample account** on the dashboard. The fixture covers the full spectrum: healthy creatives, warning-stage creatives, fatigued, and dead — plus surfaced wasted spend and imminent cliff counts.

### Upload your own CSV

Click **Upload CSV** and select an ad-level export. The parser expects a header row (case-insensitive, order-independent):

```
creative_id, creative_name, platform, format, angle,
date, impressions, clicks, spend, conversions, frequency, hook_rate
```

Field notes:

- `platform`: `meta` | `tiktok` | `google` | `taboola`
- `format`: `video` | `static` | `carousel`
- `hook_rate`: 0–1, optional — used only for video creatives
- `date`: any ISO-8601 date string (`YYYY-MM-DD`)
- One row per creative per day; multiple creatives in one file are supported

A ready-to-use sample file lives at `public/sample-account.csv`.

---

## Project structure

```
adsignal/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── angles/route.ts       # POST → AI (or demo) refresh angles
│   │   │   ├── narrative/route.ts    # POST → weekly brief
│   │   │   └── parse/route.ts        # POST → parse an ad-level CSV
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                  # dashboard: filter, sort, search, upload, drawer
│   ├── components/
│   │   ├── SummaryBar.tsx            # account KPIs
│   │   ├── CreativeCard.tsx          # per-creative vitals card
│   │   ├── DecaySparkline.tsx        # CTR-decay + cliff projection sparkline
│   │   ├── DetailDrawer.tsx          # full chart, signals, AI angle generation
│   │   └── NarrativePanel.tsx        # weekly brief
│   ├── lib/
│   │   ├── fatigue-engine.ts         # core detection logic — pure, tested
│   │   ├── __tests__/                # 17 unit tests
│   │   ├── ai-angles.ts              # dual-mode angle generation
│   │   ├── narrative.ts              # dual-mode weekly brief
│   │   ├── csv.ts                    # CSV parser (no dependencies)
│   │   ├── format.ts                 # display helpers
│   │   └── types.ts                  # domain types
│   └── data/sample-account.ts        # deterministic 8-creative demo fixture
├── public/sample-account.csv         # ready-to-upload example export
└── docs/                             # architecture notes + Mermaid diagrams
```

---

## API reference

All endpoints accept and return JSON. POST only.

### `POST /api/angles`

Generate refresh angles for a fatigued creative.

**Request body**

```json
{
  "creative": { /* Creative object — see types.ts */ },
  "offer": "Optional product/offer description for grounding the copy",
  "count": 5
}
```

- `offer` defaults to a generic prompt if omitted.
- `count` is clamped to 1–6, defaults to 5.

**Response**

```json
{
  "mode": "live" | "demo",
  "angles": [
    {
      "angle": "problem-agitation",
      "hook": "...",
      "headline": "...",
      "body": "...",
      "cta": "...",
      "rationale": "..."
    }
  ]
}
```

**Errors**: `400` (missing creative), `422` (invalid input), `500` (unexpected failure).

---

### `POST /api/narrative`

Generate the weekly account brief.

**Request body**

```json
{
  "creatives": [ /* Creative[] — each must have a non-empty metrics array */ ]
}
```

**Response**

```json
{
  "mode": "live" | "demo",
  "narrative": "Plain-English multi-paragraph brief..."
}
```

**Errors**: `400` (missing creatives), `422` (empty array or missing metrics), `500`.

---

### `POST /api/parse`

Parse a raw CSV string into Creative objects.

**Request body**

```json
{ "csv": "creative_id,creative_name,...\n..." }
```

- Maximum 5 MB.

**Response**

```json
{
  "creatives": [ /* Creative[] */ ],
  "rowCount": 42,
  "warnings": [ "row 7: unrecognised platform 'snap'" ]
}
```

**Errors**: `400` (missing or empty csv), `413` (over size limit), `422` (parse failure).

---

## How fatigue detection works

The engine compares a **baseline window** (first 3 days — the creative's peak) against a **recent window** (last 3 days), then combines the deltas into a weighted composite score.

**Leading signals carry 75 % of the weight; lagging signals 25 %.** This is the core thesis: CTR falls before CPA moves, so weighting toward leading indicators means you act while there is still time.

| Signal | Weight | Type | Warning threshold |
|---|---|---|---|
| CTR decay | 0.35 | leading | ≥ 15 % drop vs. peak |
| Frequency | 0.25 | leading | ≥ 2.5 (severe ≥ 3.5) |
| Hook-rate decay (video) | 0.15 | leading | ≥ 20 % drop |
| CPA inflation | 0.15 | lagging | ≥ 20 % rise |
| CPM rise | 0.10 | lagging | ≥ 10 % rise |

**Cliff forecast.** A least-squares slope is fitted to the recent daily CTR series and extrapolated to a cliff CTR (55 % of peak — where decline typically turns non-linear). Returns `null` when CTR is flat or improving and `0` when already past the cliff.

**Wasted spend.** From the first day CTR falls below the fatigue-onset line, each day's spend is scaled by its efficiency shortfall versus peak and summed — a dollar estimate of the cost of inaction.

---


## Roadmap

- **Persistence.** Postgres-backed storage for historical trends, cross-flight learning, and multi-user access.
- **Alerting.** Push the warning to Slack or email the moment a creative is forecast to hit the cliff, with refresh angles attached. The value is in the lead time; delivering it proactively is the point.
- **Auto-generated matched landing pages.** When an angle is chosen, generate the matching landing-page variant to close the ad-to-page message gap.

---

## License

[MIT](LICENSE)
