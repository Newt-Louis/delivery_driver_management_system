---
name: ui-architecture-audit
description: Audit a Delivery Queue Manager route or feature before its UI rebuild, covering preserved behaviour, shared UI boundaries, and responsive risks. Use for UI inventory, migration scoping, or before changing an unrefactored page.
---

Read `docs/ui-redesign/README.md`, the relevant domain document under `docs/`, and the target route source. Do not edit page implementation files.

Map the route's roles, API/query dependencies, socket behaviour, form/overlay/data states, dynamic branding and required device contexts. Separate presentation work from any apparent product or backend defect. Record a concise task using `.agents/templates/ui-page-task.md` and add or update its row in `docs/ui-redesign/page-ledger.md`.

Identify reusable patterns only where at least two routes need the same product rule. State the smallest migration slice and the checks that prove behavioural parity. Do not select a component library, palette or baseline screenshot; defer to the approval ledger.
