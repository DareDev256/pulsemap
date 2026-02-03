# PulseMap

**Real-time global disease surveillance dashboard styled like a weather radar.**

Track outbreaks, monitor spread patterns, and stay informed — powered by WHO Disease Outbreak News data, updated every 6 hours.

[**Live Demo**](https://pulsemap-three.vercel.app)

![PulseMap Screenshot](https://img.shields.io/badge/status-live-brightgreen) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e) ![Mapbox](https://img.shields.io/badge/Mapbox_GL-dark--v11-4264fb)

---

## What It Does

PulseMap visualizes disease outbreaks on a dark-mode interactive map with weather-radar aesthetics. Heat maps show outbreak density, pulsing markers indicate hotspots, and a live feed streams reports from the WHO, CDC, and news sources.

- **Heat map layer** — Color gradient from green (low) to red (critical) showing outbreak intensity
- **Pulsing hotspot markers** — Sized by case count, colored by severity, animated to feel alive
- **Click-to-detail panels** — Disease info, case counts, severity scores, WHO summaries
- **Live feed** — Scrollable timeline of outbreak reports with source badges
- **Search** — Filter by disease name or country
- **Layer toggles** — Enable/disable heat map, hotspots independently
- **Automated data pipeline** — WHO API ingestion every 6 hours via Vercel Cron

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | **Next.js 16** + React + TypeScript | SSR, App Router, Vercel-native |
| Styling | **Tailwind CSS** | Dark theme with custom color system |
| Map | **Mapbox GL JS** | Dark basemap, heatmap layers, smooth fly-to animations |
| Backend | **Supabase** (Postgres) | Auth-ready, real-time subscriptions, RLS policies |
| Data Pipeline | **WHO Disease Outbreak News API** | Structured, reliable, covers global outbreaks |
| Geocoding | **Mapbox Geocoding API** + static lookup | Country/region to lat/lng |
| Hosting | **Vercel** | Auto-deploy from GitHub, cron jobs, edge network |

## Architecture

```
┌─────────────────────────────────────┐
│         Next.js App (Vercel)        │
├──────────┬──────────┬───────────────┤
│  Mapbox  │  Feed    │  Cron Job     │
│  GL JS   │  Panel   │  (6h cycle)   │
├──────────┴──────────┴───────────────┤
│         Supabase Backend            │
│  Postgres · RLS · Realtime-ready    │
├─────────────────────────────────────┤
│         WHO Disease Outbreak News   │
│         API (auto-ingested)         │
└─────────────────────────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+
- [Mapbox account](https://www.mapbox.com/) (free tier)
- [Supabase project](https://supabase.com/) (free tier)

### Setup

```bash
git clone https://github.com/DareDev256/pulsemap.git
cd pulsemap
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_cron_secret
```

Run the database migration in your Supabase SQL editor:

```bash
# Copy contents of supabase/migration-001.sql into Supabase SQL Editor and run
```

Seed the database:

```bash
# Copy contents of scripts/seed.sql scratchpad into Supabase SQL Editor and run
# Or trigger the pipeline to pull live WHO data:
curl http://localhost:3000/api/cron/update-outbreaks -H "Authorization: Bearer your_cron_secret"
```

Start development:

```bash
npm run dev
```

## Roadmap

### Completed

- [x] **Phase 1** — Interactive map with heat map + pulsing hotspot markers
- [x] **Phase 1** — Dark weather-station UI with live feed panel
- [x] **Phase 1** — Supabase backend with full schema and RLS
- [x] **Phase 1** — Click-to-detail panels with outbreak stats
- [x] **Phase 4** — Automated WHO data pipeline (Vercel Cron, every 6h)
- [x] **Phase 4** — Geocoding pipeline (Mapbox + static lookup)
- [x] **Phase 4** — Deduplication and severity estimation

### In Progress / Next Up

- [ ] **Phase 2** — News pin map layer (toggle geolocated news markers)
- [ ] **Phase 3** — Google OAuth sign-in via Supabase Auth
- [ ] **Phase 3** — User preferences (saved view, filters, "near me" default)
- [ ] **Phase 3** — Notification system for new outbreaks in your region
- [ ] **Phase 4+** — CDC API integration as secondary data source
- [ ] **Phase 4+** — LLM-powered news extraction from general news APIs
- [ ] **Phase 5** — Community reporting layer (submit + moderate user reports)
- [ ] **Phase 5** — Real-time feed via Supabase subscriptions
- [ ] **Phase 5** — Trust scoring and spam/misinformation safeguards
- [ ] Spread front animation layer (animated arcs showing outbreak movement)
- [ ] Historical outbreak timeline slider
- [ ] Mobile-responsive layout
- [ ] PWA support for offline access

## Data Sources

| Source | Status | Update Frequency |
|--------|--------|-----------------|
| WHO Disease Outbreak News | Active | Every 6 hours |
| CDC | Planned | — |
| ReliefWeb | Planned (requires appname registration) | — |
| Community Reports | Planned (Phase 5) | Real-time |

## License

MIT

---

Built by [@DareDev256](https://github.com/DareDev256)
