# UI page task: Global application shell

## Scope

- Route(s): shared shell coverage for all routes registered in `frontend/src/App.tsx`; page bodies are excluded.
- User roles: public drivers; `CHECKIN`; `RECEIVING`; `ADMIN_OPE`; `ADMIN_LOC`; `SUPERADMIN`.
- Domain documents read: `auth-role-scope.md`, `realtime-socket.md`, `operational-screens.md`, `track-pwa-push.md`, `backoffice-configuration.md`, plus UI-redesign governance.
- Components, modal/drawer states and data states: Ant `Layout`, `Header`, `Content`, `Menu`, `Dropdown`, `Drawer`, theme control and a public footer. Existing page modals, data states, loading states and query ownership remain unchanged.
- Explicitly excluded behaviour: page-body rebuilds; role/routing/API/query/socket/lifecycle changes; corporate assets; page-local Backoffice and Superadmin tab conversion.

## Design and implementation

- Approval IDs required: DESIGN-001, DESIGN-002, DESIGN-003, DESIGN-004, DESIGN-005, DESIGN-006.
- Responsive intent at 360 / 768 / 1024 / 1440 px: Drawer at 360; condensed header at 768–1024; grouped header navigation at 1440; no permanent global sidebar. The administration frame may use a desktop sider only in Backoffice/Superadmin after those page tasks adopt it.
- Long-text and image/fallback decisions: preserve branded assets and dynamic logo fallbacks; menu labels must remain readable or receive an accessible Ant tooltip.
- Existing logic and realtime contracts preserved: current paths, `ProtectedRoute`, route-role rules, SocketProvider route checks, Superadmin context gate, toast provider and all page-owned state remain unchanged.

## Verification evidence

- TypeScript/Vite build: `docker compose exec -T frontend npm run build` passed on 2026-10-19 after bundling the local Inter variable font. Vite reported the pre-existing large-chunk warning only.
- Relevant domain/logic checks: `App.tsx` preserves all route paths and `ProtectedRoute` role arrays; staff-shell classification now prevents public and immersive routes from inheriting authenticated staff navigation. The superseded custom global `Navbar` was removed; `AdminSectionFrame` is available for later Backoffice/Superadmin adoption.
- Keyboard and focus check: Ant Menu, Dropdown, Drawer, theme control and account menu use Ant Design primitives. Manual browser verification remains pending.
- Visual checks at required widths: pending browser review at 360 / 768 / 1024 / 1440 px.
- PWA/mobile or TV check, when relevant: Track and Waiting Screen remain outside StaffShell; TV body visual task remains separate.
- Known limitation or follow-up: Backoffice/Superadmin contextual sider requires each page to expose its page-owned active section in a subsequent page task. Existing public pages retain their route-owned headers until their individual Ant refactors.

## Review

- QA status: theme provider, global Inter font, staff shell and reusable admin section frame implemented; automated build and UI policy passed; browser visual QA pending.
- Human approval request: received through DESIGN-005 and DESIGN-006 on 2026-10-19.
