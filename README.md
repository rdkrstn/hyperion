# Hyperion

Hyperion is a public demo/reference implementation for solar PV installer operations. It packages the existing installer lifecycle into a cleaner first-run experience: Overview, Pipeline, Workbench, Automations, Analytics, and Docs.

The v1 public demo is local-first by default. It starts empty, runs without paid APIs, and only loads sample business records when a user clicks `Load golden demo` or `Load demo data`.

## What It Demonstrates

- Lead intake and qualification for solar buyers.
- Deal pipeline tracking from captured lead to won project.
- Solar Snapshot review with manual rooftop pin and panel allocation.
- Document vault readiness, survey validation, proposal gating, and contract-ready handoff.
- Net-metering readiness checkpoints.
- Local automation handoff recipes that can optionally map to n8n webhooks.
- Supabase schema, RLS, Storage, and Edge Function scaffolding for production integration.

## Current Status

| Area | Status |
|---|---|
| Public UI shell | v1 demo-ready |
| Golden demo loop | v1 demo-ready |
| Local workflow store | Built |
| Supabase schema and Edge Functions | Scaffolded |
| Production Supabase query hydration | Partial |
| n8n automation | Local simulation by default |
| License | Apache-2.0 |

Hyperion is not a hosted SaaS product and does not claim production readiness out of the box. The backend foundation is present, but the active public demo UI still uses the local development store for many interactions.

## Quickstart

```powershell
npm install
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173`.

Run checks:

```powershell
npx vitest run
npm run build
npm audit --omit=dev
```

If you are working against a local Supabase stack, also run:

```powershell
npx supabase db reset
```

## Environment

Create `.env.local` from `.env.example`.

```env
VITE_APP_NAME=Hyperion
VITE_APP_ENV=local
VITE_DEMO_MODE=true
VITE_AUTOMATION_MODE=local
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_GOOGLE_MAPS_BROWSER_KEY=
```

Server-side secrets belong only in Supabase Edge Function secrets:

```powershell
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set GEMINI_API_KEY=...
supabase secrets set GOOGLE_VISION_API_KEY=...
supabase secrets set GOOGLE_MAPS_SERVER_KEY=...
supabase secrets set REMOTE_INTAKE_JWT_SECRET=...
supabase secrets set OPENAI_API_KEY=...
```

Do not put service-role keys, Gemini keys, Google Vision keys, Google Maps server keys, OpenAI keys, remote-intake signing secrets, or n8n secret webhook URLs in browser-exposed `VITE_` variables.

## Golden Demo

Use the app shell controls:

- `Load golden demo`: loads the Iloilo Mini Mart lifecycle.
- `Next action`: advances the demo through documents, survey validation, proposal, contract, and won state.
- `Reset`: clears local demo state.

The demo never auto-seeds on startup. It is a manual local action so contributors can inspect empty states and first-run behavior.

## Source Layout

```txt
src/
  app/              route composition, shell, guards, route metadata
  components/ui/    source-owned shadcn/ui components
  domains/          feature pages, services, rules, and types
  shared/           local store, demo helpers, UI primitives, utilities
supabase/
  migrations/       canonical database baseline
  functions/        Edge Functions and shared server helpers
docs/               public contributor and architecture docs
```

`src/app/routes/routeConfig.ts` is the canonical route metadata source. `src/shared/api/businessMutations.ts` is the production mutation boundary. `src/shared/api/solarOpsStore.ts` is the local development fallback orchestrator.

Some internal files still use the old `SolarOps` naming while the public product name has moved to Hyperion. Those names are kept temporarily to avoid a risky broad rename during the public demo release.

## Supabase

Canonical baseline:

```txt
supabase/migrations/20260521183144_clean_domain_state_machine.sql
```

The migration includes staff profiles, leads, lead energy/site profiles, qualification, bill uploads, solar snapshots, deals, documents, remote-intake tokens, surveys, evidence, proposals, billing, contracts, client portals, clients, financing packets, compliance, net-metering workflows, calendar events, tickets, timeline events, notifications, and report embedding chunks.

Production public access should go through Edge Functions for inquiry, remote intake, client portal, and contract signing. Do not open broad anonymous table or bucket access.

See [docs/supabase.md](docs/supabase.md) for setup notes.

## Automation Handoffs

Hyperion includes local automation recipes for:

- lead captured
- documents missing
- proposal sent
- survey validated
- net-metering blocked
- contract ready

The default is `VITE_AUTOMATION_MODE=local`. Webhook dispatch is opt-in and should be reviewed before production use.

See [docs/automation-handoffs.md](docs/automation-handoffs.md).

## Documentation

- [docs/project-status.md](docs/project-status.md)
- [docs/local-demo-mode.md](docs/local-demo-mode.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/supabase.md](docs/supabase.md)
- [docs/automation-handoffs.md](docs/automation-handoffs.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [ROADMAP.md](ROADMAP.md)
- [CHANGELOG.md](CHANGELOG.md)

## License

Apache License 2.0. See [LICENSE](LICENSE).
