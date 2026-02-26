# Changelog

All notable changes to PulseMap will be documented in this file.

## [0.2.2] - 2026-02-26

### Changed

- **README rewrite** — Portfolio-grade documentation with architecture diagram, project structure map, data flow explanation, and tech stack rationale. Added badges with logos, restructured setup instructions with `cp .env.local.example` flow, and replaced flat feature list with detailed table.

## [0.2.1] - 2026-02-22

### Added

- **Test suite** — 13 unit tests for `fetch-outbreaks.ts` covering `fetchOutbreakGeoJSON` and `fetchFeedItems` with full Supabase mock layer. Tests cover GeoJSON mapping, error handling, null fallbacks, query shape validation, and multi-source feed ingestion.
- **Vitest** added as test runner with `npm test` and `npm run test:watch` scripts
- `vitest.config.ts` with `@/` path alias support

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
