# /init Bootstrap

This folder is the setup source of truth for the clean Solar Ops workspace.

## 1. Install

```powershell
npm install
```

## 2. Configure Browser Env

Create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_GOOGLE_MAPS_BROWSER_KEY=
```

Only browser-safe keys belong in `VITE_` variables.

## 3. Configure Supabase

Apply the clean baseline migration:

```powershell
npx supabase db reset
```

Baseline file:

- `supabase/migrations/20260521183144_clean_domain_state_machine.sql`

Deploy Edge Functions:

```powershell
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
supabase functions deploy contract-access
supabase functions deploy report-rag
```

Set server-side secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_OCR_MODEL` (optional, defaults to `gemini-2.5-flash`)
- `GOOGLE_VISION_API_KEY`
- `GOOGLE_MAPS_SERVER_KEY`
- `REMOTE_INTAKE_JWT_SECRET`
- `OPENAI_API_KEY`

Confirm private buckets:

- `readiness-uploads`
- `survey-evidence`
- `deal-files`
- `compliance-doc-templates`
- `compliance-documents`

Create staff Auth users and matching `staff_profiles` rows for `owner`, `manager`, `sales`, `cs`, and `installer`.

## 4. Verify

```powershell
npx vitest run
npm run build
npm run dev
```

## 5. Smoke Path

1. Open `/dashboard`.
2. For a recording walkthrough, click `Load demo data` from Dashboard, Leads, or Settings. The local seed loads six curated leads without changing the default empty startup behavior: Iloilo Mini Mart, Maria Santos, Jaro Print & Packaging, Atria Cold Storage, Iloilo Montessori School, and Oton Water Refilling Station.
3. Create a lead through `/leads/new`; a confirmed map/device/manual pin is enough even without typed address text. If OCR is not ready, enter either fallback electric bill or monthly kWh. A kWh-only capture derives the first bill estimate at PHP 11/kWh for readiness.
4. Qualify the lead and create a deal.
5. Run Solar Snapshot or confirm a pending/blocked state.
6. Review the Solar Snapshot roof review and adjust selected panels only within the roof maximum before building a formal proposal. The map must not show fake roof masks or arrays; panel overlays appear only when Building Insights returns real panel geometry.
7. Schedule a survey.
8. Upload survey evidence and validate the survey.
9. Upload/validate required documents from either the lead Documents tab or `/documents`; open `/documents/:id` and confirm preview/download/replace/delete/validate/reject work. In Supabase mode, preview/download must use a signed private Storage URL.
10. Run Gemini OCR from Energy Profile or `/documents/:id` for a Customer Bill. Local mode should either parse a bundled Meralco fixture filename or show the exact local/production OCR requirement.
11. Confirm the Energy Graph renders observed versus annualized bars under Lead Energy Profile.
12. Confirm the net-metering workflow appears in Deal, Documents, Proposal, and Client Portal views with exact blockers.
13. Build and freeze a proposal; confirm the proposal revision captures the current Solar Snapshot panel allocation and the customer-facing proposal preview is printable.
14. Share Client Portal.
15. Accept contract and confirm invoice, mocked payment ledger, and client creation.
