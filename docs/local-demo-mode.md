# Local Demo Mode

Hyperion starts without external services by default.

## What Local Mode Does

- Stores workflow state in browser local storage.
- Starts empty until `Load golden demo` or `Load demo data` is clicked.
- Simulates the Iloilo Mini Mart workflow without external API calls.
- Simulates automation events locally.
- Uses local Solar Snapshot estimates when Google Maps/Solar credentials are unavailable.

## What Local Mode Does Not Do

- It does not persist to Supabase.
- It does not call n8n webhooks by default.
- It does not send SMS, email, payment, or proposal messages.
- It does not prove production auth or RLS behavior.

## Resetting

Use the reset control in the app shell or clear browser local storage.
