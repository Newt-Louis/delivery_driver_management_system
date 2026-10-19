# UI page task: Contextual administration navigation

## Scope

- Route(s): `/backoffice` and `/superadmin`.
- User roles: `ADMIN_LOC` and `SUPERADMIN` for Backoffice; `SUPERADMIN` only for Superadmin.
- Domain documents read: `backoffice-configuration.md`, `auth-role-scope.md`, `docs/ui-redesign/design-system.md` and approval ledger.
- Components, modal/drawer states and data states: replace each page's horizontal tab selector with `AdminSectionFrame`; desktop Ant `Sider`, mobile Ant `Drawer`, and page-owned selected-tab state. Preserve all tab-owned data queries, filters, forms, uploads, mutations and modal state.
- Explicitly excluded behaviour: no change to route paths, role checks, active-tab defaults, API calls, query keys, mutation/refresh behaviour, unit/location scope or tab contents.

## Design and implementation

- Approval IDs required: DESIGN-001 through DESIGN-006.
- Responsive intent at 360 / 768 / 1024 / 1440 px: context selector uses Drawer below 1024 px and Sider at 1024 px and above. Every allowed administration section remains reachable at every width.
- Long-text and image/fallback decisions: labels retain an accessible name and Ant menu overflow behaviour; existing dynamic image handling inside tabs is untouched.
- Existing logic and realtime contracts preserved: tabs retain page-local React state and their current lazy query conditions; neither page owns a socket room.

## Verification evidence

- TypeScript/Vite build: `docker compose exec -T frontend npm run build` passed on 2026-10-19.
- UI policy: `.codex/scripts/test-ui-policy.ps1` passed; the navigation frame adds no raw colour, semantic Tailwind colour or hand-built overlay.
- Relevant domain/logic checks: source review confirms `allowedBackofficeTabs`, the original Backoffice active-tab fallback, Superadmin query keys, lazy-query `enabled` conditions, location/unit filter reset and tab render mapping are unchanged.
- Route reachability: unauthenticated shell responses for `/backoffice`, `/superadmin`, `/login` and `/dashboard` returned HTTP 200; existing protected-route behaviour remains owned by `App.tsx`.
- Keyboard and focus check: Ant Menu supplies keyboard selection and Ant Drawer supplies modal focus handling. Manual browser verification remains pending.
- Visual checks at required widths: static responsive review covers Drawer below 1024 px and Sider from 1024 px; manual 360 / 768 / 1024 / 1440 px review remains pending because this environment has no browser screenshot runner.
- PWA/mobile or TV check, when relevant: authenticated phone/tablet administration navigation is in scope; no TV change.
- Known limitation or follow-up: tab content itself remains legacy presentation until its own page/feature task.

## Review

- QA status: implementation complete; automated checks passed; manual visual and keyboard review pending.
- Human approval request: covered by DESIGN-001 through DESIGN-006.
