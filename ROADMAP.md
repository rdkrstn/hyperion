# Hyperion Roadmap

## v1.0.0 Public Demo Release

- Rebrand public UI from Solar Ops to Hyperion.
- Stabilize the local golden demo loop.
- Present Overview, Pipeline, Workbench, Automations, Analytics, and Docs as the primary navigation.
- Add Apache-2.0 license and public contributor docs.
- Clarify local demo versus production backend status.

## Near-Term

- Add route-level code splitting to reduce bundle size.
- Add browser-level smoke tests for the golden demo.
- Continue UI polish on public token pages.
- Clean up old monolithic `src/lib` and `src/hooks/useSolarOpsData.ts` only after behavior is safely covered.

## Backend Integration

- Wire the active React UI to production Supabase query hydration.
- Route staff mutations through Edge Functions consistently.
- Add production-safe remote intake upload flows.
- Add deployment docs for Supabase secrets, buckets, and functions.

## Automation Handoffs

- Keep n8n optional.
- Keep local simulation as the default.
- Add opt-in webhook dispatch with explicit environment controls.
- Document recipe payloads.

## Future Exploration

- AI-assisted owner/manager summaries.
- More complete proposal document export.
- Installer mobile field experience.
- Real customer portal lifecycle events.
