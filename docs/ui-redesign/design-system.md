# Design System Proposal: Smoke Gray Operations UI

Status: `PENDING` human approval. This proposal records the requested direction; it is not permission to change `frontend/src` yet.

## Foundation

- UI library: Ant Design. Do not introduce MUI, PrimeReact, shadcn/ui, a second icon library, or a parallel component system.
- Semantic behaviour: use Ant Design's default semantic tokens and component states for primary action, neutral/secondary action, success, warning, error, info, disabled, focus, loading and validation. Do not repaint these meanings with custom brand colours.
- Neutral application theme: smoke gray. The lightest surface is `#FFFFFF`; darker stops are neutral gray with the darkest application neutral remaining gray rather than pure black. Proposed scale: `#FFFFFF`, `#F7F7F8`, `#EDEEEF`, `#D8DADC`, `#B6B9BE`, `#8D9299`, `#626871`, `#434850`.
- Dynamic business branding: when a configured unit is represented, preserve `UnitConfig.primaryColor` only as the unit accent. It must not replace warning, error, success, focus or other semantic meanings.
- Corporate identity is preserved unless a human explicitly authorizes a change: do not replace, remove or restyle THISO/group logos, favicon, web manifest icons, application title, or other existing company brand assets. A product unit's dynamic branding does not authorize changes to these assets.

## Layout and typography

- Use a responsive application shell: desktop sider; mobile/tablet drawer and header. The same routes and permitted actions must work at every viewport.
- Make touch targets at least 44 by 44 CSS pixels for primary interactions on touch-capable layouts.
- Use Inter when available, then the operating system UI stack. Keep a concise type scale: page title, section title, body, metadata, and numeric/table text.
- Use a fluid content width, compact page gutters on phone, and denser table controls only when space permits. A table may scroll horizontally inside its own container; the page must not overflow horizontally.
- Make all destructive and high-impact actions explicit with confirmation and a progress state. Preserve existing domain confirmations and permissions.

## Content resilience

- Every image has meaningful `alt` text when informative, an empty alt when decorative, fixed display bounds, `object-fit`, and a fallback for failed dynamic logos/uploads.
- Decide per field whether text wraps, truncates with access to the full value, or is monospace and unbroken. Ticket code, registration code, plate and timestamps may not be silently clipped.
- Every data view includes loading, empty, error, retry, disabled and submitting states where relevant.
- Dialogs and drawers must retain keyboard focus behaviour supplied by Ant Design; do not rebuild accessible overlays manually.

## Component rules

- Prefer Ant Design components and theme tokens. Shared wrappers exist only for established product rules such as a page header, brand logo, delivery-status tag or responsive data table.
- Do not add new one-off Tailwind colour utilities, raw hexadecimal colours, hand-built modal overlays, form controls, buttons, or status badges in redesigned files.
- Keep Tailwind only for structural layout during migration; remove superseded local CSS when a page is converted.
- Forms keep their current validation and submission semantics. Choose one form owner per form; do not mix Ant Form state with React Hook Form state for the same field.

## Responsive support matrix

Each refactored page is checked at 360 px, 768 px, 1024 px and 1440 px widths. TV waiting screens also require a 1920 px check. Admin and operational pages are required at all four standard widths, including authenticated mobile/tablet use.

## Out of scope

This design system does not authorize a new API, route, role, query key, socket contract, lifecycle rule, backend change, or a replacement of the existing PWA strategy.
