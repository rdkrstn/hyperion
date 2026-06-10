# Hyperion Architecture

## Runtime Shape

Hyperion is a domain-driven React app with a local-first public demo and Supabase production scaffolding. `src/App.tsx` is route composition only; workflow logic lives in domain services and shared orchestration.

Runtime data starts empty. Local mode persists only local development records; production persistence is Supabase.

## Source Layout

```txt
src/
  app/
    routes/
    layout/
    guards/
  domains/
    leads/
    deals/
    qualification/
    solar-snapshot/
    surveys/
    documents/
    proposals/
    client-portal/
    financing/
    tickets/
    analytics/
  shared/
    api/
    types/
    ui/
    utils/
```

Rules:

- Pages live in `domains/*/pages`.
- Domain UI lives in `domains/*/components` when split from a page.
- Domain mutations/query logic lives in `domains/*/services` or `domains/*/rules`.
- Generic UI and helpers live in `shared/*`.
- `src/app/routes/routeConfig.ts` is the single route metadata source. `src/lib/routes.ts` re-exports it for compatibility.
- shadcn/ui source components live in `src/components/ui`; shared app wrappers live in `src/shared/ui`. DaisyUI remains as a transition baseline, while refactored lifecycle surfaces use shadcn primitives.
- `shared/api/businessMutations.ts` is the production mutation boundary. It calls Supabase Edge Functions for intake, OCR, Maps, Solar Snapshot, readiness, remote intake, document validation, survey dispatch/evidence, proposal generation, compliance docs, and contract acceptance.
- `shared/api/solarOpsStore.ts` is the local development fallback orchestrator. It must not be treated as the production source of truth.
- Internal `SolarOps` names are legacy implementation names retained during the Hyperion public demo release to avoid a broad, risky rename.

## Domain Boundaries

- Leads own inquiry, qualification, bill OCR state, energy profile, site profile, goals, readiness, documents, and timeline.
- Deals own the commercial opportunity, linked lead snapshot/reference, stage/status/value, sales owner, survey state, proposal state, portal state, win/loss, commercial packet, financing readiness, and timeline.
- Qualification owns section scoring/checklist rules.
- Solar Snapshot is shared site intelligence linked to lead and optionally deal; it is surfaced in lead, deal, and survey views before dispatch.
- Lead intake includes the manual rooftop pin in the Location and utility section. The Lead Solar Snapshot view also includes the map for correction/review. Clicking or dragging the pin updates the lead site profile latitude/longitude; address lookup can also capture `placeId` and standardized address. If Maps fails, staff can enter coordinates manually. A confirmed lat/lng is enough to create the lead and trigger Solar Snapshot review in local development fallback.
- Solar Snapshot stores a draft panel allocation: panel wattage, selected panel count, selected kWp, max panels, and estimated annual production. Lead, deal, and proposal views can adjust this allocation through an operator-facing roof review with satellite context, metrics, and panel controls, while survey views surface it for installer context. Proposal draft creation captures the current allocation into the proposal revision.
- The roof review is not an API demo. It should match the clean dashboard style and avoid raw API-response panels or tutorial copy. It must not draw fake roof masks on real maps. Panel overlays render from Google Building Insights when panel center geometry exists; otherwise the UI can show a clearly labeled estimated array from the local Solar Snapshot roof capacity. Data Layers/GeoTIFF mask, DSM, RGB, and flux rendering is deferred.
- Surveys own installer assignment, schedule, evidence, findings, blockers, and validation outcome.
- Documents own private file vault metadata and validation state. `/documents/:id` is the detail/viewer route; local mode reads data URLs and Supabase mode requests private signed URLs through the `document-signed-url` Edge Function.
- Proposal gates derive required document readiness from linked document records at mutation time so stale deal summary fields cannot block a proposal after CS/owner validation.
- Proposals own formal scope lines, pricing, margin approval, frozen estimate, customer-facing printable proposal preview, contract link, invoice, mocked payment ledger, and client creation after acceptance.
- Net-metering is surfaced as an ordered workflow in Deal, Documents, Proposal, Client Portal, and public contract/proposal views. The first three steps gate proposal readiness: eligibility, validated documents, and installer technical review.
- Client Portal owns public token status and customer-facing value pages.
- Financing stays embedded as readiness/packet state in lead/deal/proposal flows.
- Tickets own internal aftersales/support operations.
- Analytics owns owner/manager report surfaces.

## Routes

Primary protected routes:

- `/dashboard`
- `/pipeline`
- `/workbench`
- `/analytics`
- `/automations`
- `/docs`

Operational detail routes remain available behind the app shell:

- `/leads`, `/leads/new`, `/leads/:id`
- `/deals`, `/deals/:id`
- `/surveys`, `/surveys/:id`
- `/documents`, `/documents/:id`
- `/proposals`, `/proposals/:dealId`
- `/calendar`, `/portal-links`, `/tickets`, `/settings`

Public routes:

- `/signin`
- `/inquiry`
- `/remote-intake/:token`
- `/portal/:token`
- `/contracts/:token`

Legacy preview routes are not active handlers: `/crm`, `/opportunities`, `/checkout`, `/billing`, `/reports`, `/ai-assist`, `/notifications`, and `/clients`. They render the unavailable route page with a canonical replacement instead of silently redirecting.

## State Machine

Canonical lifecycle:

`Lead Captured -> Qualified -> Deal Created -> Solar Snapshot Reviewed -> Survey Scheduled -> Survey Validated -> Proposal Built -> Client Portal Shared -> Contract Accepted -> Won -> Installation / Net-Metering / Aftersales`

The UI exposes the next valid action for the current state instead of showing unrelated actions.

Main blockers:

- Needs Bill
- Needs Site Control
- Needs Financing Info
- Solar Snapshot Pending
- Manual Dispatch Override Needed
- Survey Blocked
- Docs Missing
- Proposal Approval Needed
- Contract Pending

## Supabase Boundary

The clean baseline migration creates separate canonical tables for leads, deals, solar snapshots, surveys, documents, proposals, portals, clients, tickets, calendar events, and timeline events. RLS is enabled on all public tables.

Production business mutations go through Edge Functions. React owns loading state, form state, selected tabs, modal state, and rendered tables; Supabase Functions own stage gates and multi-table mutations; Postgres owns canonical records.

Shared Edge Function utilities live in `supabase/functions/_shared`: `cors`, `auth`, `supabaseAdmin`, `errors`, `timeline`, `readiness`, `storage`, and `google`. Functions return `{ ok: true, data }` or `{ ok: false, error }`.

Public inquiry, remote intake, Client Portal, and contract signing must go through Edge Functions in production. Browser code never receives service-role, Google Vision, Google Maps server, OpenAI, or payment-provider secrets.
