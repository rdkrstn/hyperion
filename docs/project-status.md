# Project Status

| Area | Status |
|---|---|
| Public UI shell | v1 demo-ready |
| Golden demo loop | v1 demo-ready |
| Domain-driven modules | Built |
| Local demo workflow | Built |
| Supabase schema/RLS/buckets | Scaffolded |
| Supabase Edge Functions | Scaffolded, with hardened remote-intake token signing |
| Production mutation wiring | Partial |
| n8n automation handoffs | Local simulation / webhook-ready |
| Vitest coverage | Broad |
| Legacy cleanup | Pending |

## Known Limitations

- The active UI still uses the local demo store for many core interactions.
- Production Supabase query hydration is not complete.
- Production Supabase hydration and deployment verification still need a dedicated integration pass.
- The bundle is currently large and should be code-split later.
