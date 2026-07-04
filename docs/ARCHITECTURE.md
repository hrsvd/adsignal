# Architecture

AdSignal is a single Next.js application. The browser renders the dashboard; a
small set of server-side API routes handle CSV parsing and the two AI features
(so the Groq key never reaches the client). The analytical core — the
fatigue engine — is pure TypeScript shared by both sides.

The guiding principle: **keep the graded logic (detection) pure and isolated,
and keep everything I/O-bound (AI calls, parsing) at the edges.** That makes the
core trivially testable and portable to a background worker when live connectors
arrive.

## System architecture

```mermaid
flowchart TB
    subgraph Browser["Browser — Next.js client"]
        UI["Dashboard page<br/>(filter · sort · search · upload)"]
        Cards["Creative cards<br/>+ cliff sparkline"]
        Drawer["Detail drawer<br/>(chart · signals · angles)"]
        Brief["Weekly brief panel"]
    end

    subgraph Server["Vercel — Next.js server"]
        RParse["/api/parse"]
        RAngles["/api/angles"]
        RNarr["/api/narrative"]
    end

    subgraph Core["Shared pure core (no I/O)"]
        Engine["fatigue-engine.ts<br/>diagnose · forecast · summarise"]
        CSV["csv.ts parser"]
        Types["types.ts"]
    end

    subgraph AI["AI layer (dual-mode)"]
        Angles["ai-angles.ts"]
        Narr["narrative.ts"]
        Groq["Groq Chat Completions API<br/>(OpenAI-compatible)"]
        Playbook["Deterministic playbook<br/>(demo fallback)"]
    end

    UI --> Cards --> Drawer
    UI --> Brief
    UI -- "diagnose() in-browser" --> Engine
    UI -- "CSV text" --> RParse --> CSV --> Engine
    Drawer -- "creative + offer" --> RAngles --> Angles
    Brief -- "creatives" --> RNarr --> Narr
    Angles -->|key present| Groq
    Angles -->|no key / failure| Playbook
    Narr -->|key present| Groq
    Narr -->|no key / failure| Playbook
    Engine --- Types
```

The engine runs **in the browser** for instant diagnosis of the loaded account,
and **on the server** inside the AI routes (to build prompts and ground the
narrative). Same code, both places — the benefit of keeping it pure.

## Request flow — generating refresh angles

```mermaid
sequenceDiagram
    participant U as User
    participant D as Detail drawer
    participant A as /api/angles
    participant E as Fatigue engine
    participant AI as ai-angles.ts
    participant G as Groq

    U->>D: Click "Generate angles"
    D->>A: POST { creative, offer, count }
    A->>A: Validate body (400/422 on bad input)
    A->>E: diagnose(creative)
    E-->>A: Diagnosis (status, breached signals)
    A->>AI: generateAngles(creative, diagnosis, offer)
    alt GROQ_API_KEY set
        AI->>G: chat.completions.create(prompt)
        G-->>AI: JSON angles
        Note over AI: parse fails? → fall through to demo
    else no key
        AI->>AI: deterministic playbook
    end
    AI-->>A: { mode, angles }
    A-->>D: 200 { mode, angles }
    D->>U: Render angle cards (+ demo-mode note if applicable)
```

The same shape applies to `/api/narrative`. Every AI path has a deterministic
fallback, so a failure never surfaces as a broken state.

## Data model

No database in the MVP; these are the in-memory/transport shapes (see
`src/lib/types.ts`). Shown as relationships for clarity and to describe the
persistence target on the roadmap.

```mermaid
erDiagram
    CREATIVE ||--o{ DAILY_METRIC : has
    CREATIVE ||--|| DIAGNOSIS : produces
    DIAGNOSIS ||--o{ SIGNAL : contains
    ACCOUNT ||--o{ CREATIVE : monitors
    ACCOUNT ||--|| ACCOUNT_SUMMARY : "rolls up to"

    CREATIVE {
        string id PK
        string name
        string platform "meta|tiktok|google|taboola"
        string format "video|static|carousel"
        string angle
    }
    DAILY_METRIC {
        string date
        number impressions
        number clicks
        number spend
        number conversions
        number frequency
        number hookRate "optional (video)"
    }
    DIAGNOSIS {
        string creativeId FK
        string status "healthy|warning|fatigued|dead"
        number score "0-100"
        number daysUntilCliff "nullable"
        number wastedSpend
        string recommendation
    }
    SIGNAL {
        string key
        string reading
        boolean breached
    }
    ACCOUNT_SUMMARY {
        number totalCreatives
        number totalWastedSpend
        number imminentCliffs
    }
```

## The fatigue detection pipeline

```mermaid
flowchart LR
    M["Daily metrics<br/>(oldest → newest)"] --> B["Baseline window<br/>(first 3 days = peak)"]
    M --> R["Recent window<br/>(last 3 days)"]
    B --> S["Build signals<br/>CTR · CPM · freq · CPA · hook"]
    R --> S
    S --> W["Weighted composite<br/>leading 0.75 / lagging 0.25"]
    W --> ST["Status band<br/>healthy→warning→fatigued→dead"]
    M --> F["Least-squares CTR slope<br/>→ days until cliff (55% of peak)"]
    M --> WS["Wasted spend<br/>(shortfall × spend, since onset)"]
    ST --> DX["Diagnosis"]
    F --> DX
    WS --> DX
```

## Key decisions

- **Pure engine, edges do I/O.** Detection has no network or clock dependency,
  so it's deterministic and unit-tested; the AI/parse routes are the only
  I/O-bound code and they live at the boundary.
- **Dual-mode AI.** Demo-mode fallback makes the product work with zero setup and
  guarantees the app can't break due to an AI provider failure; live mode is a
  superset, not a different path.
- **Groq via OpenAI-compatible API.** The `openai` npm package is pointed at
  Groq's base URL (`https://api.groq.com/openai/v1`). Model is configurable via
  `GROQ_MODEL` env var; default is `llama-3.3-70b-versatile`.
- **No DB in the MVP.** Fixture + CSV upload cover the demo; persistence is the
  first roadmap item, not an oversight.
- **Explainable forecast.** A visible linear CTR slope beats an opaque model for
  a tool whose entire value proposition is *earning the buyer's trust to act early*.
