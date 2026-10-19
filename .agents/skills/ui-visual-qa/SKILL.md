---
name: ui-visual-qa
description: Review one Delivery Queue Manager UI slice for visual consistency, responsive UX, accessibility, and behavioural regressions before human approval. Use after page implementation or when investigating a visual defect.
---

Read the page task, the approved design system, relevant domain documentation, and the implementation diff. Do not make broad page rewrites. Report findings with route, viewport, state, reproduction and severity; narrow fixes are allowed when explicitly included in the review task.

Check 360, 768, 1024 and 1440 px; check 1920 px for waiting screens. Validate keyboard access, visible focus, dialog focus handling, touch target size, text overflow/full-value access, loading/empty/error states, image fallback, colour meaning, zoom and horizontal overflow. Confirm visible actions remain available to the roles and device contexts that had them before.

Run the relevant automated checks and frontend build. On failure, return the slice to implementation with precise evidence. On success, add evidence to the page task and page ledger, then request human review; never change an approval ledger entry to `APPROVED`.
