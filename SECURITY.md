# Security Policy

Hyperion is currently a public demo/reference implementation. Treat it as a starting point, not a production security certification.

## Do Not Commit Secrets

Never commit:

- Supabase service role keys
- Supabase JWT secrets
- Google Maps server keys
- Google Vision keys
- Gemini keys
- OpenAI keys
- n8n webhook secrets
- Remote intake signing secrets
- OAuth secrets
- Real customer files, bills, IDs, addresses, phone numbers, or emails

Use `.env.local` for local development and Supabase project secrets for Edge Functions.

## Production Notes

- Browser code may only use publishable/browser-restricted keys.
- Supabase service-role access must stay server-side.
- Public inquiry, remote intake, client portal, and contract access should go through Edge Functions.
- Remote intake tokens are signed as HMAC/JWT-compatible Edge Function tokens and verified before public access or upload.
- n8n webhook dispatch should be opt-in and protected by secrets.

## Reporting

For public GitHub use, report security issues privately through the repository security advisory flow if enabled. If advisories are not enabled, contact the maintainer directly and do not open a public issue with exploit details.
