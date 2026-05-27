# Agent Instructions

## Project Purpose

Solar Ops is a single-company operating system for solar installers. The clean demo IA is organized around Leads, Deals, shared Solar Snapshots, Surveys, Documents, Proposals, Client Portal links, Tickets, and Owner/Manager Analytics. Leads qualify the buyer; Deals commercialize the project; Solar Snapshots validate the site before dispatch; Surveys prove technical feasibility; Documents clear blockers; Proposals convert; Client Portal builds trust; Tickets support aftersales.

## Stack

- Vite
- React
- TypeScript
- React Router
- Tailwind CSS + DaisyUI
- shadcn/ui source components for forms, tabs, dialogs, tables, sheets, alerts, calendar/list workflows, and Recharts-backed charts
- Supabase Auth, Postgres, RLS, Storage, Edge Functions, and pgvector
- OpenAI embeddings/summaries only from Edge Functions
- Gemini bill OCR first and Google Vision fallback only from Edge Functions
- Google Maps browser key for Places/map UI and server key for Solar/Routes Edge Functions
- Vitest for business logic and Edge Function handler verification

## Code Organization

- `src/App.tsx` is route composition only.
- App shell/route metadata lives in `src/app`.
- Domain pages, services, rules, and types live under `src/domains/*`.
- Production mutation clients live in `src/shared/api/businessMutations.ts`.
- Cross-domain local development fallback orchestration lives in `src/shared/api/solarOpsStore.ts`.
- Shared business-neutral UI, types, and utilities live under `src/shared`.
- The canonical Supabase baseline is `supabase/migrations/20260521183144_clean_domain_state_machine.sql`.

## Required Commands

Run these before claiming implementation is complete:

```powershell
npx vitest run
npm run build
npx supabase db reset
```

If a UI change is made, also start the app with:

```powershell
npm run dev
```

## Non-Negotiable Workflow Rules

- Keep strict stage gates.
- Keep `/inquiry`, `/remote-intake/:token`, `/portal/:token`, and `/contracts/:token` public; operational pages stay protected by the dashboard shell.
- Runtime business data must not come from seeded fixtures. Local mode starts empty and is only for development; production persistence requires Supabase.
- Recording data must be loaded only through the explicit local `Load demo data` action. Do not auto-seed runtime state on startup.
- `/inquiry` and `/leads/new` use the Solar Readiness Intake wizard, not a compact inline lead form.
- `/leads/new` is also the D2D field capture surface: use constrained dropdowns/toggles, electric bill upload, fallback electric bill, monthly kWh fallback, Places/pin/GPS prompt with fallback, and no broad free-text capture except contact/location/notes. Do not collect customer roof photos in intake; Google Solar API plus pinned coordinates own roof mapping. If the peso bill is missing but kWh is captured, derive the first bill estimate at PHP 11/kWh for readiness until OCR replaces it.
- `/leads/:id` must let staff recover incomplete intake without recreating the lead: editable qualification answers for business fit, site control, goal, daytime usage, and bill estimate, plus lead-level document upload before a deal exists.
- File vault UI must manage real file payloads in local development: upload, view, download, replace, and delete. Metadata-only records should route to `/documents/:id` and request a Supabase signed URL in production; they should not pretend they can be viewed or downloaded without payload or signed URL access.
- Energy Graph lives under Lead Energy Profile. Do not re-add a separate Bill OCR tab. Customer Bill records can trigger Gemini OCR from Energy Profile or `/documents/:id`; local mode must be labeled local/manual when it uses fixtures or manual graphing.
- Lead intake and Lead Solar Snapshot views must provide manual rooftop pin confirmation. The pin uses only `VITE_GOOGLE_MAPS_BROWSER_KEY` in React, stores lat/lng/place/address fields on the lead site profile, and falls back to manual coordinate entry when Maps is unavailable. A confirmed lat/lng is valid location evidence even when the typed address is blank.
- Sales owns lead capture, qualification, pre-audit, survey assignment, proposal estimate, contract generation, Client Portal links, and follow-up.
- Sales survey assignment must be an Assign + Schedule Survey action with installer, date/time, and location. It must create a survey job plus linked calendar event, and it must be blocked until Solar API is ready or owner/manager override is approved.
- Installer owns assigned survey evidence uploads and survey completion. Required evidence must be uploaded before completion, and completion records installer validation.
- CS owns document readiness, invoice/payment-status review, and owner-review submission. CS does not own survey validation or the Surveys route.
- Owner gives final deal approval and refund approval.
- Manager can review analytics and operational records, but cannot owner-approve deals or refunds.
- AI is limited to owner and manager summaries/review. It must not send messages, approve deals, bill clients, or advance stages.
- AI summaries may summarize analytics, deals, tickets, and financing readiness for owner/manager review only. AI is hidden from the clean demo navigation and must not create outbound drafts.
- Staff sign-in uses Supabase magic link when configured and local workspace fallback when not configured. Roles come from employee profiles; the profile switcher is local-development only.
- Quote requests are created and managed only by sales/owner and must convert to a proposal estimate before becoming contract-ready.
- Client Portal links are public token pages with readiness/value/financing/net-metering context and a formal quote CTA only. Do not add customer-facing AI or live explainers.
- Remote intake links are 48-hour token pages for electric bill, valid ID, and site-control uploads. Production access must validate both DB token state and signed JWT. Delivery is manual copy/send unless a real SMS/email integration is explicitly added later.
- Deals use a CRM-style table, not a Kanban board. Deal status is commercial outcome: `open`, `won`, `lost`, `cancelled`, or `archived`.
- Bill OCR must run server-side through `bill-ocr-preaudit`. Use `GEMINI_API_KEY` for structured bill extraction first and `GOOGLE_VISION_API_KEY` as fallback. The LLM may extract bill fields only; readiness scoring, annualization, and stage changes remain deterministic.
- Google Solar and Routes calls must run server-side through Edge Functions with `GOOGLE_MAPS_SERVER_KEY`. If Google is unavailable, store `maps_pending`; do not pretend enrichment succeeded.
- Solar API roof review is a shared Solar Snapshot and pre-survey dispatch gate, not just a proposal warning. Lead/deal/survey workspaces must show roof capacity, panel max, selected panels, selected system size, estimated production, imagery quality, risk flags, and next action.
- A lead created with a confirmed pin should immediately produce a Solar Snapshot in local development fallback; production should call the Maps/Solar Edge Function path from the same confirmed coordinates.
- Solar Snapshot panel allocation is a pre-proposal draft control. Staff may add/remove panels and adjust panel wattage, but selected panels must stay capped by the Solar API roof maximum; formal proposal lines still require the editable Solar Scope Builder.
- Solar Snapshot visual editing should feel like an operator-facing roof review, not an API demo: satellite context, roof metrics, selected panel controls, and deterministic selected panel count. Do not show raw API response buttons or tutorial copy in the workflow UI. Render Google panel overlays when Building Insights returns real panel center geometry; otherwise a clearly labeled estimated panel layout may render from the local Solar Snapshot capacity for operator review. Do not render fake roof masks. Data Layers/GeoTIFF mask, DSM, RGB, and flux rendering is a future pass.
- Proposal creation must freeze the current Solar Snapshot panel allocation into the proposal revision. If staff changes panels after a draft exists, create a new proposal revision rather than mutating the frozen snapshot summary.
- Browser Places/map UI may use only the browser-restricted `VITE_GOOGLE_MAPS_BROWSER_KEY`.
- Net-metering required unblockers are customer bill upload, utility/provider, ownership/site-control answer, installer technical review, generated Annex PDFs, and `ready_for_lender` status. Proposal/CS readiness must respect those gates.
- Installer survey completion requires Main Breaker Panel, Roof Surface, Inverter Location, Wire Run Path uploads, and roof structural soundness answer.
- Proposal estimates use the editable Solar Scope Builder. Auto-generated lines are draft suggestions only and must carry source reasons, cost, margin, and manual edit state.
- Proposal document readiness must be derived from linked document records at mutation time. Do not trust stale cached deal document status if linked `customer_bill`, `valid_id`, and `site_control_document` rows are already validated. Lead-level validated documents count for the deal, and the UI must show the exact missing category.
- Quote margin below 25% requires owner/manager pricing approval before freezing or contract generation.
- Proposal/contract generation must use preflight gates for OCR/pre-audit, Solar API verification or owner/manager override, installer validation payload, validated File Vault requirements, generated Annex 1/Annex 2 PDFs, `ready_for_lender` net-metering state, frozen formal estimate, pricing approval when needed, and frozen proposal.
- `src/app/routes/routeConfig.ts` is the canonical route metadata source. Do not create a second route config.
- Removed legacy paths must render the unavailable route page with a replacement module, not silently redirect.
- Prefer shadcn/ui source components for new or refactored lifecycle surfaces. Keep DaisyUI available only as the broad transition baseline.
- Proposal acceptance remains provider-ready mocked billing. Never collect card numbers, bank credentials, or payment tokens.
- Frozen proposals are print-friendly HTML snapshots in v1; PDF export is deferred.
- Archive and restore operational records by state. Do not hard delete leads, deals, contracts, invoices, tickets, billing, cancellation, or refund records.
- Refunds are ledger records only. Sales/CS can request, owner approves or rejects, and no real provider refund is executed.
- Public inquiry and contract signing must go through Edge Functions in production; do not open broad anon table access.
- Public Client Portal access must go through the token Edge Function path in production; do not open broad anon table reads.
- Public remote intake access must go through `remote-intake-access` in production; do not open broad anon table or bucket writes.

## Supabase Rules

- RLS must be enabled on every public table.
- Do not use `user_metadata` for authorization.
- Store staff roles in database-controlled `staff_profiles` rows.
- Store profile preferences and editable profile fields separately from user-editable auth metadata.
- Keep `clients` as dedicated post-acceptance/support records, but hide Clients as a primary staff sales module in the clean demo.
- Store survey evidence in the private `survey-evidence` Storage bucket.
- Store readiness and remote-intake bill uploads in the private `readiness-uploads` Storage bucket through signed upload references.
- Store deal-level documents and artifacts in the private `deal-files` bucket with signed upload/download URLs. File uploads begin `needs_review`; only CS/owner validation clears required document blockers.
- Lead-level documents also use the vault metadata path and can satisfy later deal proposal gates after validation. Replacing a document resets validation to pending; deleting a document must re-sync proposal blockers.
- Store official compliance Annex templates in `compliance-doc-templates` and generated PDFs in `compliance-documents`.
- Financing packets must include bill summary, system size, savings/payback, affordability, site readiness, installer quote, net-metering state, and risk flags.
- Use pgvector `report_embedding_chunks` for analytics/report RAG.
- Keep `GEMINI_API_KEY`, `GOOGLE_VISION_API_KEY`, `GOOGLE_MAPS_SERVER_KEY`, `OPENAI_API_KEY`, and Supabase service-role/secret keys server-side only.
- Edge Functions may use `SUPABASE_SERVICE_ROLE_KEY` as a server-side secret only.
- Internal automation events/outbox records are allowed; external n8n/Make webhook dispatch is out of scope unless explicitly requested.
- Compliance rules must be versioned in `compliance_rules`; SLA working-day calculations exclude weekends and rows in `compliance_holidays`. `DEEMED APPROVED (RA 11032)` relieves the internal compliance blocker but preserves audit that the actual government document is pending.
- Keep privileged helper functions outside exposed schemas when possible.

## Documentation Rule

Every implementation pass that changes behavior, schema, workflow, setup, or commands must update the relevant docs in `README.md`, `docs/`, `AGENTS.md`, or `MEMORY.md`.
