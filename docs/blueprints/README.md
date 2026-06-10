# Hyperion Blueprint Assets

This directory contains Mermaid source and rendered image assets for the Hyperion public platform diagrams.

| Diagram | Mermaid Source | SVG | PNG |
|---|---|---|---|
| Platform Overview | `hyperion-platform-overview.mmd` | `hyperion-platform-overview.svg` | `hyperion-platform-overview.png` |
| Operating Lifecycle | `hyperion-operating-lifecycle.mmd` | `hyperion-operating-lifecycle.svg` | `hyperion-operating-lifecycle.png` |
| Supabase and Edge Boundary | `hyperion-supabase-edge-boundary.mmd` | `hyperion-supabase-edge-boundary.svg` | `hyperion-supabase-edge-boundary.png` |
| Automation Handoffs | `hyperion-automation-handoffs.mmd` | `hyperion-automation-handoffs.svg` | `hyperion-automation-handoffs.png` |

Regenerate images from the repo root with:

```powershell
npx -y @mermaid-js/mermaid-cli -i docs/blueprints/hyperion-platform-overview.mmd -o docs/blueprints/hyperion-platform-overview.svg
npx -y @mermaid-js/mermaid-cli -i docs/blueprints/hyperion-platform-overview.mmd -o docs/blueprints/hyperion-platform-overview.png
```

Repeat for the other `.mmd` files.
