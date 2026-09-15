# Threat Model

## Project Overview

The Pen Is Red is a React + Express application that accepts user-submitted text or code, sends it to OpenAI for analysis, stores the original document and structured analysis output in PostgreSQL, and lets users revisit prior analyses and generate follow-up solutions. The current production deployment is a private Replit deployment, so endpoints are not exposed to the public internet, but any analysis must still treat deployment viewers and browser clients as untrusted.

## Assets

- **Submitted document contents** — `documentText` may contain sensitive drafts, code, policies, or proprietary research. Disclosure is the highest-impact risk in this project.
- **Derived analysis output** — executive summaries, findings, citations, and recommendations may expose the substance of the original document even when the full text is not shown.
- **Application spend and model quota** — OpenAI-backed analysis and solution generation can consume paid tokens and backend capacity.
- **Application secrets** — `DATABASE_URL`, OpenAI integration credentials, and any deployment-scoped secrets used by the backend.
- **Database integrity** — stored analyses must not be deleted or modified by unauthorized principals.

## Trust Boundaries

- **Browser to API** — all frontend requests cross into the Express API. The browser is untrusted; authentication, authorization, and abuse controls must be enforced server-side.
- **API to PostgreSQL** — the backend has full read/write access to stored analyses. Any broken access control at the API layer exposes the entire dataset.
- **API to OpenAI integration** — the server sends user-controlled document content and stored findings to an external model provider. This boundary affects confidentiality, cost, and availability.
- **Deployment access boundary** — Replit private deployment visibility narrows the attacker set versus a public app, but it does not provide per-record authorization or tenant isolation inside the application.
- **Production vs dev-only artifacts** — `artifacts/mockup-sandbox/` is considered dev-only and should be ignored unless production routing or build configuration makes it reachable.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/`, `artifacts/pen-is-red/src/main.tsx`, `artifacts/pen-is-red/src/App.tsx`
- **Highest-risk code areas:** `artifacts/api-server/src/routes/analyses.ts`, `lib/db/src/schema/analyses.ts`
- **Public/authenticated/admin surfaces:** no application-level auth or role model is currently implemented in the production API; all API routes should be treated as same-trust unless proven otherwise
- **Dev-only areas:** `artifacts/mockup-sandbox/`

## Threat Categories

### Spoofing

This project currently relies on deployment visibility rather than application identity. If the application is intended for more than one human user or if deployment access broadens later, the backend must authenticate callers and bind each stored analysis to a server-validated principal. Client hints such as optional bearer-token support in shared API utilities are not sufficient unless the server actually enforces them.

### Tampering

The API accepts user-controlled document content and persists AI-derived results. The application must ensure that delete and other state-changing operations are authorized server-side for the specific record being acted on. Prompt content and model output are untrusted data and must not be treated as trusted control input.

### Information Disclosure

The core risk is exposure of stored document text and derived analyses across users or deployment viewers. The system must ensure that list, read, stats, and solution-generation endpoints only expose records to the principals authorized to view them. Logs and error paths must avoid leaking secrets, auth material, and raw sensitive content beyond what operators explicitly need.

### Denial of Service

`POST /api/analyses` and `GET /api/analyses/:id/solutions` trigger expensive model calls. The system must enforce request throttling, cost controls, or per-principal quotas so one caller cannot consume disproportionate model spend or backend capacity. External AI calls should also fail safely without cascading into repeated retries or unbounded work.

### Elevation of Privilege

Because the app stores analyses in a shared table with no visible ownership model, any future multi-user use would be especially sensitive to broken object-level authorization. The application must enforce record ownership or equivalent tenant isolation on every read/write route that references an analysis ID.