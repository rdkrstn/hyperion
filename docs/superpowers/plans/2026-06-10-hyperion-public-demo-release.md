# Hyperion Public Demo Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repackage the existing Solar Ops app as Hyperion v1 public demo without rewriting the backend or deleting domain logic.

**Architecture:** Keep the current domain modules, Supabase scaffolding, and local store. Add a thin golden-demo orchestration layer and a local automation recipe layer, then redesign the visible shell/routes around Overview, Pipeline, Workbench, Automations, Analytics, and Docs.

**Tech Stack:** Vite, React, TypeScript, React Router, Tailwind CSS, shadcn source components, Supabase Edge Function scaffolding, Vitest.

---

### Task 1: Release Behavior Tests

**Files:**
- Modify: `src/app/routes/routeConfig.test.ts`
- Create: `src/shared/demo/goldenDemo.test.ts`
- Create: `src/domains/automations/services/automationService.test.ts`

- [x] Write failing tests for simplified Hyperion visible navigation, golden-demo state modeling/step progression, automation recipe/event simulation, and remote-intake token signing.
- [x] Run the focused tests and confirm they fail because the new APIs and labels do not exist yet.

### Task 2: Golden Demo And Automation Models

**Files:**
- Create: `src/shared/demo/goldenDemo.ts`
- Create: `src/domains/automations/types.ts`
- Create: `src/domains/automations/services/automationService.ts`
- Modify: `src/shared/api/solarOpsStore.ts`
- Modify: `src/shared/api/SolarOpsProvider.tsx`

- [x] Add golden demo helpers for the Iloilo Mini Mart account and current/next workflow step.
- [x] Add local golden demo actions that load demo data, run the next safe local step, and reset local state.
- [x] Add local-only automation recipes and simulated event generation with no external calls by default.
- [x] Harden remote-intake token signing with HMAC/JWT-compatible verification.
- [x] Run focused tests until green.

### Task 3: Hyperion Shell And Routes

**Files:**
- Modify: `src/styles.css`
- Modify: `src/app/layout/AppLayout.tsx`
- Modify: `src/app/routes/routeConfig.ts`
- Modify: `src/App.tsx`
- Create: `src/app/routes/PipelinePage.tsx`
- Create: `src/app/routes/WorkbenchPage.tsx`
- Create: `src/domains/automations/pages/AutomationsPage.tsx`
- Create: `src/app/routes/DocsPage.tsx`

- [x] Rebrand visible shell to Hyperion.
- [x] Show primary navigation as Overview, Pipeline, Workbench, Automations, Analytics, Docs.
- [x] Preserve existing domain routes but hide them from primary navigation.
- [x] Add release/demo controls in the shell.

### Task 4: Page Redesign

**Files:**
- Modify: `src/app/routes/DashboardPage.tsx`
- Modify: `src/app/routes/PipelinePage.tsx`
- Modify: `src/app/routes/WorkbenchPage.tsx`
- Modify: `src/domains/automations/pages/AutomationsPage.tsx`
- Modify: `src/domains/analytics/pages/AnalyticsPage.tsx`
- Modify: `src/app/routes/DocsPage.tsx`
- Modify: existing visible labels in domain pages where low risk.

- [x] Build a polished Overview page with demo progress, KPIs, blockers, and timeline.
- [x] Build responsive Pipeline cards instead of relying on raw table overflow.
- [x] Build Workbench as the primary golden demo page with account, stepper, snapshot, docs, survey, net-metering, proposal, and contract readiness sections.
- [x] Build Automations page with n8n recipe cards and simulated event log.
- [x] Rework Analytics into clear demo-labeled operational metrics.
- [x] Add an in-app Docs/About page that states demo-vs-production status honestly.

### Task 5: Public Release Files

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `index.html`
- Modify: `.gitignore`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `ROADMAP.md`
- Create: `SECURITY.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `CHANGELOG.md`
- Create: `docs/local-demo-mode.md`
- Create: `docs/supabase.md`
- Create: `docs/automation-handoffs.md`
- Create: `docs/project-status.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`
- Create: `.github/pull_request_template.md`

- [x] Update package metadata to `hyperion-flow`, Apache-2.0, and v1.0.0 only if tests/build pass.
- [x] Track `.env.example` and keep `.env.local` ignored.
- [x] Add Apache-2.0 license and OSS governance docs.
- [x] Rewrite README and docs for public demo/reference status.

### Task 6: Verification

**Files:**
- No new source files.

- [x] Run `npx vitest run`.
- [x] Run `npm run build`.
- [x] Run `npm audit --omit=dev`.
- [x] Run public-surface scans for secrets, real data, stale Solar Ops labels, and generated artifacts.
- [x] Run `npx supabase db reset` and record Docker Desktop blocker.
- [x] Report exact results and remaining limitations.
