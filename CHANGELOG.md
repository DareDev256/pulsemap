# Changelog

All notable changes to PulseMap will be documented in this file.

## [0.5.0] - 2026-03-11

### Changed

- **Extracted shared `api-client` module** (`src/lib/api-client.ts`) — Single entry point for client-side dashboard data loading. Encapsulates parallel Supabase fetches, empty-result detection, and static fallback logic that was previously inlined in the page component. Exports typed `loadDashboardData()`, `DashboardData` interface, and `DataSource` type.
- **Eliminated 60+ lines of duplicated WHO parsing code** — `backfill/route.ts` copy-pasted `DISEASE_PATTERNS`, `extractDisease`, `extractCountry`, `estimateSeverity`, and the `WHODon` interface from `who-parser.ts`. All removed; backfill now imports from the canonical source.
- **Consolidated `fetchWHOByDateRange` into `who-parser.ts`** — Date-range WHO fetch was isolated in the backfill route with no test coverage. Now lives alongside `fetchWHOOutbreaks` sharing the same extractors and `parseWHOItems` mapper. Single source of truth for all WHO API interactions.
- **Simplified `page.tsx` data loading** — useEffect reduced from 20 lines of manual orchestration to a single `loadDashboardData()` call with destructured result.

### Fixed

- **`extractCountry` regex bug in backfill route** — The duplicated version used `/[-–—]\s*(.+?)$/` (missing greedy `.*` prefix), causing it to match the first dash in hyphenated disease names like "COVID-19" instead of the last separator. Now uses the corrected who-parser version with `.*[-–—]` (fixed in v0.2.4 but never propagated to backfill).

## [0.4.0] - 2026-03-10

### Added

- **Historical timeline slider** — Draggable range input with sparkline density visualization. Scrubbing the slider filters all visible outbreaks by reported date — heatmap, hotspot markers, spread arcs, stats bar, and feed all update in real-time. Custom-styled thin-line thumb with accent glow, activity bars colored by outbreak density (red for high-activity bins, blue for normal), and a visible/total count badge. Fully accessible with `aria-valuetext` announcing the current date and outbreak count.
- **`reported_at` field** on `OutbreakGeoFeature` — threads temporal data from the Supabase `outbreak_locations.reported_at` column through the GeoJSON pipeline, enabling date-based filtering across the entire UI.
- **Seed data dates** — All 25 static outbreak features now include realistic `reported_at` timestamps spanning Dec 2025–Feb 2026.

## [0.3.0] - 2026-03-08

### Added

- **Disease spread network visualization** — Animated great-circle arcs connect outbreak locations sharing the same disease, creating a "global threat network" overlay on the dark basemap. Uses spherical linear interpolation for naturally curved arcs (64-point resolution), star topology with highest-case-count location as hub, severity-based color coding, dual-layer glow effect (wide blur + narrow bright core), and animated dash pattern for a "data flowing" effect. Toggled via the existing Spread layer control (no longer disabled).
- **Spread arc generator** (`src/lib/spread-arcs.ts`) — Pure function that computes GeoJSON LineString arcs from outbreak GeoFeatures, grouped by disease name. Handles degenerate cases (same coordinates, single locations, antipodal points).
- **Spread legend entry** — Legend component now conditionally shows a gradient-colored spread network indicator when the Spread layer is active.
- **8 new unit tests** for spread arc generation covering empty inputs, single-location diseases, hub selection, severity ranking, arc resolution, proximity filtering, and multi-disease independence. Test suite now at 43 total tests.

## [0.2.6] - 2026-03-08

### Security

- **Security headers on all responses** -- Added CSP, X-Frame-Options (DENY), HSTS, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy via `next.config.ts`. CSP allowlists Mapbox GL, Supabase, WHO API, and Google Fonts — blocks all other script/connect origins. Addresses OWASP A05:2021 (Security Misconfiguration) and clickjacking.
- **Fail-fast Supabase admin client** -- `supabase-admin.ts` now validates required env vars at initialization and throws a descriptive error when missing, instead of silently creating a broken client.
- **WHO fetch timeout parity** -- `fetchWHOOutbreaks()` now uses a 15s `AbortController` timeout matching the backfill route, preventing hung serverless functions.
- **Mapbox token leak prevention** -- Geocoding error handler now logs only `error.message` instead of the full error object, which could contain the Mapbox `access_token`.

## [0.2.5] - 2026-03-07

### Fixed

- **StatsBar component not rendering** -- Created `StatsBar.tsx` and integrated it into the main page layout between the map and feed sections. Displays real-time aggregate stats: outbreak count, total cases (with M/K formatting), affected countries, critical alert count with pulse indicator, severity distribution bar, and top disease by case volume. Uses `useMemo` for derived calculations, `tabular-nums` for stable numeric widths, and accounts for its height in the feed section to prevent viewport overflow.

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
