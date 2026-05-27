# RBAC

## Roles

- `owner`: full visibility, final approvals, staff oversight.
- `manager`: operational and analytics review, pricing/dispatch review, no final owner approval.
- `sales`: lead capture, qualification, deal creation, survey scheduling, proposals, Client Portal links, contracts, and follow-up.
- `cs`: document vault, compliance/document readiness, tickets, and handoff review.
- `installer`: assigned survey work, evidence uploads, findings, and validation.

Roles are stored in `staff_profiles`, not user-editable auth metadata.

## Navigation

- Owner/Manager: Dashboard, Leads, Deals, Surveys, Documents, Proposals, Tickets, Analytics, Settings.
- Sales: Leads, Deals, Proposals, Calendar, Client Portal Links.
- Installer/Auditor: Assigned Surveys, Site Details, Evidence Upload, Blockers, Completed Surveys.
- CS/Documentation: Document Vault, Remote Intake Links, Compliance Docs, Net-Metering Tracker, Tickets.

Staff navigation is a UX layer. Supabase RLS is the security boundary.

## Blocked Actions

- Sales cannot bypass Solar Snapshot review to schedule a survey without owner/manager override.
- Sales cannot complete surveys.
- Installer cannot manage leads, deals, documents outside assigned survey evidence, proposals, contracts, analytics, or clients.
- CS cannot access survey validation work or generate contracts.
- Manager cannot owner-approve final deals or refunds.
- File uploads do not clear blockers until CS/owner validates them.
- Proposal/contract generation requires the full state-machine preflight to be green.
- Public inquiry, Remote Intake, Client Portal, and contracts cannot directly read operational tables.

## Implementation

Frontend route visibility lives in `src/app/routes/routeConfig.ts` and `src/app/layout/AppLayout.tsx`. Domain services enforce local state-machine gates for development mode. Supabase production enforcement lives in the baseline migration RLS policies and RPC functions.
