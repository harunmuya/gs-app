# Production Architecture Blueprint

## Current Runtime

1. Web frontend: Next.js app routes under `src/app`.
2. Backend: Next.js route handlers under `src/app/api`.
3. Database/storage/realtime: Supabase.
4. Android: Capacitor wrapper using `server.url = https://genuine-sugarmummies-app.vercel.app`.
5. Media: mixed local public assets, Supabase storage, and external/WP image sources.

## New Architecture Direction

The rebuild moves toward:

1. Native Android client consuming `/api/v1/*`.
2. Web client continuing to use existing routes during migration.
3. Shared server-side entitlement logic in `src/lib/packageAccess.js`.
4. Shared API response/error contract in `src/lib/apiContract.js`.
5. Supabase schema stabilized through additive migrations.
6. Heavy media, jobs, notifications, and realtime workloads prepared for migration away from Vercel limits.

## Versioned API Foundation Added

1. `GET /api/v1/bootstrap`

Returns app metadata, legal versions, Android permission matrix, endpoint map, packages, and feature flags. This is the native app's startup configuration endpoint.

2. `GET /api/v1/health`

Checks server env and database reachability. This gives Android and monitoring tools a stable health endpoint instead of testing random feature pages.

3. `GET /api/v1/entitlements?userId=...`

Returns a user's active tier, feature switches, and daily limits.

4. `POST /api/v1/entitlements`

Checks whether a user can use a requested feature and returns machine-readable package errors.

## Existing API Routes To Migrate Behind `/api/v1`

1. `/api/members`
2. `/api/chat`
3. `/api/calls`
4. `/api/live`
5. `/api/wallet`
6. `/api/location`
7. `/api/packages`
8. `/api/activity`
9. `/api/profiles/follows`
10. `/api/admin`

## Android WebView Exit Plan

Phase A:

1. Native startup reads `/api/v1/bootstrap`.
2. Native auth reads/writes only through API endpoints.
3. Native profile completion uses API + media upload endpoints.
4. Native members/matches/home use paginated API endpoints.
5. Native messaging uses `/api/v1` chat endpoints.
6. Native permission prompts replace browser permission alerts.

Phase B:

1. Remove Capacitor `server.url`.
2. Keep web pages only for legal/support content if needed.
3. Replace remaining WebView flows with native screens.

## Critical Rule

The app is not considered rebuilt while Android depends on loading the full Vercel website.

