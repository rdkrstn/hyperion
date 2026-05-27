# Verification

## Required Commands

```powershell
npx vitest run
npm run build
npx supabase db reset
```

For UI changes:

```powershell
npm run dev
```

## Automated Coverage

Expected checks:

- Domain services for leads, deals, qualification, surveys, documents, proposals, and shared store orchestration.
- Route config tests for clean routes and role-specific navigation.
- Legacy route tests for unavailable-page handling instead of dashboard redirects.
- Syncfusion removal tests for package and startup-helper absence.
- Lead-to-deal creation, many deals per lead, and lead snapshot integrity.
- Solar Snapshot dispatch gate before survey scheduling.
- Survey evidence and roof-soundness validation gates.
- Document upload/validation behavior where uploads start pending and validation clears blockers, with `/documents/:id` preview/download/replace/delete behavior and Supabase signed URL fallback.
- Energy Graph rendering with observed versus annualized bars and Customer Bill OCR action paths.
- Net-metering workflow status derivation across Deal, Documents, Proposal, Client Portal, and contract/proposal views.
- Proposal draft/freeze/contract gates, active proposal acceptance, invoice creation, mocked payment ledger, and client creation.
- Canonical Edge Function handler behavior for lead intake, OCR, Maps, Solar Snapshot, readiness, remote intake create/access/upload, document validation, survey dispatch/evidence, proposal generation, compliance docs, contract access, and Client Portal access.

## Manual Smoke

1. Start the app and open `/dashboard`.
2. Confirm the workspace starts empty.
3. Click `Load demo data` from Dashboard or Leads and confirm six local recording leads appear: Iloilo Mini Mart, Maria Santos, Jaro Print & Packaging, Atria Cold Storage, Iloilo Montessori School, and Oton Water Refilling Station. Reloading the seed should replace the demo records without duplicate rows.
4. Open each demo lead and confirm the detail readiness badge matches the Leads table value: 86, 54, 74, 91, 78, and 66 respectively.
5. Open `/leads/new` and create a lead.
6. Confirm `/leads/new` shows the manual Solar Snapshot pin map or coordinate fallback inside Location and utility, and that a selected pin is saved to the lead. The `Use device location` action must immediately show a locating state, then either apply lat/lng with a success notice or show a clear fallback error.
7. Confirm a lead can be created with contact fields plus confirmed lat/lng even when the typed address is blank; the lead location should become a `Pinned location (...)` fallback and local mode should create a Solar Snapshot from that pin.
8. Open `/leads/:id` and confirm tabs: Overview, Qualification, Energy Profile, Solar Snapshot, Documents, Notes, Timeline.
9. Open Qualification and confirm business fit, site control, goal, daytime usage, monthly bill, and monthly kWh fallback can be edited after capture; changing site control from `unknown` should clear the site-control blocker without recreating the lead.
10. Create a lead with monthly bill blank and monthly kWh filled; confirm the lead saves with a derived PHP bill estimate and no `bill or estimated bill` blocker.
11. Open the Lead Documents tab and confirm a customer bill, valid ID, or site-control document can be uploaded to the lead before any deal exists. Confirm the uploaded file can be viewed, downloaded, replaced, and deleted; replacement should reset validation to pending.
12. Open the Solar Snapshot tab and confirm the map can update the pin before running Solar Snapshot.
13. After Solar Snapshot is ready, confirm the roof review appears with satellite context or fallback background, metrics, selected panel controls, and no fake roof mask. If Google Building Insights returned panel center geometry, the overlay should be labeled `Google panel geometry`; otherwise the overlay should be labeled `Estimated panel layout`. It must increase/decrease selected panels, cap at the Solar Snapshot max panels, recalculate selected kWp, and show the selected layout in lead, deal, proposal, and survey Solar Snapshot views. Repeated panel slider changes should show only the latest panel-layout entry in Timeline.
14. Qualify the lead and create a deal.
15. Open `/deals` and confirm value, stage, status, owner, survey status, proposal status, portal status, and expected close are visible.
16. Open `/deals/:id` and confirm tabs: Overview, Commercial, Solar Snapshot, Surveys, Proposal, Client Portal, Documents, Timeline.
17. Run Solar Snapshot or confirm pending/blocked state.
18. Schedule a survey only after Solar Snapshot ready/override state.
19. Open `/surveys` and `/surveys/:id`.
20. Confirm installer evidence gates block validation until required evidence and roof soundness are present.
21. Upload and validate required documents through `/documents`; confirm the vault can target either a lead or a deal and supports view, download, replace, and delete actions for actual uploaded files.
22. Open `/documents/:id`; confirm image previews can zoom, PDFs render in the document viewer, unsupported files show metadata/download, and Customer Bill records expose Run Gemini OCR.
23. Open Lead Energy Profile; confirm the Energy Graph uses shadcn/Recharts bars, distinguishes observed versus annualized months, and shows the estimated savings range beside the monthly bill. If local mode uses a non-fixture file, confirm the OCR error states that production OCR requires Supabase Storage plus `GEMINI_API_KEY`.
24. Open Lead Solar Snapshot; confirm the Solar Snapshot output includes the same estimated savings range shown in Energy Profile.
25. Build/freeze a proposal through `/proposals/:dealId`; confirm the proposal captures the current Solar Snapshot panel count/selected kWp, shows a three-item document checklist, shows the net-metering workflow checklist, and does not stay blocked when linked lead-level or deal-level customer bill, valid ID, and site-control documents are validated.
26. Confirm the staff-side proposal preview renders the printable customer proposal.
27. Share a Client Portal and open `/portal/:token`; confirm net-metering progress is visible.
28. Generate a contract and open `/contracts/:token`; confirm the public proposal page includes prepared-for details, system summary, value/use-case section, scope, investment summary, warranty, timeline, terms, net-metering progress, and typed acceptance.
29. Accept the contract and confirm invoice, mocked payment ledger, and client record are created.
30. Confirm `/crm`, `/pipeline`, `/opportunities`, `/checkout`, `/billing`, `/reports`, `/ai-assist`, `/notifications`, and `/clients` render the unavailable route page with the correct replacement module.
31. Confirm the shadcn surfaces render correctly: sidebar/mobile sheet, lead intake form, lead/deal tabs, document validation dialogs, proposal readiness checklist, and calendar/list workflow.
32. Check desktop and mobile widths for `/leads/new`, `/leads/:id`, `/deals/:id`, `/surveys/:id`, `/documents`, `/documents/:id`, `/proposals/:dealId`, and `/contracts/:token`.

## Supabase Checks

1. Confirm `supabase/migrations/20260521183144_clean_domain_state_machine.sql` applies cleanly.
2. Confirm every public table has RLS enabled.
3. Confirm anon users cannot read operational tables.
4. Confirm staff users have matching `staff_profiles` rows.
5. Confirm public flows use Edge Functions, not broad anon policies.
6. Confirm private buckets exist: `readiness-uploads`, `survey-evidence`, `deal-files`, `compliance-doc-templates`, `compliance-documents`.
7. Confirm React business mutations use Edge Functions through `src/shared/api/businessMutations.ts`; direct table access from React should be read-oriented only.
8. Confirm Edge Functions return `{ ok: true, data }` or `{ ok: false, error }`.

## Environment Checks

- Without Supabase env vars, the app stays in empty local development mode.
- With Supabase env vars, staff sign-in resolves database-backed profiles.
- With `VITE_GOOGLE_MAPS_BROWSER_KEY` missing, map UI must show manual fallback.
- With Google server keys missing, Edge Functions must store/return explicit pending states instead of fake success.
