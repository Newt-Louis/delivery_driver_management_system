# UI Redesign Governance

This directory governs the presentation-only frontend rebuild. The goal is a restrained, coherent product interface without changing delivery operations.

## Scope

- In scope: visual hierarchy, layout, responsive behavior, design tokens, base components, icon usage, typography, and presentation states.
- Out of scope unless explicitly approved: backend, Prisma, API contracts, routing, role rules, React Query keys, socket behavior, lifecycle logic, and delivery data.
- Preserve `UnitConfig.primaryColor` where a configured unit accent is shown. Brand accent is not a replacement for semantic success, warning, or danger states.

## Delivery flow

```text
UI architecture audit
  -> human approval of audit and direction
  -> design system and base components
  -> human approval of foundation
  -> one page group implementation
  -> independent visual QA
  -> human approval of the page group
```

Use the matching Codex skill for each step:

- `ui-architecture-audit`: inventory and migration proposal only.
- `ui-design-system`: approved tokens and reusable primitives only.
- `ui-page-implementation`: one approved page group, presentation only.
- `ui-visual-qa`: independent verification and defect report only.

The human approval ledger is intentionally separate from code review. A page group does not move forward merely because it builds.

## Hard rules during active rebuild

- Use approved design tokens and base primitives; do not hard-code color values or add gradients.
- Keep color purposeful: neutral surfaces dominate; brand accents are limited; semantic colors communicate state only.
- Use the approved typography and spacing scale. Do not create one-off visual constants inside page components.
- Keep interactive states complete: default, hover, focus-visible, disabled, pending/loading, error, empty, and success where relevant.
- Preserve existing responsive support and verify 1440px, 1024px, and 390px widths for every completed page group.
- Do not add a UI library or change package dependencies without human approval.

## Codex guardrail

`.codex/ui-redesign-mode.json` starts disabled so ordinary maintenance is unaffected. After the foundation is approved and before a UI rebuild task, a human may set `active` to `true` and trust the project hooks with `/hooks`. While active, the hook blocks patch edits to backend/operational files and makes `ui:check` a completion gate for changed frontend files.

## Required evidence

Each approved phase needs its entry in `approval-ledger.md`, the relevant build/lint/audit outcome, and a visual QA report. A screenshot baseline is an approval artifact, not a generated truth: update it only after human review.
