# Solar Ops

Single-company solar operations app built with Vite, React, TypeScript, React Router, Supabase, Tailwind CSS, DaisyUI, and source-owned shadcn/ui components.

The clean demo follows the real lifecycle: Leads qualify the buyer, Deals commercialize the project, Solar Snapshots validate the site before dispatch, Surveys prove technical feasibility, Documents clear blockers, Proposals convert, Client Portal links build trust, Tickets support aftersales, and Analytics supports owner/manager review.

Runtime business data starts empty. Test fixtures are separate from runtime state.

For recording or stakeholder walkthroughs, use the explicit **Load demo data** button on Dashboard, Leads, or Settings. It loads six fixed local scenarios without changing the default empty startup behavior: Iloilo Mini Mart as the best-fit MSME, Maria Santos as an interested residential blocker case, Jaro Print & Packaging as a high-value document-blocked commercial lead, Atria Cold Storage as a large commercial continuity project, Iloilo Montessori School as a board/net-metering approval case, and Oton Water Refilling Station as a Solar Snapshot manual-review case.

## Quickstart

```powershell
npm install
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173`.

## Environment

Create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_GOOGLE_MAPS_BROWSER_KEY=your-browser-restricted-google-maps-key
```

Set server-side Edge Function secrets only in Supabase:

```powershell
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set GEMINI_API_KEY=...
supabase secrets set GEMINI_OCR_MODEL=gemini-2.5-flash
supabase secrets set GOOGLE_VISION_API_KEY=...
supabase secrets set GOOGLE_MAPS_SERVER_KEY=...
supabase secrets set REMOTE_INTAKE_JWT_SECRET=...
supabase secrets set OPENAI_API_KEY=...
```

Never expose service-role, Gemini, Google Vision, Google Maps server, OpenAI, or payment-provider secrets in `VITE_` variables.

The browser Maps key powers the manual rooftop pin inside the `/leads/new` Location and utility section and the Lead Solar Snapshot tab. The pin writes latitude/longitude, place ID, and standardized address where available; a confirmed pin is accepted as the lead location even when the typed address is blank. In local development, creating a lead with a confirmed pin immediately creates the local Solar Snapshot. Server-side Solar API enrichment still runs through Edge Functions with `GOOGLE_MAPS_SERVER_KEY`.

Solar Snapshot also carries the pre-proposal panel allocation. Staff can add or remove panels in Lead, Deal, and Proposal views through an operator-facing roof review with satellite context, metrics, and panel controls. The UI renders Google panel overlays when Building Insights returns real `solarPanels` center geometry; otherwise it shows a clearly labeled estimated panel layout from the Solar Snapshot roof capacity, without pretending Data Layers roof masks are verified. The selected panel count is capped by the Solar API roof maximum before the layout can feed proposal scope. Creating a proposal draft captures the current Solar Snapshot panel layout into that proposal revision so later changes require a new proposal revision.

Lead detail is the recovery surface for incomplete capture. The Qualification tab lets staff update business fit, utility provider, site control, goal, daytime usage, and bill estimate after the first D2D pass. `/leads/new` also accepts a fallback monthly kWh value; when the peso bill is blank, the app estimates the bill at PHP 11/kWh so readiness, savings, and Energy Graph calculations can proceed before OCR. Energy Profile owns the Energy Graph; Supabase mode runs `bill-ocr-preaudit` with Gemini structured image extraction first and Google Vision fallback, while local mode can parse bundled Meralco fixture filenames or generate a clearly labeled local/manual graph. The Documents tab can upload actual customer bill, valid ID, site-control, or business files directly to the lead before a deal exists; those lead-level files still count for proposal document gates after CS/owner validation. Local development stores file payloads as data URLs so staff can view, download, replace, and delete files without a live Storage bucket. Supabase mode uses `/documents/:id` plus `document-signed-url` for short-lived private Storage access.

Lead list and lead detail use the same stored `readinessScore` value. Readiness only changes through lead qualification mutations or server/business recalculation paths, so curated demo scores stay consistent between the table and detail view.

## Frontend Architecture

`src/App.tsx` only composes routes and providers. Feature logic lives in domain folders:

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

Domain pages live in `domains/*/pages`, domain services in `domains/*/services` or `domains/*/rules`, and generic helpers in `shared/*`.

`src/app/routes/routeConfig.ts` is the single route metadata source used by layout, route helpers, and tests. Removed legacy paths render a designed unavailable page with a canonical replacement instead of silently redirecting.

shadcn/ui source components live in `src/components/ui`, with shared wrappers in `src/shared/ui`. DaisyUI remains available during the transition for broad utility styling, but refactored lifecycle surfaces use shadcn primitives for tabs, dialogs, buttons, cards, tables, forms, sheets, alerts, and calendar/list workflows.

## Supabase Setup

This is a clean reset. Data compatibility with older preview migrations is intentionally removed.

Run the canonical baseline migration:

```powershell
npx supabase db reset
```

Current baseline:

- `supabase/migrations/20260521183144_clean_domain_state_machine.sql`

The baseline creates canonical tables for `staff_profiles`, `leads`, `lead_energy_profiles`, `lead_site_profiles`, `qualification_sections`, `bill_uploads`, `solar_snapshots`, `deals`, `deal_commercial_packets`, `documents`, `remote_intake_tokens`, `surveys`, `survey_evidence`, `proposals`, `quote_line_items`, `billing_invoices`, `contract_acceptances`, `client_portals`, `clients`, `financing_packets`, `compliance_rules`, `compliance_holidays`, `net_metering_workflows`, `calendar_events`, `tickets`, `timeline_events`, and `notifications`. Bill OCR stores observed and annualized bill-history series for lead graphing. RLS is enabled on all public tables.

React owns UX state only. Production business mutations go through Supabase Edge Functions via `src/shared/api/businessMutations.ts`; local in-memory actions remain only as the development fallback when Supabase is not configured.

Deploy Edge Functions:

```powershell
supabase functions deploy contract-access
supabase functions deploy lead-intake
supabase functions deploy bill-ocr-preaudit
supabase functions deploy maps-enrichment
supabase functions deploy solar-snapshot
supabase functions deploy readiness-score
supabase functions deploy remote-intake-create
supabase functions deploy remote-intake-access
supabase functions deploy remote-intake-upload
supabase functions deploy document-signed-url
supabase functions deploy document-validate
supabase functions deploy survey-dispatch
supabase functions deploy survey-evidence-upload
supabase functions deploy generate-proposal
supabase functions deploy generate-compliance-docs
supabase functions deploy installer-route-plan
supabase functions deploy report-rag
```

Client Portal access is product-facing language. Public portal functions should target canonical `client_portals`, `deals`, `documents`, and `proposals` records.

Required private buckets:

- `readiness-uploads`
- `survey-evidence`
- `deal-files`
- `compliance-doc-templates`
- `compliance-documents`

## Routes

Protected staff routes:

- `/dashboard`
- `/leads`, `/leads/new`, `/leads/:id`
- `/deals`, `/deals/:id`
- `/surveys`, `/surveys/:id`
- `/documents`, `/documents/:id`
- `/proposals`, `/proposals/:dealId`
- `/calendar`, `/calendar/:id`
- `/portal-links`
- `/tickets`, `/tickets/:id`
- `/analytics`, `/analytics/:id`
- `/profile`, `/staff`, `/settings`

Public routes:

- `/signin`
- `/inquiry`
- `/remote-intake/:token`
- `/portal/:token`
- `/contracts/:token`

Legacy preview routes such as `/crm`, `/pipeline`, `/opportunities`, `/checkout`, `/billing`, `/reports`, `/ai-assist`, `/notifications`, and `/clients` are not active clean-demo routes. They render the unavailable route page with the replacement module instead of redirecting to the dashboard.

## Lifecycle

`Lead Captured -> Qualified -> Deal Created -> Solar Snapshot Reviewed -> Survey Scheduled -> Survey Validated -> Proposal Built -> Client Portal Shared -> Contract Accepted -> Won -> Installation / Net-Metering / Aftersales`

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

Proposal readiness derives required document validation from the linked document records (`customer_bill`, `valid_id`, and `site_control_document`) at proposal creation time. Validated documents linked to the deal or its source lead count. Cached deal status should never block a proposal when the actual linked documents are validated, and the UI shows each missing category instead of a generic blocker. Lead and deal timeline views collapse repeated Solar panel slider changes to the latest panel-layout event so the audit trail remains readable.

Net-metering readiness is visible in Deals, Documents, Proposals, and Client Portal. The workflow steps are Eligibility, Documents, Technical Review, Application, Metering, and Active Credits. The proposal gate shows net-metering as an ordered checklist item instead of hiding it in a long blocker string. Eligibility depends on utility provider and site-control answer; Documents depend on validated Customer Bill, Valid ID, and Site-Control Document; Technical Review depends on installer survey validation.

The public `/contracts/:token` page is now a printable web proposal and contract surface. It includes prepared-for details, system summary, annual/monthly output, savings/payback assumptions, residential or MSME value sections, scope inclusions/exclusions, investment summary, warranty, timeline, terms, net-metering progress, scope/BOM lines, and typed acceptance.

## Verification

Run before claiming completion:

```powershell
npx vitest run
npm run build
npx supabase db reset
```

For UI changes:

```powershell
npm run dev
```

Then smoke-test the staff lifecycle on desktop and mobile widths.

## Documentation

- `init/README.md`: bootstrap source of truth
- `AGENTS.md`: coding-agent instructions
- `MEMORY.md`: durable project decisions
- `docs/architecture.md`: module and data flow
- `docs/database.md`: canonical schema and RLS intent
- `docs/rbac.md`: permissions and blocked actions
- `docs/workflows.md`: lifecycle and state gates
- `docs/verification.md`: QA checklist
