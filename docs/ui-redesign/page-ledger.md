# UI Page Ledger

One row represents one page or cohesive feature slice. Agents update evidence and status except `APPROVED`, which belongs to a human reviewer.

| Scope | Owner role | Design | Implementation | QA | Evidence |
| --- | --- | --- | --- | --- | --- |
| Foundation: Ant Design theme and responsive app shell | ui-design-system | APPROVED (DESIGN-001..006) | Local Inter font, light/dark Ant theme, role-aware staff header/Drawer, horizontal Ant `Menu` navigation with primary selected/hover state, and reusable admin Sider/Drawer frame complete; contextual section mapping deferred to owning page tasks | `cd frontend && npm run build` passed on 2026-10-20; `npm run lint` passed with 20 pre-existing warnings outside the shell; browser visual QA pending | Task: `.agents/tasks/global-app-shell-refactor.md`; `docker compose exec -T frontend npm run build` passed on 2026-10-19. |
| Navigation architecture: all registered routes | ui-architecture-audit | Existing design approvals apply; header-first shell needs explicit layout approval | Audit complete; no UI implementation changed | Route, role, shell and realtime-scope audit complete | Task: `.agents/tasks/navigation-architecture-audit.md`; recommends public, immersive and staff shell classes. |
| `/backoffice` + `/superadmin`: contextual administration navigation | ui-page-implementation | APPROVED (DESIGN-001..006) | Complete | Production build and UI-policy passed; manual visual/keyboard QA pending | Task: `.agents/tasks/admin-contextual-navigation.md`; scope is page frame/navigation only. |
| `/login` | ui-page-implementation | APPROVED (DESIGN-001..004) | Complete | Build, login-contract and UI-policy checks passed; browser visual QA pending | Task: `.agents/tasks/login-ant-design-refactor.md`; `npm run build` passed in isolated frontend Docker environment on 2026-10-01. |
| `/receiving-times` | ui-page-implementation | Not started | Not started | Not started | Candidate pilot page: lower operational risk. |
| `/register` | ui-page-implementation | Not started | Not started | Not started | Candidate mobile-form pilot. |

Add rows before starting further pages. A row may move to `Ready for human review` only after every required check is recorded.
