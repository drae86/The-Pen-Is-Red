# The Pen Is Red

Advanced red-teaming and document analysis platform — submit any text for deep adversarial, defensive, symbolic, or philosophical critique powered by AI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/pen-is-red run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI proxy

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind, shadcn/ui, framer-motion, wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: Replit AI Integrations (OpenAI gpt-5.4)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/analyses.ts` — analyses table schema
- `artifacts/api-server/src/routes/analyses.ts` — analysis API routes + AI logic
- `artifacts/pen-is-red/src/` — React frontend
- `artifacts/pen-is-red/src/components/` — analysis-form, analysis-view, sidebar components

## Architecture decisions

- All AI analysis runs server-side via OpenAI gpt-5.4 — lens-specific system prompts shape the entire character of the analysis
- Analysis results are stored as JSONB columns in Postgres for flexible schema
- The "solutions" endpoint is on-demand (not computed at analysis time) to avoid excessive API costs
- Word/char counting uses Unicode-aware spread operator (`[...text].length`) to correctly handle glyph alphabets and multi-byte characters
- Analysis text is kept in the DB (`documentText` column) for re-analysis and solution generation

## Product

- Submit any document (research paper, code, policy, essay, manifesto) for deep adversarial analysis
- Four analysis lenses: Red Team (adversarial), Blue Team (defensive), Symbolic (metaphor/archetype), Philosophical (epistemological)
- Results include: executive summary, scored sections, severity-ranked findings, citation verification, recommendations
- On-demand solution generation for each identified oversight
- Sidebar saves all past analyses for easy reference and comparison
- Live word/character count as you type

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`
- Deep imports from `@workspace/api-client-react/src/generated/...` are not valid — use `@workspace/api-client-react` only
- Analysis requests can take 20-30 seconds — the frontend shows a loading overlay

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
