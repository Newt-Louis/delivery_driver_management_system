# UI Redesign Governance

This directory is the operating contract for the UI rebuild. It governs presentation changes in `frontend/src`; the delivery lifecycle, API contracts, routes, React Query keys, socket events, role checks, and backend behaviour remain unchanged unless a task explicitly expands scope.

## Working order

1. Create or update one page task from `.agents/templates/ui-page-task.md`.
2. Audit the page, its responsive states, and the relevant domain document in `docs/`.
3. Apply the approved design system through Ant Design and the shared application shell.
4. Implement one page or a cohesive feature slice only.
5. Run the page's logic checks, responsive checks, accessibility checks, and build. Record evidence in `page-ledger.md`.
6. Run `.codex/scripts/test-ui-policy.ps1` and `.codex/scripts/validate-ui-redesign.ps1` before requesting review.

An audit or visual-QA task does not make broad page edits. A page implementation task may only work on entries whose design-system approval is `APPROVED`.

## Roles and reusable workflows

- `.agents/skills/ui-architecture-audit`: scope, dependency and responsive audit.
- `.agents/skills/ui-design-system`: tokens, Ant Design theme and shared layout work.
- `.agents/skills/ui-page-implementation`: one approved page or feature slice.
- `.agents/skills/ui-visual-qa`: visual, UX, accessibility and regression review.
- `.agents/agents`: task-role prompts for parallel or handoff work; they are not automatic runtime agents.

`AGENTS.md` directs Codex to these workflows. The skills are intentionally focused so a small UI correction is not forced through the complete rebuild process.

## Approval and completion

Only a human reviewer changes a `PENDING` entry to `APPROVED` in `approval-ledger.md`. An agent may add evidence, identify risks, and request that approval.

`.codex/ui-redesign-mode.json` remains inactive until the design system is approved and the workspace hook is explicitly trusted through Codex `/hooks`. Once active, the hook is a completion gate for frontend changes: it checks the approval state and requires current page evidence before Codex stops.

## Design decisions awaiting ledger approval

The requested direction is recorded in `design-system.md`: Ant Design as the sole component library, its standard semantic behaviour colours, a smoke-gray neutral scale, responsive operation for every route, and `UnitConfig.primaryColor` as the only dynamic unit accent.

The executable and manual checks are defined in `qa-policy.md`.
