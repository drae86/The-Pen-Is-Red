// Rate limiting is enforced via per-token Postgres quota checks in the route
// handlers rather than an in-memory store. This ensures limits are durable
// across restarts and cannot be bypassed by spoofing network-layer headers.
// See artifacts/api-server/src/routes/analyses.ts for the implementations:
//   - enforceCreateQuota  — POST /analyses (5 per token per 10 min)
//   - enforceSolutionsQuota — GET /analyses/:id/solutions (10 per token per 10 min)
