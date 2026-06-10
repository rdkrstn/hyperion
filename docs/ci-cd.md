# CI/CD

Hyperion uses GitHub Actions for repository verification and optional GitHub Pages deployment.

## Workflow

Workflow file:

```txt
.github/workflows/ci-cd.yml
```

## Verification Job

Runs on pull requests and pushes to `Main` or `main`:

```powershell
npm ci
npx vitest run
npm run build
npm audit --omit=dev
```

## Pages Deployment

On pushes to `Main` or `main`, the workflow builds the Vite app and deploys `dist/` with GitHub Pages Actions.

Repository Pages settings must use GitHub Actions as the deployment source. The workflow does not require app secrets.

## Notes

- Supabase reset is not part of CI because it requires a local Docker-backed Supabase stack.
- Deployment publishes the static demo shell only. Production Supabase project deployment remains a separate backend release task.
