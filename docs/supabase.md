# Supabase Notes

Hyperion includes Supabase infrastructure as a scaffold for production integration.

## Included

- Canonical migration: `supabase/migrations/20260521183144_clean_domain_state_machine.sql`
- RLS policies for public tables
- Private Storage buckets
- Edge Functions for lead intake, OCR, maps/solar snapshot, remote intake, document validation, survey dispatch, proposals, contracts, compliance docs, and report RAG
- HMAC/JWT-compatible remote-intake token signing and verification in shared Edge Function auth helpers

## Current Status

The active public demo UI is local-store first. Production mutation boundaries exist in `src/shared/api/businessMutations.ts`, but the UI is not fully wired to Supabase query hydration and Edge Function mutation flows.

## Required Production Secrets

Set server-side secrets with Supabase:

```powershell
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set GEMINI_API_KEY=...
supabase secrets set GOOGLE_VISION_API_KEY=...
supabase secrets set GOOGLE_MAPS_SERVER_KEY=...
supabase secrets set REMOTE_INTAKE_JWT_SECRET=...
supabase secrets set OPENAI_API_KEY=...
```

Do not expose these as `VITE_` environment variables.
