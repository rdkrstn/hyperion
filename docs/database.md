# Database

## Baseline Migration

This project uses a clean canonical baseline migration:

- `supabase/migrations/20260521183144_clean_domain_state_machine.sql`

Older preview migrations were removed because the app no longer keeps compatibility with the monolithic deal/checkout prototype.

## Canonical Tables

- `staff_profiles`: staff identity, database-controlled role, active state, contact fields, and preferences.
- `leads`: inquiry, qualification outcome, readiness output, source, assigned sales, blocker, next action, and archive state.
- `qualification_sections`: one row per lead qualification section: Inquiry, Business Fit, Bill / Energy, Site Control, Financing Fit, Decision / Timeline, Documents, Notes.
- `lead_energy_profiles`: monthly bill, monthly kWh fallback/OCR kWh, bill-history graph data, annualized averages, daytime usage, operating hours, brownout concern, and battery interest. If intake has kWh but no peso bill, the business layer derives the initial bill estimate at PHP 11/kWh.
- `lead_site_profiles`: location, standardized address, place ID, lat/lng, utility provider, property type, Maps status, and site-control answer.
- `bill_uploads`: bill OCR status, OCR provider, extracted kWh/bill/account/provider/confidence, observed/annualized monthly series, and raw text reference.
- `deals`: commercial project record linked to a lead, with lead snapshot/reference, stage/status, value, sales owner, survey/proposal/portal state, document state, contract state, blocker, and next action.
- `deal_commercial_packets`: proposed system size, estimated price, margin, payment option, and financing readiness payload.
- `solar_snapshots`: shared site intelligence linked to lead and optionally deal, including pin, imagery status/quality, roof capacity, max panels, selected panel count, panel wattage, selected system size, annual production, real panel geometry when Building Insights returns it, pitch/azimuth, risk flags, and raw Solar API payload.
- `surveys`: scheduled installer/auditor job linked to deal/lead, with installer, schedule, location, Solar Snapshot reference, findings, blockers, roof soundness, and validation outcome.
- `survey_evidence`: required survey evidence records for Main Breaker Panel, Roof Surface, Inverter Location, Wire Run Path, and other evidence categories.
- `documents`: polymorphic file vault records with optional `lead_id`, `deal_id`, `survey_id`, `proposal_id`, and `client_id`.
- `remote_intake_tokens`: 48-hour DB token plus signed JWT state for customer document uploads.
- `proposals`: formal proposal revisions, status, system size, totals, estimated cost, margin, payment option, contract token, and frozen snapshot.
- `quote_line_items`: editable scope builder lines with category, quantity, unit, unit price, cost, margin, source reason, notes, optional flag, and manual edit marker.
- `contract_acceptances`: typed acceptance audit rows.
- `billing_invoices`: invoice rows created from contract acceptance. Provider execution remains mocked.
- `client_portals`: public Client Portal token state.
- `clients`: post-acceptance/support client records.
- `financing_packets`: lender-readiness packet data embedded in lead/deal/proposal flows.
- `compliance_rules`, `compliance_holidays`, `net_metering_workflows`: versioned compliance rules, working-day exclusions, and net-metering state.
- `calendar_events`: survey, installation, follow-up, ticket, and owner-review calendar rows.
- `tickets`: internal operational tickets.
- `timeline_events`: append-only audit trail across lead, deal, survey, document, and proposal flows.
- `notifications`: profile/role-specific work alerts.

## Business Mutation Boundary

React reads and renders data, but production business mutations go through Edge Functions. `src/shared/api/businessMutations.ts` maps the UI/business actions to function names. The database remains the source of truth; React must not update multiple workflow tables directly.

## Storage

Private buckets:

- `readiness-uploads`: electric bills from intake and remote intake.
- `survey-evidence`: installer survey evidence.
- `deal-files`: deal-level files, generated artifacts, proposal snapshots, contracts, invoices, and references.
- `compliance-doc-templates`: official Annex PDF templates.
- `compliance-documents`: generated compliance PDFs.

Public users must not receive broad anon table or bucket access. Public inquiry, remote intake, Client Portal, and contract signing go through Edge Functions.

## Edge Functions

- `lead-intake`: public/staff intake record creation.
- `bill-ocr-preaudit`: Gemini structured bill OCR with Google Vision fallback plus deterministic annualization and readiness/pre-audit recalculation.
- `maps-enrichment`: Google Maps/Places address normalization only.
- `solar-snapshot`: Google Solar API roof-capacity snapshot and dispatch gate.
- `readiness-score`: deterministic readiness/blocker/next-action recalculation.
- `remote-intake-create`: staff-only 48-hour token and signed JWT generation.
- `remote-intake-access`: public GET payload after DB token and signed JWT validation.
- `remote-intake-upload`: public private-Storage upload plus `documents` row creation; uploads never clear blockers.
- `document-signed-url`: staff-only short-lived signed URL creation for private document preview/download.
- `document-validate`: CS/owner validation/rejection and readiness recalculation.
- `survey-dispatch`: Solar Snapshot-gated survey and calendar event creation.
- `survey-evidence-upload`: assigned-installer evidence upload and survey validation status updates.
- `generate-proposal`: proposal gate validation and frozen quote/scope creation.
- `installer-route-plan`: Google Routes planning for installer jobs.
- `generate-compliance-docs`: Annex PDF generation from private templates.
- `contract-access`: public contract review/typed acceptance.
- `report-rag`: owner/manager report summaries and vector chunks.

## RLS Intent

All public tables must have RLS enabled.

- Owner manages all operational records and final approvals.
- Manager reviews analytics and operations, and can approve pricing/dispatch overrides, but cannot owner-approve deals or refunds.
- Sales manages lead capture, qualification, deal creation, survey scheduling, proposal estimates, Client Portal links, and contracts.
- Installer reads assigned survey work and uploads/validates assigned survey evidence only.
- CS validates documents, compliance files, handoff readiness, and tickets. CS does not validate surveys.
- Public users access only token Edge Functions, never broad operational tables.

Roles come from `staff_profiles`, not user-editable auth metadata.
