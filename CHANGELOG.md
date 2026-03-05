# Changelog

All notable changes to PulseMap will be documented in this file.

## [0.2.4] - 2026-03-05

### Added

- **WHO parser test suite** -- 22 unit tests for `extractDisease`, `extractCountry`, and `estimateSeverity` covering all 27 disease patterns, dash/en-dash/em-dash separators, suffix stripping, severity keyword priority, and edge cases (empty strings, multi-keyword titles).
- Exported `extractDisease`, `extractCountry`, `estimateSeverity` from `who-parser.ts` for testability.

### Fixed

- **Country extraction bug for hyphenated diseases** -- `extractCountry("COVID-19 - Global")` returned `"19 - Global"` because the regex matched the first dash in `COVID-19` instead of the last separator dash. Fixed by using a greedy prefix `.*` so the regex always captures text after the final dash. This bug affected all WHO DON titles containing `COVID-19`, `SARS-CoV-2`, and `MERS-CoV`.

## [0.2.3] - 2026-03-05

### Security

- **Fail-closed API authentication** -- Both `/api/backfill` and `/api/cron/update-outbreaks` now reject all requests when `CRON_SECRET` is not configured, preventing accidental public access to data-mutation endpoints (OWASP A01:2021 Broken Access Control). Previously, a missing env var silently disabled auth.
- **Timing-safe token comparison** -- Bearer token validation uses constant-time comparison to mitigate timing-based token extraction attacks.
- **Error message sanitization** -- API error responses no longer leak raw `error.message` contents (stack traces, internal paths). Only known-safe messages (upstream status codes, timeouts) are exposed to clients.
- **Input allowlist for source parameter** -- The backfill endpoint validates the `source` field against an explicit allowlist instead of reflecting arbitrary user input in logs and responses.
- **Fetch timeout on backfill WHO requests** -- Added 15s AbortController timeout to prevent hung serverless functions from slow/unreachable upstream APIs.

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
