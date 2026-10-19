# UI page task: `/login`

## Scope

- Route(s): `/login`.
- User roles: every unauthenticated internal user; successful login continues to `/check-in` for `CHECKIN`, otherwise `/dashboard`.
- Domain documents read: `docs/auth-role-scope.md`, `docs/ui-redesign/design-system.md`, `docs/ui-redesign/qa-policy.md`.
- Components, modal/drawer states and data states: credential form; submitting state; invalid-credential error; existing-active-session alert with retain-session or force-login actions; static THISO logo with fixed display bounds.
- Explicitly excluded behaviour: API payload, cookie/session lifetime, role routing, authentication state, and all backend logic.

## Design and implementation

- Approval IDs required: DESIGN-001, DESIGN-002, DESIGN-003, DESIGN-004 — APPROVED.
- Responsive intent at 360 / 768 / 1024 / 1440 px: centered touch-friendly form with a constrained reading width; desktop uses a split layout; all form actions remain visible without horizontal page overflow.
- Long-text and image/fallback decisions: service and location text wraps; email error messages wrap; the existing THISO logo is rendered at fixed bounds on desktop and full card width on mobile from `public/thiso_logo-full-color.jpg`.
- Existing logic and realtime contracts preserved: `POST /api/auth/login`, `getOrCreateDeviceId`, force-login response handling, `AuthContext.login`, and role redirect remain unchanged. No socket contract exists on this route.

## Verification evidence

- TypeScript/Vite build: passed with `npm run build` in the isolated frontend Docker build directory on 2026-10-01.
- Relevant domain/logic checks: passed static contract assertions for `POST /api/auth/login`, device ID, `ActiveSessionExists`, `force`, and role redirect. The Vite dev server also returns `/login` successfully.
- Keyboard and focus check: Ant Design Form, Input.Password, Button and Alert provide their standard keyboard/focus behaviour; browser interaction review remains pending.
- Visual checks at required widths: pending local human review at 360 / 768 / 1024 / 1440 px. Chrome headless screenshot capture is blocked by the execution environment.
- PWA/mobile or TV check, when relevant: responsive login uses a single-column card below the `lg` breakpoint; browser review remains pending.
- Known limitation or follow-up: local host has no Node/npm; validation ran in the frontend Docker environment. Windows bind-mount installation required the frontend dev container to run as root for this session.

## Review

- QA status: implementation complete; build, login-contract checks and UI-policy checks passed. Browser visual QA is pending.
- Human approval request: review `/login` at the required widths, then record visual QA evidence before approval.
