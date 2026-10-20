---
name: ui-design-system
description: Establish or evolve the approved Ant Design theme, shared responsive shell, and shared UI primitives for Delivery Queue Manager. Use only for design-system foundation work, not individual page redesigns.
---

Read `docs/ui-redesign/README.md`, `design-system.md`, `approval-ledger.md`, and the foundation row in `page-ledger.md`. Do not edit `frontend/src` while required design entries are not `APPROVED`.

After approval, configure Ant Design as the only UI library. Use its standard semantic state colours and the approved smoke-gray neutrals; preserve `UnitConfig.primaryColor` only when representing a configured unit. Build shared responsive layout and product primitives before applying them to pages.

Keep the work presentation-only. Verify at the responsive widths in the design system, run the frontend build, and record proof in the page ledger. If a shared change alters a visible route, list each route that received regression review.
