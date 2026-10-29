# Global shell refactor plan

## Objective

Replace the current authenticated global sidebar and manual mobile drawer with approved Ant Design application shells. This scope changes shared presentation only: theme mode, headers, navigation frames, responsive drawers and public footer placement. It does not redesign a route's page body, form, table, modal, tab content, API, role rule, route, query, socket subscription or delivery lifecycle.

## Approved information architecture

| Shell | Routes | Desktop | Tablet and phone |
| --- | --- | --- | --- |
| Public driver | `/`, `/register`, `/track`, `/cancelled` | Compact brand header with Register and Track actions; modest public footer | Same actions in a compact header or approved short footer navigation |
| Immersive | `/login`, `/track/:code`, `/waiting-screen` | Route-owned full-screen presentation | Route-owned full-screen presentation |
| Staff operations | `/dashboard`, `/docks`, `/check-in`, `/receiving-times`, `/reports`, `/histories`, `/backoffice`, `/superadmin` | Header-first grouped navigation and a fluid content region | Header plus Ant Design Drawer; all permitted routes remain reachable |
| Contextual administration | Backoffice and Superadmin only | Secondary `Sider` for configuration sections, supplied by the owning page | Drawer or selector for the same sections |

## Theme contract

- Ant Design is the sole component and icon library for new shell UI.
- Light mode has white surfaces with silver/smoke-gray borders and text; navigation hover and selection inherit Ant Design defaults.
- Dark mode has dark-gray surfaces rather than `#000000`, white text, and default Ant Design navigation interaction states.
- The mode control uses Ant components in the staff header and persists a user preference locally. It defaults to the operating-system preference only when the user has not selected a mode.
- Ant Design algorithms own semantic state colours. THISO accents do not replace primary, success, error, warning, info, switch, progress, validation, focus or loading colours.
- Existing THISO/group logos, favicon, manifest icons and application title are preserved exactly.

## Execution sequence

### 1. Foundation and contracts

1. Add approved light/dark Ant Design token sets and a small shared mode provider.
2. Replace the current manual `Navbar` implementation with data-only role-aware navigation definitions and Ant Design shell primitives.
3. Establish route-shell classification in `App.tsx`, so public routes never inherit staff offsets merely because a user is logged in.
4. Keep `ProtectedRoute`, `SocketProvider`, `SuperadminOperationalContextGate` and `ToastContainer` mounted with their current semantics.

**Exit gate:** builds; no route, role or socket-scope change; theme switch works with keyboard and persists after reload.

### 2. Staff operations shell

1. Build `StaffShell` from Ant `Layout`, `Header`, `Content`, `Menu`, `Dropdown`, `Drawer`, `Avatar`, `Tooltip`, `Button` and Ant icons.
2. Preserve the current navigation groups and role filtering: Vận hành, Phân tích and Quản trị.
3. Present all groups at wide desktop width; compact them at tablet width; expose all allowed destinations through Drawer below 768 px.
4. Reserve a header region for current operational context, user account and light/dark mode.

**Exit gate:** each authenticated role can reach exactly its existing permitted routes at 360, 768, 1024 and 1440 px; no content is hidden behind the header.

### 3. Public and immersive boundaries

1. Add a shared public driver frame with only Register and Track navigation and a limited footer region.
2. Explicitly exempt Login, track detail and Waiting Screen from global shell chrome.
3. Do not change their page body or realtime/PWA code in this task.

**Exit gate:** public routes remain publicly accessible and staff opening them does not show the staff header or padding; tracking and TV retain their immersive screen area.

### 4. Contextual administration frame

1. Provide the reusable `AdminSectionFrame` that supports Ant `Sider` on desktop and `Drawer`/selector on smaller widths.
2. Do not move Backoffice or Superadmin tab content in this global-shell task. Each page receives the frame and section item mapping in its own approved page task because their active tab state is currently page-owned.

**Exit gate:** shared frame is available without duplicating a hand-built drawer or sidebar; Backoffice/Superadmin page tasks can adopt it without altering their business calls.

### 5. Verification and handoff

1. Run frontend build and UI-policy validation.
2. Check shell navigation at 360, 768, 1024 and 1440 px using representative permitted roles; check keyboard menu, dropdown, drawer, theme control and focus restoration.
3. Regression-check route access for `/register`, `/track/:code`, `/check-in`, `/waiting-screen`, `/dashboard` and `/docks`.
4. Record screenshots and limitations. Waiting Screen desktop/TV visual correction remains a dedicated page task with a 1920 px check.

## Deliberate exclusions

- No rewrite of Dashboard, Dock, Check-in, Register, Track, reporting, history, Backoffice or Superadmin content.
- No migration of page-local tabs into URL state in this task.
- No replacement of corporate identity assets.
- No backend, database, API, authorization, lifecycle, React Query or Socket.IO changes.

## Follow-on page order

After the shell is accepted: Dashboard and Dock Management; Check-in; public driver registration and tracking; reports/history/receiving-times; Backoffice; Superadmin; Waiting Screen. Every slice follows its own audit, implementation and visual-QA task.
