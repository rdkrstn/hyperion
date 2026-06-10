# Automation Handoffs

Hyperion does not require n8n. The public demo simulates automation handoffs locally.

## Recipes

- New lead captured -> create CRM task or Slack notification
- Documents missing -> send client reminder
- Proposal sent -> schedule 3-day follow-up
- Survey validated -> notify proposal owner
- Net-metering blocked -> create operations task
- Contract ready -> notify installer or project coordinator

## Local Default

```env
VITE_AUTOMATION_MODE=local
```

In local mode, Hyperion records simulated events only.

## Optional Webhook Variables

```env
VITE_N8N_WEBHOOK_LEAD_CAPTURED=
VITE_N8N_WEBHOOK_DOCUMENTS_MISSING=
VITE_N8N_WEBHOOK_PROPOSAL_SENT=
VITE_N8N_WEBHOOK_SURVEY_VALIDATED=
VITE_N8N_WEBHOOK_NET_METERING_BLOCKED=
VITE_N8N_WEBHOOK_CONTRACT_READY=
```

Webhook mode should be explicitly enabled and reviewed before production use.
