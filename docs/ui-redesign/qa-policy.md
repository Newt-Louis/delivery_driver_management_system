# UI Rebuild QA Policy

Every page task passes four gates in this order. A failed gate returns the work to the same page task; it does not permit moving to another page.

## 1. Logic parity

Read the feature's domain document and preserve its route, role visibility, API contract, validation, React Query behaviour, realtime subscription, mutation progress and error handling. Run the relevant existing logic test or reproduce the critical flow with representative data. For operational flows, include the affected status transition without altering delivery lifecycle behaviour.

## 2. UI policy

Run `.codex/scripts/test-ui-policy.ps1`. It rejects newly introduced raw hexadecimal colours, Tailwind semantic colours, and hand-built overlays in UI-rebuild changes. Use Ant Design semantic components/states and approved design tokens instead.

The static rule is a guardrail, not proof of visual quality. A justified exception must be documented in the page task and reviewed by a human; do not weaken the script for a single page.

## 3. UX and accessibility

At 360, 768, 1024 and 1440 px, validate no page-level horizontal overflow; retained access to all permitted actions; 44 px touch targets; keyboard navigation; visible focus; dialog/drawer focus; loading, empty, error, retry and submitting states; full access to important long text; and safe dynamic-image fallback. Test waiting screens at 1920 px too.

## 4. Build and regression

Run `npm run build` from `frontend`. For a page that can affect realtime operational flows, regression-check `/register`, `/track/:code`, `/check-in`, `/waiting-screen`, `/dashboard` and `/docks` as applicable under the task scope. Record commands, result and visual evidence in the page task and page ledger.

## Automation baseline

After the design system is approved, establish Playwright visual and interaction coverage for the shared shell, login, a mobile form, a data table, a dialog/drawer and a loading/empty/error state. Baselines are not approved until `BASELINE-001` is approved in the ledger. Keep browser tests deterministic: stable fixtures, fixed viewport, fixed locale/timezone and disabled nonessential animation.
