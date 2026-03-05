<p align="center">
  <img src="https://img.shields.io/badge/status-live-22c55e?style=flat-square" alt="Status: Live" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/Supabase-Postgres-3ecf8e?style=flat-square&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Mapbox_GL-dark--v11-4264fb?style=flat-square&logo=mapbox" alt="Mapbox" />
  <img src="https://img.shields.io/badge/WHO_API-live_feed-0072bc?style=flat-square" alt="WHO Data" />
</p>

# 🌍 PulseMap

**Global disease surveillance, visualized like a weather radar.**

Track outbreaks. Monitor spread patterns. Stay informed — powered by real WHO data, refreshed every 6 hours.

[**→ Live Demo**](https://pulsemap-three.vercel.app)

---

## Why PulseMap Exists

Disease outbreaks don't announce themselves neatly. Data is scattered across WHO bulletins, news wires, and government reports. PulseMap consolidates it into a single dark-mode map where outbreak density glows like radar returns — green for low concern, red for critical.

This isn't a wrapper around an API. It's a full data pipeline: ingestion from WHO Disease Outbreak News, geocoding, severity estimation, deduplication, and a live-updating frontend that makes the data *feel* urgent.

## What You See

| Feature | Detail |
|---------|--------|
| **Heat map layer** | Outbreak intensity rendered as weighted heatmap — green → yellow → red gradient by severity score |
| **Pulsing hotspot markers** | Log-scaled by case count, color-coded by severity, animated CSS pulse rings |
| **Click-to-detail panels** | Disease name, case count, severity classification, WHO summary text |
| **Live feed** | Chronological outbreak reports with source badges — scrollable, searchable |
| **Search** | Filter map + feed by disease name or country |
| **Layer toggles** | Independent visibility controls for heatmap and hotspot layers |
| **Data source indicator** | Real-time badge showing whether you're seeing live Supabase data or static fallback |
| **Fly-to navigation** | Click a feed item → map smoothly flies to the outbreak location |

## Architecture

```
                    ┌──────────────────────────────────┐
                    │     Vercel Edge Network           │
                    │     (Next.js 16 App Router)       │
                    ├──────────┬───────────┬────────────┤
                    │  Mapbox  │  React UI │  API Layer │
                    │  GL JS   │  6 comps  │  2 routes  │
                    │  dark-v11│  client   │  server    │
                    ├──────────┴───────────┴────────────┤
                    │         Supabase (Postgres)       │
                    │    RLS policies · Realtime-ready  │
                    ├──────────────────────────────────┤
  Every 6h ───────▶│  WHO Disease Outbreak News API    │
  POST /backfill ─▶│  Geocoding (Mapbox + static)      │
                    │  Deduplication · Severity scoring  │
                    └──────────────────────────────────┘
```

**Data flow**: WHO API → `fetch-outbreaks.ts` pipeline → geocode country/region → estimate severity → upsert to Supabase → GeoJSON served to Mapbox GL heatmap + marker layers.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **Next.js 16** (App Router) | SSR + server routes + Vercel-native cron |
| UI | **React 19** + TypeScript | Strict typing across all 6 components |
| Styling | **Tailwind CSS 4** | Custom dark theme, no default palette |
| Map | **Mapbox GL JS** | Heatmap layers, smooth fly-to, dark basemap |
| Database | **Supabase** (Postgres) | Row-level security, realtime subscriptions |
| Data Source | **WHO DON API** | Structured, authoritative, global coverage |
| Geocoding | **Mapbox Geocoding** + static lookup | Hybrid: API for precision, static for speed |
| Testing | **Vitest** | 35 unit tests across data ingestion + WHO parser |
| Hosting | **Vercel** | Auto-deploy, cron scheduling, edge CDN |

## Getting Started

### Prerequisites

- Node.js 18+
- [Mapbox account](https://www.mapbox.com/) (free tier works)
- [Supabase project](https://supabase.com/) (free tier works)

### Install

```bash
git clone https://github.com/DareDev256/pulsemap.git
cd pulsemap
npm install
```

### Configure

Create `.env.local` from the example:

```bash
cp .env.local.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=     # Mapbox GL access token
NEXT_PUBLIC_SUPABASE_URL=     # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=# Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=    # Supabase service role (server-side only)
CRON_SECRET=                  # Auth token for cron + backfill endpoints
```

### Database Setup

Run the migration in your Supabase SQL editor:

```bash
# Copy contents of supabase/migration-001.sql into Supabase SQL Editor → Run
```

### Ingest Data

All data is **100% real** — sourced directly from WHO Disease Outbreak News. No mock or seed data.

```bash
# Pull current outbreaks
curl http://localhost:3000/api/cron/update-outbreaks \
  -H "Authorization: Bearer $CRON_SECRET"

# Backfill a date range
curl -X POST http://localhost:3000/api/backfill \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2024-01-01","endDate":"2024-12-31","source":"who","limit":200}'
```

#### Backfill API Parameters

| Parameter   | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `startDate` | string | Yes | Range start (`YYYY-MM-DD`) |
| `endDate`   | string | Yes | Range end (`YYYY-MM-DD`) |
| `source`    | string | No | `who` or `all` (default: `who`) |
| `limit`     | number | No | Max reports (default: 200, max: 500) |

### Run

```bash
npm run dev          # Development server
npm run build        # Production build
npm test             # Run test suite (35 tests)
npm run test:watch   # Watch mode
```

## Security

Pipeline API routes (`/api/cron/*`, `/api/backfill`) use fail-closed authentication:

- **`CRON_SECRET` is mandatory** -- requests are rejected with `503` when the env var is missing, not silently allowed through
- **Timing-safe token comparison** -- Bearer tokens are compared in constant time to prevent timing attacks
- **Error sanitization** -- API errors never leak stack traces or internal paths to clients
- **Input allowlisting** -- the `source` parameter is validated against a strict allowlist
- **Upstream timeouts** -- all external API fetches use `AbortController` with a 15s deadline

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── cron/          # Vercel Cron job — WHO ingestion every 6h
│   │   └── backfill/      # POST endpoint — historical data by date range
│   ├── page.tsx           # Main dashboard (client component)
│   └── globals.css        # Dark theme + hotspot marker animations
├── components/
│   ├── PulseMap.tsx        # Mapbox GL map with heatmap + markers
│   ├── Feed.tsx            # Scrollable outbreak feed
│   ├── Navbar.tsx          # Top bar with search
│   ├── LayerControls.tsx   # Heatmap/hotspot toggle panel
│   ├── Legend.tsx          # Color severity legend
│   └── OutbreakDetail.tsx  # Click-to-detail side panel
├── lib/
│   ├── fetch-outbreaks.ts  # Supabase query → GeoJSON transform
│   ├── pipeline/           # WHO API client + geocoding + dedup
│   ├── seed-data.ts        # Static fallback data
│   └── supabase.ts         # Client initialization
└── types/                  # Shared TypeScript interfaces
```

## Roadmap

### ✅ Shipped

- **Phase 1** — Interactive heatmap + pulsing hotspot markers on dark basemap
- **Phase 1** — Weather-station UI: feed panel, detail drawer, severity legend
- **Phase 1** — Supabase backend with RLS policies
- **Phase 4** — Automated WHO pipeline via Vercel Cron (6h cycle)
- **Phase 4** — Geocoding, deduplication, severity estimation
- **Phase 4** — Historical backfill API endpoint

### 🔜 Next Up

- **Phase 2** — News pin layer (geolocated news markers, toggleable)
- **Phase 3** — Google OAuth + user preferences (saved views, "near me")
- **Phase 3** — Push notifications for outbreaks in your region
- **Phase 4+** — CDC API as secondary data source
- **Phase 4+** — LLM-powered extraction from general news APIs
- **Phase 5** — Community reporting + moderation + trust scoring
- **Phase 5** — Real-time Supabase subscriptions
- Spread-front animation (animated arcs showing outbreak movement)
- Historical timeline slider
- Mobile-responsive layout + PWA offline access

## Data Sources

| Source | Status | Frequency |
|--------|--------|-----------|
| WHO Disease Outbreak News | **Active** | Every 6 hours |
| CDC | Planned | — |
| ReliefWeb | Planned | — |
| Community Reports | Planned (Phase 5) | Real-time |

## License

MIT

---

Built by [@DareDev256](https://github.com/DareDev256)
