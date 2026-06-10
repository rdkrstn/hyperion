# Contributing to Hyperion

Hyperion is a public demo/reference implementation for solar PV installer operations. Contributions should keep the local demo runnable without paid services and avoid overstating production readiness.

## Setup

```powershell
npm install
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173`.

## Scripts

- `npm run dev`: start the local app.
- `npm run build`: typecheck and build the app.
- `npx vitest run`: run the test suite.
- `npm audit --omit=dev`: check runtime dependency risk.

## Code Style

- Use TypeScript and existing domain boundaries.
- Keep React pages focused on rendering and local UI state.
- Keep business rules in domain services or shared workflow helpers.
- Prefer shadcn source components and existing primitives.
- Do not introduce heavy dependencies without a clear release need.

## Branch Naming

Use short, descriptive branches:

- `feat/hyperion-workbench`
- `fix/document-gate`
- `docs/local-demo-mode`

Codex branches may use the `codex/` prefix.

## Commit Style

Use concise conventional-style commits:

- `feat: add golden demo loop`
- `fix: secure remote intake token signing`
- `docs: clarify Supabase production status`
- `test: cover automation recipes`

## Pull Request Checklist

- [ ] Local demo still starts empty.
- [ ] Golden demo can be loaded and advanced.
- [ ] No real credentials or customer data were added.
- [ ] `npx vitest run` passes.
- [ ] `npm run build` passes.
- [ ] Docs were updated for behavior, workflow, setup, or command changes.

## Good First Issues

- Improve responsive page polish.
- Add focused tests for Workbench render states.
- Expand local automation recipes without external calls.
- Improve docs for Supabase deployment.
- Reduce the production bundle with route-level code splitting.
