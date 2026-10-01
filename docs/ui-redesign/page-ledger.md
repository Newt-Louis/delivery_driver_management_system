# UI Page Ledger

One row represents one page or cohesive feature slice. Agents update evidence and status except `APPROVED`, which belongs to a human reviewer.

| Scope | Owner role | Design | Implementation | QA | Evidence |
| --- | --- | --- | --- | --- | --- |
| Foundation: Ant Design theme and responsive app shell | ui-design-system | APPROVED (DESIGN-001..004) | Theme complete; app-shell migration deferred | Build passed | `ConfigProvider` installs the approved smoke-gray tokens without overriding Ant semantic colours. |
| `/login` | ui-page-implementation | APPROVED (DESIGN-001..004) | Complete | Build, login-contract and UI-policy checks passed; browser visual QA pending | Task: `.agents/tasks/login-ant-design-refactor.md`; `npm run build` passed in isolated frontend Docker environment on 2026-10-01. |
| `/receiving-times` | ui-page-implementation | Not started | Not started | Not started | Candidate pilot page: lower operational risk. |
| `/register` | ui-page-implementation | Not started | Not started | Not started | Candidate mobile-form pilot. |

Add rows before starting further pages. A row may move to `Ready for human review` only after every required check is recorded.
