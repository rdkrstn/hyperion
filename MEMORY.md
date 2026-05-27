# Solar Ops Memory

## Durable Decisions

- Product: Solar inquiry-to-installation operating system.
- Stack: Vite + React + TypeScript + Supabase + React Router + DaisyUI + shadcn/ui source components.
- Supabase usage: Auth, Postgres, RLS, Storage, Edge Functions, and pgvector.
- OpenAI usage: Edge Functions only; `OPENAI_API_KEY` is never exposed to React.
- Dashboard shell: `/signin` is public; operational pages live under protected routes with sidebar/topbar navigation.
- Public routes: `/inquiry` for Solar Readiness Intake, `/remote-intake/:token` for expiring document uploads, `/portal/:token` for Client Portal value review and quote request, and `/contracts/:token` for typed contract acceptance.
- Detail route pattern for the clean demo: `/leads/:id`, `/deals/:id`, `/documents/:id`, `/proposals/:id`, `/surveys/:id`, `/calendar/:id`, `/tickets/:id`, and `/analytics/:id`.
- Legacy demo routes are removed from active routing: `/crm`, `/pipeline`, `/opportunities`, `/checkout`, `/billing`, `/reports`, `/ai-assist`, `/notifications`, and `/clients`.
- Code organization: `src/App.tsx` is route composition only; app shell lives in `src/app`, domain features live in `src/domains`, and shared orchestration/UI/types live in `src/shared`.
- Business mutation boundary: React calls Supabase Edge Functions through `src/shared/api/businessMutations.ts`; React owns UX state, Functions own stage gates and multi-table mutations, and Postgres owns canonical records.
- Canonical database baseline: `supabase/migrations/20260521183144_clean_domain_state_machine.sql`; older preview migrations are intentionally removed.
- UI boundary: subtle corporate/light dashboard using DaisyUI as a transition baseline and shadcn/ui source components for high-friction lifecycle surfaces, including tabs, dialogs, cards, tables, forms, sheets, alerts, badges, and calendar/list workflows.
- Route boundary: `src/app/routes/routeConfig.ts` is the single route metadata source. Legacy preview routes render a designed unavailable page with canonical replacements instead of redirecting.
- Data mode: production persistence requires Supabase; local mode starts empty and is for development only. Seed data is test fixture data only.
- Local demo seed boundary: Dashboard, Leads, and Settings expose an explicit `Load demo data` action for recordings. It loads fixed `demo-*` local records for Iloilo Mini Mart, Maria Santos, Jaro Print & Packaging, Atria Cold Storage, Iloilo Montessori School, and Oton Water Refilling Station, replaces prior demo records on repeat clicks, and does not change the default empty startup behavior.
- Lead list and lead detail read the same stored `readinessScore`. Detail pages must not recalculate readiness on render because curated demos and server-loaded records already carry canonical readiness values; readiness changes should come through explicit qualification/OCR/readiness mutation paths.
- Tenancy: single solar company first, not multi-tenant SaaS.
- RBAC: owner, manager, sales, cs, installer.
- Roles are database-controlled, not based on user-editable metadata.
- Staff source of truth: `staff_profiles`.
- Client source of truth: dedicated `clients` table linked to qualified/signed deals.
- Qualification boundary: inquiry moves through qualification tabs before becoming a qualified lead and then a deal.
- Readiness boundary: intake captures bill, business, usage, roof/site attributes, location/utility, budget, battery/group-buy interest, pinned location, and electric bill upload references. Customer roof photos are removed from intake; Google Solar API plus coordinates own roof mapping.
- D2D field boundary: `/leads/new` is mobile-first and constrained around dropdowns/toggles, bill upload, Places/pin/GPS with fallback, fallback electric bill, monthly kWh fallback, and no customer roof-photo upload. A kWh-only capture derives the first bill estimate at PHP 11/kWh so readiness can calculate before OCR. Energy Profile owns the bill graph; bill OCR uses Gemini structured extraction first with Google Vision fallback, while deterministic math owns annualization, readiness, sizing, ROI, and stage gates.
- State-machine UI boundary: lead detail must show qualification progress, blockers, and the single next stage CTA instead of unrelated action piles. Override qualification is modal-based and audit-visible.
- Remote intake boundary: staff generate/copy/manual-send 48-hour links for customer electric bill, valid ID, and site-control uploads. Production access goes through `remote-intake-access` with DB token plus signed JWT validation, not anon table or bucket permissions.
- Maps boundary: Places/pin capture uses `VITE_GOOGLE_MAPS_BROWSER_KEY`; Solar building insights and Routes matrix use `GOOGLE_MAPS_SERVER_KEY` through Edge Functions. Missing Google credentials or failed calls create explicit `maps_pending` state.
- Manual pin boundary: `/leads/new` and the Lead Solar Snapshot tab expose a Google hybrid map with click/drag pin confirmation, device location, address lookup, and manual coordinate fallback. The confirmed pin is persisted on `siteProfile`, counts as location evidence even without typed address text, and feeds Solar Snapshot readiness.
- Solar API boundary: verified Solar API roof capacity creates the shared Solar Snapshot and caps formal quote sizing. Missing/low-quality Solar API data blocks survey dispatch and proposal/contract until owner/manager override is recorded.
- Solar panel allocation boundary: Solar Snapshot stores max panels, selected panels, panel wattage, selected kWp, and estimated annual production. Staff can adjust the pre-proposal panel count from Lead, Deal, or Proposal views, but it is capped by the roof maximum. Proposal draft creation freezes the current panel layout into the proposal revision.
- Solar visual editor boundary: Lead, Deal, and Proposal Solar Snapshot views use an honest clean satellite roof review with metrics and panel controls. Fake roof masks or arrays must not render on real maps; panel overlays render only when Google Building Insights returns real `solarPanels` center geometry. Data Layers/GeoTIFF mask, DSM, RGB, and flux rendering is deferred.
- Solar dispatch boundary: Solar API roof review must happen before installer dispatch. `pre_audit_done -> survey_assigned` requires Solar API ready or owner/manager manual dispatch override; sales cannot bypass this alone.
- File Vault boundary: lead-level and deal-level files live as polymorphic `documents` rows backed by the private `deal-files` bucket. Uploads start `needs_review`; CS/owner validation is required before required customer bill, valid ID, and site-control blockers clear. Lead-level documents can be uploaded before a deal exists and later satisfy proposal document gates. Local mode stores uploaded payloads as data URLs so view, download, replace, and delete work without Supabase Storage; replacement resets validation and deletion reopens blockers.
- Document viewer boundary: `/documents/:id` is the canonical file detail route. Local mode previews stored data URLs; Supabase mode requests a short-lived signed URL through `document-signed-url` and never exposes broad public bucket access. Customer Bill documents can trigger bill OCR from the viewer or Lead Energy Profile.
- Energy Graph boundary: the old Bill OCR tab is removed. Bill extraction output and the 12-month observed/annualized bar chart live under Lead Energy Profile. Production OCR uses Gemini structured image extraction first with Google Vision fallback through `bill-ocr-preaudit`; local mode is labeled local/manual and may parse known Meralco fixture filenames for recording.
- Automation boundary: OCR, pre-audit, packet, Client Portal, and quote actions write internal automation events/outbox records; no external n8n/Make webhook dispatch is built yet.
- Feedback boundary: mutating UI actions use shared loading, toast/inline feedback, confirmations for destructive/financial actions, and duplicate-click guards.
- Net-metering boundary: tracked as a workflow across intake, lead, deal, survey, documents, packet, and proposal views; required bill/site-control documents, installer technical review, generated Annex PDFs, and `ready_for_lender` state gate proposal/contract readiness.
- Net-metering UI boundary: Deals, Documents, Proposals, Client Portal, and public proposal/contract views show the ordered workflow: Eligibility, Documents, Technical Review, Application, Metering, Active Credits. Staff see exact blockers, utility/site-control state, validated document state, installer review state, and SLA/deemed-approved badges when available.
- Compliance boundary: CS generates Annex 1 Net-Metering Application and Annex 2 Certificate of Completion from official templates in private Storage. Owner marks final `ready_for_lender`. Rules are versioned in `compliance_rules`; SLA working days exclude weekends and `compliance_holidays`; deemed-approved badges preserve pending-document audit.
- Quote request boundary: staff-only sales/owner requests tied to leads/deals; approved requests can convert into proposal estimates.
- Quote builder boundary: formal proposal estimates are editable Solar Scope Builder drafts. Lines track source reason, quantity, unit price, estimated cost, margin, optional/manual edit state, and notes. Gross margin below 25% requires owner/manager pricing approval before freezing.
- Proposal document gate boundary: proposal creation derives document readiness from linked `documents` rows at mutation time. Validated customer bill, valid ID, and site-control records linked to either the deal or the source lead must clear proposal blockers even if an older cached deal document status says missing. The UI should list exact missing categories.
- Public proposal boundary: `/contracts/:token` is a polished printable web proposal plus typed acceptance, not a bare contract form. Residential proposals include appliance/use-case sections; commercial/MSME proposals include continuity, savings/payback, financing readiness, and operational-value sections.
- POS boundary: proposal estimate, lane-specific contract, typed acceptance, invoice, mocked billing transaction, payment status, and receipt/reference tracking only.
- Payment boundary: provider-ready mock; no real charges and no stored card/bank credentials.
- Billing boundary: ledger records are real operational state; only provider execution is mocked.
- Financing boundary: lender-ready solar packet with bill summary, system size, savings, payback, affordability, site readiness, installer quote, net-metering state, and risk flags. It is not underwriting and not a partner portal.
- Survey boundary: survey handoff is Assign + Schedule Survey with installer, date/time, and location, creating both survey job and calendar event. Installer uploads required evidence and completes survey validation; CS has no survey route/action, and owner approval is final deal approval only.
- Installer evidence boundary: required survey queue is Main Breaker Panel, Roof Surface, Inverter Location, Wire Run Path, plus a roof-structural-sound yes/no answer before survey completion.
- Survey blocker boundary: disabled installer completion must explain the exact blocker, including the roof remediation message when roof soundness is No.
- Client Portal boundary: customer-facing value page has no AI. It shows readiness, savings/payback, financing options, net-metering checklist, installer readiness, and a formal quote CTA only.
- AI boundary: owner/manager report and operations summaries only; no outbound drafts, state mutation, customer messaging, billing, or approvals.
- RAG boundary: analytics snapshots and report chunks use Supabase pgvector with `text-embedding-3-small` embeddings.
- Record lifecycle: archive/restore instead of hard delete for operational records.
- Safe removal boundary: only untouched captured leads may be hard removed; anything with operational history is archived/cancelled with audit history.
- Notifications boundary: in-app role/profile notifications drive work queues; external email/SMS remains out of scope.
- Refund boundary: operational ledger only; sales/CS can request, owner approves/rejects, and no real refund is issued.
- `/init` means repo bootstrap documentation, not an app route.

## Workflow Stages

`captured -> pre_audit_done -> survey_assigned -> survey_completed -> proposal_ready -> cs_review -> owner_review -> approved`

`nurture` is used for low-priority or unqualified leads.

## Stage Gate Rules

- Readiness score above 70 can auto-create a pre-audit run, advance to `pre_audit_done`, and draft the lender packet.
- Survey assignment requires pre-audit, score, qualified priority, scheduled installer/date/location, and Solar API ready or owner/manager dispatch override.
- Survey completion requires installer evidence and roof soundness answer; database trigger blocks manual stage jumps without complete evidence.
- Proposal/contract requires completed OCR/pre-audit, Solar API verification or owner/manager override, installer-validated survey payload, CS/owner-validated File Vault requirements, generated compliance PDFs, net-metering `ready_for_lender`, frozen formal proposal estimate, pricing approval when required, and generated proposal/contract.
- CS review requires signed contract, invoice, mocked billing transaction, and payment-status record.
- Owner review requires CS readiness and required documents.
- Approval requires owner review stage.

## Documentation Expectations

Keep `README.md`, `AGENTS.md`, `MEMORY.md`, `init/README.md`, and `docs/` aligned with implementation changes.
