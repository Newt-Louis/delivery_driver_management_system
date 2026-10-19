---
name: ui-page-implementation
description: Refactor one approved Delivery Queue Manager page or cohesive feature slice to the shared Ant Design UI while preserving product behaviour. Use after audit and design approval for page-level UI implementation.
---

Read the relevant page task, the applicable domain document under `docs/`, `docs/ui-redesign/design-system.md`, `approval-ledger.md`, and the target feature source. Proceed only when required design entries are `APPROVED` and the page ledger contains the target row.

Use Ant Design components and approved shared primitives. Preserve API contracts, routing, role guards, React Query, socket subscriptions, lifecycle, validation and PWA behaviour. Implement responsive behaviour for the same route at every required viewport; authenticated admin and operational flows must work on phone and tablet.

For each changed state, cover loading, empty, error, disabled, submitting and long text or dynamic image fallback as applicable. Do not hand-build modals, buttons, inputs or semantic status styling in a redesigned file. Keep unrelated cleanup out of the change.

Run the frontend build and the route's relevant logic checks. Use `ui-visual-qa` before declaring the slice ready. Update task evidence and `page-ledger.md`; run `.codex/scripts/validate-ui-redesign.ps1` when redesign mode is active.
