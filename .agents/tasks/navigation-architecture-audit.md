# UI page task: Navigation architecture and route-shell audit

## Scope

- Route(s): all registered routes in `frontend/src/App.tsx`.
- User roles: public drivers; `CHECKIN`; `RECEIVING`; `ADMIN_OPE`; `ADMIN_LOC`; `SUPERADMIN`.
- Domain documents read: `driver-registration.md`, `check-in-flow.md`, `receiving-dashboard-lifecycle.md`, `operational-screens.md`, `backoffice-configuration.md`, `reports-analytics.md`, `track-pwa-push.md`, `auth-role-scope.md`, `realtime-socket.md`.
- Components, modal/drawer states and data states: global `Navbar`, `SuperadminOperationalContextGate`, `ToastContainer`, route-local tabs, modals and loading/error states remain route-owned. Socket room selection remains tied to `/dashboard`, `/docks`, `/waiting-screen`, and `/track/:code` behaviour.
- Explicitly excluded behaviour: no route, role, API, React Query, socket, PWA, branding, or page implementation changes are made by this audit.

## Current architecture

- `App.tsx` installs one global `Navbar` whenever a user is authenticated, except on `/waiting-screen`, `/track*`, and `/cancelled`. At `md` (768 px) it is a fixed 224 px left sidebar; below that it is a fixed top bar with a manually implemented slide-in drawer. Content is offset with `md:pl-56 pt-14 md:pt-0`.
- Global navigation uses route links, not in-memory tabs. Its four groups are operations, driver/display, analytics, and administration; each item is role-filtered. It currently includes public driver routes in the authenticated staff navigation.
- Public pages do not share one shell. `/` is the large online registration flow; `/register` is a four-step manual registration wizard; `/track` and `/track/:code` are lookup and live tracking; `/cancelled` is a public cancellation form; `/waiting-screen` is an installed/TV display; `/login` is an isolated auth page.
- Authenticated pages are page wrappers around feature modules. Several have their own stateful tab bar: Dashboard by unit, Backoffice (six tabs), Superadmin (ten tabs), Reports (four tabs), Histories (three tabs), and Waiting Screen by unit.
- `DriverView.tsx` is legacy and is not registered in `App.tsx`; `InstructionInstallPWA.tsx` is only a small helper. Neither belongs in the new navigation map until product ownership confirms a route.

## Audit findings

1. The existing desktop experience is explicitly sidebar-led, so it does not match a header-first information architecture. A header-only implementation is technically straightforward, but must replace the global shell rather than merely hide the sidebar.
2. A single ungrouped header cannot safely hold the maximum SUPERADMIN navigation set. Grouped menus and role filtering are required; global navigation must remain URL based.
3. The present authenticated condition also wraps public registration pages when a staff user opens them. Thus `/` and `/register` receive staff navigation and desktop offset for an authenticated session, while the other public/immersive routes do not. Shell selection should depend on route class first, then auth state.
4. Mobile navigation is available, but it is a custom overlay/drawer and every route body has its own responsive quality. Only the Login page currently uses Ant Design; the rest still use Tailwind controls, emoji icons, and locally built overlays/tabs.
5. Tables, dense filters, multi-tab admin screens and lifecycle actions are the greatest responsive risks. They need responsive toolbars, horizontal scrolling only inside table containers, and touch-sized controls; they cannot be made phone-ready merely by putting them under a responsive header.
6. `/waiting-screen` currently always renders `MobileLayout`; its desktop layout alternatives are commented out. This is an existing presentation issue for TV/desktop and should be a dedicated refactor slice, not a consequence of the global shell.

## Proposed information architecture (pending product approval)

### Shell classes

| Class | Routes | Navigation and layout |
| --- | --- | --- |
| Public driver shell | `/`, `/register`, `/track`, `/cancelled` | Compact branded header with Register and Track as direct public actions; Login as a discreet staff link. Public footer contains only support/legal links that already exist or are approved. No staff menu. |
| Immersive shell | `/track/:code`, `/waiting-screen`, `/login` | Route-owned full-screen layout. Tracking and TV need undistracted realtime presentation; Login remains focused. No global footer or staff navigation. |
| Staff operations shell | `/dashboard`, `/docks`, `/check-in`, `/receiving-times`, `/reports`, `/histories`, `/backoffice`, `/superadmin` | Persistent header, responsive menu drawer, a main content region and optional minimal footer. It retains protected routes, role guards and operational context. |

### Header-first staff navigation

- Header left: preserved corporate identity and current business/operational context.
- Header centre on wide screens: grouped Ant Design `Menu`/dropdowns: **Vận hành** (Điều phối, Dock, Check-in), **Phân tích** (Thời gian nhận hàng, Báo cáo, Lịch sử), **Quản trị** (Backoffice, Superadmin). Items are filtered by the existing role rules.
- Header right: realtime connection indicator when relevant, user identity, account menu and logout. The Superadmin operational-context control remains available to its role.
- At 768–1199 px, keep the identity and current primary route visible; move the groups into one “Menu” dropdown. Below 768 px, use an Ant Design `Drawer` opened from the header. This is a mobile overlay, not a persistent left sidebar; every permitted route remains reachable.
- Route-local tabs remain inside their page and become Ant `Tabs` or a segmented control as appropriate. They do not become global navigation items.

### Public discovery

- Drivers do not need the staff navigation. The public header should always expose two unambiguous actions: **Đăng ký giao hàng** and **Theo dõi chuyến**. On phone, show the current task plus a compact secondary link or menu; on desktop, show both.
- The existing `/` online-registration flow can remain the public entry point. It should receive the public driver shell rather than becoming a generic navigation dashboard. `/register` remains the manual-registration fallback specified by the domain document.
- Public cancellation is reachable from tracking as it is today; it should stay a secondary action so it cannot compete with the main driver tasks.

## Design and implementation

- Approval IDs required: DESIGN-001 through DESIGN-004 are approved. Replacing the approved design-system rule “desktop sider; mobile/tablet drawer and header” with a header-first staff shell requires a new explicit human layout approval before implementation.
- Responsive intent at 360 / 768 / 1024 / 1440 px: task-first driver flows at 360; compact staff menu at 360; one-menu header at 768–1024; grouped full header at 1200+; embedded table scroll only where necessary at every width; TV check at 1920.
- Long-text and image/fallback decisions: retain existing corporate assets unchanged; use constrained logo areas and dynamic-location fallback already provided by BrandingContext; show full ticket/registration/plate text through suitable wrapping, copy affordance or table detail rather than clipping it.
- Existing logic and realtime contracts preserved: `ProtectedRoute`, route paths, SocketProvider route checks, query keys, lifecycle action modals, public tracking, PWA and driver alerts remain unchanged.

## Verification evidence

- TypeScript/Vite build: not run; this audit contains documentation only.
- Relevant domain/logic checks: route map, role guards, navigation entries and SocketProvider route scope inspected.
- Keyboard and focus check: implementation deferred; Ant Menu/Dropdown/Drawer focus behaviour is required for the shell task.
- Visual checks at required widths: implementation deferred.
- PWA/mobile or TV check, when relevant: must include installed/mobile Track and 1920 px Waiting Screen when their pages migrate.
- Known limitation or follow-up: current Waiting Screen wrapper always selects its mobile layout; baseline browser screenshots remain pending in the approval ledger.

## Review

- QA status: architecture audit complete; no implementation changed.
- Human approval request: approve or amend the proposed three shell classes and header-first staff navigation before the shared shell is rebuilt.
