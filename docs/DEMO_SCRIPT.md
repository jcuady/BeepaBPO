# Demo script (Option A — demo-harden)

Use after `pnpm seed:demo` with `DEMO_PASSWORD`.

**Fast path:** open `/employee/login` or `/login` → Demo users panel → click a role → Sign In / Access Portal.

**Best live order:** Owner → HR → Employee → Recruiter → Ops tickets → Finance → Client Admin → Team Lead leave → Marketing CMS publish. Superadmin = Admin lists only.

| Role | Safe paths | Avoid |
|------|------------|--------|
| Superadmin | Users **invite**, orgs, audit, reports, **Ops smoke** | Expecting Employees/Tickets Jump-in (hidden) |
| Owner | Dashboard Jump-in (perm-filtered), HR leave, tickets, CRM **deals**, **client invite**, recruitment, audit, **admin invite**, **Ops smoke** | Promising full CMS depth |
| HR | Employees search, leave approve, cash advances, **NTE create/resolve** | — |
| Recruiter | Jobs create/**edit/publish/close**, applicants/stage, **hire convert** (needs `employees.manage` too) | — |
| Sales | CRM leads **status update** + detail, **deals create/stage** | Approvals (hidden), Clients depth |
| Marketing | Workspace self-service, **full CMS** (About/industries/testimonials/FAQs/services/blog/case studies) + edit-in-place, reports snapshot | CSV needs `reports.export` |
| Operations | Tickets filters/status, **reports CSV**, **client invite** | Leave Review without perm |
| Team Lead | Leave approve, attendance | Cash/tickets Review |
| Finance | Payroll periods, cash-advance review, **billing + payments**, **reports CSV** | — |
| Employee | Clock, leave, cash advance, **payslip PDF**, documents, **NTE respond/outcome** | Approvals (hidden) |
| Client Admin | Team, attendance, tickets, **billing detail**, performance KPIs, documents | Approval actions |
| Client Viewer | Read team/attendance | Mutations |
| Applicant | Seeded application + profile | Empty careers-only story |

Backlog next: payroll workflow approval UI. Social OAuth deferred — email/password only. Ticket assign + SLA policy admin live. Client timesheet Approve/Send back is live when `allow_timesheet_approval` is on.
