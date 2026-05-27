# Workflows

## Lead Lifecycle

1. A lead is captured through `/inquiry` or `/leads/new`.
2. Sales completes the qualification checklist: Inquiry, Business Fit, Bill / Energy, Site Control, Financing Fit, Decision / Timeline, Documents, and Notes. Lead detail includes editable qualification answers for business fit, site control, goal, daytime usage, bill estimate, and monthly kWh fallback so blockers can be cleared without recreating the lead.
3. Energy Profile owns the bill graph and OCR output used by readiness scoring, solar fit, recommended system range, estimated savings, payback estimate, risk, blocker, and next action. The visible Energy Profile and Solar Snapshot tabs both show the stored estimated savings range so sales can connect the energy graph, roof capacity, and customer value without switching back to the lead overview. Gemini extracts structured bill history first, Google Vision falls back when needed, and deterministic annualization fills a 12-month graph when only 3-6 observed months are available. If OCR is not ready, a captured monthly kWh fallback estimates the bill at PHP 11/kWh for the first readiness calculation.
4. A lead can be marked qualified when contact, location, bill or estimated bill, goal, and site-control answer are present. Override is allowed only with an audit-visible reason.
5. A qualified lead can create one or more deals.

## Local Demo Dataset

Dashboard, Leads, and Settings expose a local-only `Load demo data` action for recordings. It is explicit and repeatable, so runtime still starts empty by default. The seed creates:

- `Iloilo Mini Mart`: best-fit MSME/commercial lead in Santa Barbara with PHP 45,000 bill, MORE Power OCR result, 27 kWp Solar Snapshot roof cap, 86/100 readiness, and pending ID/site-proof documents.
- `Maria Santos`: residential homeowner in Pavia with PHP 4,800 bill, medium Solar Snapshot quality, 54/100 readiness, and authorization/payment blockers.
- `Jaro Print & Packaging`: high-value commercial lead in Jaro with PHP 95,000 bill, 55 kWp Solar Snapshot roof cap, 74/100 readiness, and landlord/site authorization blocker.
- `Atria Cold Storage`: large commercial continuity lead in Mandurriao with PHP 160,000 bill, 82 kWp roof cap, 91/100 readiness, and a pending valid ID before proposal.
- `Iloilo Montessori School`: school continuity lead in Molo with PHP 62,000 bill, 35 kWp roof cap, 78/100 readiness, and board/net-metering document blockers.
- `Oton Water Refilling Station`: medium-value MSME in Oton with PHP 28,000 bill, low-quality Solar Snapshot imagery, 66/100 readiness, and owner/manager manual review needed.

Lead list and lead detail show the stored readiness score. The detail page does not recalculate read-only demo or loaded records on render; readiness changes only through qualification edits, OCR/readiness functions, or other explicit mutation paths.

## Deal Lifecycle

1. Deal Created: commercial opportunity is created from a qualified lead snapshot.
2. Solar Snapshot Reviewed: Google/Solar or manual fallback creates shared site intelligence.
3. Survey Scheduled: sales selects installer, date/time, and location.
4. Survey Validated: installer completes evidence and validation.
5. Proposal Built: sales builds/freeze the formal proposal.
6. Client Portal Shared: customer gets a public value/proposal portal.
7. Contract Accepted: customer typed acceptance creates invoice, mocked payment ledger, and client record.
8. Won: commercial outcome is marked won and aftersales/net-metering work begins.

Deals can also become `lost`, `cancelled`, or `archived` without deleting audit history.

## Survey Workflow

1. Sales schedules a survey only after Solar Snapshot is ready or override-approved.
2. Installer sees assigned jobs, location, Solar Snapshot context, blockers, and required evidence.
3. Installer uploads Main Breaker Panel, Roof Surface, Inverter Location, and Wire Run Path evidence.
4. Installer answers roof structural soundness.
5. Validation is blocked if any required evidence is missing or the roof is not structurally sound.
6. Validated survey updates the linked deal to `survey_validated`.

## Document Workflow

Documents are polymorphic vault records linked to lead, deal, survey, proposal, or client. Lead-level uploads are allowed before a deal exists, and validated lead documents count for later deal proposal blockers. Uploads start as `needs_review`. CS/owner validation is required before documents clear blockers. Rejection keeps the file and reason for audit. `/documents/:id` is the file detail route for preview, download, replace, delete, validate, reject, and Customer Bill OCR actions. Local development previews data URLs; Supabase mode uses short-lived signed URLs from `document-signed-url`.

## Proposal Workflow

1. Proposal draft is created from a survey-validated deal with validated required documents: customer bill, valid ID, and site-control document. Validated documents linked to either the deal or its source lead count.
2. Net-metering readiness is shown as an ordered gate: Eligibility, Documents, Technical Review, Application, Metering, Active Credits. Eligibility requires utility provider and site-control answer; Documents require validated Customer Bill, Valid ID, and Site-Control Document; Technical Review requires validated installer survey.
3. Scope lines are editable and include source reason, cost, margin, and manual edit state.
4. Gross margin below the floor marks the proposal as pricing-review needed.
5. Approved proposals can be frozen.
6. Frozen active proposal can generate a public contract token.
7. `/contracts/:token` renders the printable customer proposal with system summary, assumptions, scope, warranty, timeline, net-metering progress, BOM/scope lines, and typed acceptance.
8. Typed acceptance creates invoice, mocked payment ledger event, and client.

## Client Portal Workflow

Client Portal links are public token pages scoped to a deal. The portal shows solar fit, proposal/payment status, requested uploads, survey schedule, net-metering progress, and support entry points. It does not expose internal notes or AI.

## Financing Readiness

Financing is embedded in lead/deal/proposal flows. A lender-ready packet should include bill summary, system size, savings/payback, affordability profile, site readiness score, installer quote/proposal state, net-metering status, and risk flags.

## Timeline

Timeline events are append-only across lead, deal, survey, document, and proposal flows. Every state-machine action should leave an audit trail. High-frequency Solar panel slider changes are collapsed to the latest panel-layout event so the timeline remains readable.
