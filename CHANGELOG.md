# Changelog

All notable changes to PulseMap will be documented in this file.

## [0.2.0] - 2026-02-19

### Added

- **Backfill API endpoint** (`POST /api/backfill`) — Ingest historical WHO outbreak data by date range with configurable limits. Supports `startDate`, `endDate`, `source`, and `limit` parameters. Auth-gated with `CRON_SECRET`.

## [0.1.0] - 2026-02-03

### Added

- Interactive dark-mode map with heat map and pulsing hotspot markers
- Live feed panel with WHO outbreak reports
- Supabase backend with full schema and RLS policies
- Automated WHO data pipeline via Vercel Cron (6-hour cycle)
- Geocoding pipeline (Mapbox API + static country lookup)
- Deduplication and severity estimation engine
