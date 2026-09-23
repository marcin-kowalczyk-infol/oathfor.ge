# Initial API contract

Implemented in MVP-02-T03. Local contract decision, 2026-09-23.

`GET /api/health` is public and returns HTTP **200**, `Content-Type: application/json`, and exactly:

```json
{"status":"ok"}
```

This endpoint reports process liveness. It does not query PostgreSQL, Redis, workers or external providers and does not report dependency readiness. It returns no environment, version, credentials or diagnostic fields. No authentication or product behavior is implied by this synthetic connectivity endpoint.

Consumers must check the HTTP status and validate the JSON object before displaying success. Network errors, unsuccessful responses or invalid payloads are recoverable connectivity errors, not player outcomes. The Expo diagnostic shell implements this validation; native-device acceptance remains pending. Local boundary rule: [architecture](architecture.md).

Producer verification: `composer test -- --filter HealthEndpointTest` from `apps/api`, using a real Symfony test kernel without database/queue adapters. A local HTTP server check is documented in [development](development.md) when verified.
