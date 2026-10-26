# Design System: THISO Operations UI

Status: `APPROVED` by the product owner. The foundation is permitted to evolve `frontend/src` without changing product behaviour.

## Foundation

- UI library: Ant Design. Do not introduce MUI, PrimeReact, shadcn/ui, a second icon library, or a parallel component system.
- Semantic behaviour: use Ant Design's default semantic tokens and component states; they encode domain meaning, not decoration. `primary` is for affirmative/create/start/enable actions. `danger` is for delete, cancel, reject and other negative or irreversible actions. `warning` (or Ant's gold/orange preset where a component has no `warning` option) is for edit/update, pending/waiting, reservation, maintenance and caution. `success` is for completed, available and positively resolved states. Use neutral/default (secondary) for inactive or historical states whose negative action has already passed, and `processing` for an item currently in progress. Preserve `info`, disabled, focus, loading and validation for their Ant Design meanings. Do not repaint these meanings with custom brand colours.
- Neutral application theme: smoke gray. The lightest surface is `#FFFFFF`; darker stops are neutral gray with the darkest application neutral remaining gray rather than pure black. Proposed scale: `#FFFFFF`, `#F7F7F8`, `#EDEEEF`, `#D8DADC`, `#B6B9BE`, `#8D9299`, `#626871`, `#434850`.
- THISO chrome uses white, silver/smoke gray and dark gray only. Pale-gold and bright-yellow navigation accents are not used. In dark mode, navigation selection, focus and neutral/outline interactions use the smoke-gray ramp to prevent saturated blue from clashing with charcoal surfaces. Ant `Button` primary actions and enabled `Switch` controls retain Ant's standard blue in both themes, making affirmative actions consistently recognizable.
- Use Ant Design `theme.defaultAlgorithm` and `theme.darkAlgorithm` for light and dark mode. Preserve their semantic warning, error, success, info, progress, switch, validation and loading colours; do not add page-local recolouring.
- Dynamic business branding: when a configured unit is represented, preserve `UnitConfig.primaryColor` only as the unit accent. It must not replace warning, error, success, focus or other semantic meanings.
- Corporate identity is preserved unless a human explicitly authorizes a change: do not replace, remove or restyle THISO/group logos, favicon, web manifest icons, application title, or other existing company brand assets. A product unit's dynamic branding does not authorize changes to these assets.

## Layout and typography

- Use three responsive shell classes. Public driver routes and `/waiting-screen` use the compact public header; immersive login and tracking-detail routes retain their route-owned full-screen shells; authenticated staff routes use a persistent header-first operations shell.
- The staff header is the primary application navigation. It groups routes as Vận hành, Phân tích and Quản trị, filters items by the existing role rules, and provides account and theme controls. At phone widths, it uses Ant Design `Drawer`; on tablet it condenses to a menu; on wide desktop it presents grouped header navigation.
- A desktop sider is not global navigation. It is a secondary, contextual navigator only within Backoffice and Superadmin. Its corresponding mobile form is a Drawer or an Ant Design selector. The owning page supplies its configuration sections; the shared shell supplies the responsive frame.
- A public driver header exposes Đăng ký giao hàng and Theo dõi chuyến. A small public footer may repeat these and approved support links. Staff and immersive shells do not receive a large global footer because it would consume operational working space.
- `GlobalHeader` is the shared header primitive for public-driver and authenticated-staff shells. Public links are centered; an anonymous account avatar leads to `/login`. Below 800px, public navigation preserves its compact menu button and right-side Ant Design `Drawer`. At 800px and wider, the public header measures the actual widths of its two end sections and the complete navigation with `ResizeObserver`: it presents all links only while their centered layout fits, otherwise it presents one Ant Design `Menu` dropdown. Desktop pointers may hover or click it; touch layouts use click only. For an authenticated user, the shared account dropdown retains theme/account/logout controls and provides one contextual link: `Khu vực nội bộ` from public routes goes to `/dashboard`; `Khu vực bên ngoài` from protected routes goes to `/`.
- Public routes expose an Ant `FloatButton` selector for the separate public `BusinessLocation` scope. The header renders the selected location's `logoUrl` and name; it never uses the truck placeholder. This public scope does not alter the authenticated operational scope, whose only switcher remains the Superadmin FloatButton.
- Make touch targets at least 44 by 44 CSS pixels for primary interactions on touch-capable layouts.
- Use the locally bundled Be Vietnam Pro font for all application typography, including code/ticket/table text, then the operating-system UI stack as fallback. It supports Vietnamese diacritics, dense operational tables and readable phone controls. Keep a concise type scale: page title, section title, body, metadata, and numeric/table text.
- Use a fluid content width, compact page gutters on phone, and denser table controls only when space permits. A table may scroll horizontally inside its own container; the page must not overflow horizontally.
- Repeated dynamic-card collections use the shared `AdaptiveGrid` primitive. It applies `repeat(auto-fit, minmax(min(100%, minColumnWidth), maxColumnWidth-or-1fr))`: each owner selects a safe minimum width for its content, and dense configuration cards may provide a readable maximum width so ultrawide screens gain columns rather than stretching cards indefinitely.
- Make all destructive and high-impact actions explicit with confirmation and a progress state. Preserve existing domain confirmations and permissions.

## Content resilience

- Every image has meaningful `alt` text when informative, an empty alt when decorative, fixed display bounds, `object-fit`, and a fallback for failed dynamic logos/uploads.
- Decide per field whether text wraps, truncates with access to the full value, or is monospace and unbroken. Ticket code, registration code, plate and timestamps may not be silently clipped.
- Every data view includes loading, empty, error, retry, disabled and submitting states where relevant.
- Dialogs and drawers must retain keyboard focus behaviour supplied by Ant Design; do not rebuild accessible overlays manually.

## Component rules

- Prefer Ant Design components and theme tokens. Shared wrappers exist only for established product rules such as a page header, brand logo, delivery-status tag or responsive data table.
- Use Ant Design `Layout`, `Header`, `Content`, `Sider`, `Menu`, `Dropdown`, `Drawer`, `Button`, `Avatar`, `Tooltip`, `ConfigProvider`, `theme` algorithms and icons before creating a custom equivalent. A custom component may only compose these primitives around an established product rule or a route/role boundary.
- Do not add new one-off Tailwind colour utilities, raw hexadecimal colours, hand-built modal overlays, form controls, buttons, or status badges in redesigned files.
- Keep Tailwind only for structural layout during migration; remove superseded local CSS when a page is converted.
- Forms keep their current validation and submission semantics. Choose one form owner per form; do not mix Ant Form state with React Hook Form state for the same field.

## Responsive support matrix

Each refactored page is checked at 360 px, 768 px, 1024 px and 1440 px widths. TV waiting screens also require a 1920 px check. Admin and operational pages are required at all four standard widths, including authenticated mobile/tablet use.

## Out of scope

This design system does not authorize a new API, route, role, query key, socket contract, lifecycle rule, backend change, or a replacement of the existing PWA strategy.
