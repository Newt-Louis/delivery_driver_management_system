# UI Redesign Approval Ledger

Only a human reviewer may change `PENDING` to `APPROVED`. Agents add evidence and request review; they never self-approve.

| ID | Decision | Status | Human reviewer | Evidence / decision record |
| --- | --- | --- | --- | --- |
| DESIGN-001 | Use Ant Design as the sole React component library for the rebuild. | APPROVED | Product owner | Requested by product owner on 2026-10-01; approved for implementation on 2026-10-01. |
| DESIGN-002 | Use Ant Design's default semantic behaviour colours. | APPROVED | Product owner | Requested by product owner on 2026-10-01; approved for implementation on 2026-10-01. |
| DESIGN-003 | Use the smoke-gray neutral theme and preserve `UnitConfig.primaryColor` as a unit accent only. | APPROVED | Product owner | Proposed neutral scale is in `design-system.md`; approved for implementation on 2026-10-01. |
| DESIGN-004 | Require global responsive support for public, admin and operational routes. | APPROVED | Product owner | 360/768/1024/1440 px matrix; approved for implementation on 2026-10-01. |
| DESIGN-005 | Use a header-first operations shell, with a contextual sider only inside Backoffice and Superadmin. | APPROVED | Product owner | Product owner approved the hybrid navigation model on 2026-10-19. Global header is primary navigation; the contextual sider is not shown for driver, check-in, receiving or general operational routes. |
| DESIGN-006 | Provide light and dark THISO themes while retaining Ant Design's default semantic behaviour colours. | APPROVED | Product owner | Product owner approved on 2026-10-19: white/silver/dark-gray neutral range plus bright-yellow and pale-gold navigation accents; Ant semantic status/control colours remain algorithm defaults. |
| BASELINE-001 | Approve baseline screenshots and supported browser/device matrix. | PENDING |  | Captured after the approved foundation runs locally, then submitted for review. |
