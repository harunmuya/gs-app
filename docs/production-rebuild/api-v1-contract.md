# API v1 Contract

## Response Shape

Success:

```json
{
  "ok": true,
  "apiVersion": "v1",
  "generatedAt": "2026-07-10T00:00:00.000Z"
}
```

Failure:

```json
{
  "ok": false,
  "apiVersion": "v1",
  "generatedAt": "2026-07-10T00:00:00.000Z",
  "error": {
    "code": "PACKAGE_REQUIRED",
    "message": "Voice notes are not included in your current package.",
    "redirectTo": "/packages"
  }
}
```

## Error Codes

1. `BAD_REQUEST`
2. `UNAUTHORIZED`
3. `NOT_FOUND`
4. `ACCOUNT_RESTRICTED`
5. `PACKAGE_REQUIRED`
6. `PACKAGE_EXPIRED`
7. `FEATURE_NOT_INCLUDED`
8. `DAILY_LIMIT_REACHED`
9. `PAYMENT_PENDING`
10. `PERMISSION_REQUIRED`
11. `SERVER_MISCONFIGURED`
12. `SERVER_ERROR`

## Endpoints Added

### `GET /api/v1/bootstrap`

Purpose: native app startup configuration.

Includes:

1. App name and API base.
2. Legal policy versions.
3. Android permission matrix.
4. Known endpoint map.
5. Package rows.
6. Feature flags.

### `GET /api/v1/health`

Purpose: monitoring and deployment health.

Checks:

1. Supabase URL present.
2. Supabase anon key present.
3. Supabase service role key present.
4. Users table readable.
5. Package tiers readable.

### `GET /api/v1/entitlements?userId=...`

Purpose: package state for UI and native feature locks.

Returns:

1. Active tier.
2. Feature booleans.
3. Daily limits.

### `POST /api/v1/entitlements`

Body:

```json
{
  "userId": "uuid",
  "feature": "voiceNotes"
}
```

Purpose: server-side feature validation before native or web clients open restricted flows.

## Next API v1 Endpoints To Implement

1. `/api/v1/auth/session`
2. `/api/v1/onboarding/profile`
3. `/api/v1/members`
4. `/api/v1/matches`
5. `/api/v1/chat`
6. `/api/v1/calls`
7. `/api/v1/live`
8. `/api/v1/media`
9. `/api/v1/payments`
10. `/api/v1/admin/attention`

