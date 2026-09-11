# Permission matrix

Legend: **full** | **scoped** (team/client) | **own** | **read** | **approve** | **none**

| Module | Owner | Super Admin | HR | Recruiter | Sales | Marketing | Operations | Team Lead | Finance | Employee | Client Admin | Client Viewer | Applicant |
|--------|-------|-------------|----|-----------|-------|-----------|------------|-----------|---------|----------|--------------|---------------|-----------|
| System / users | full | full | none | none | none | none | none | none | none | none | none | none | none |
| Employees | full | none | full | none | none | none | read | scoped | none | own | scoped visible | scoped visible | none |
| Attendance | full | own | full | own | own | own | read | scoped+approve | own | own | read/approve | read | none |
| Leave | full | own | full | own | own | own | own | approve | own | own | none | none | none |
| NTE | full | own | full | own | own | own | own | own | own | own | none | none | none |
| Cash advance | full | own | manage | own | own | own | own | own | approve | own | none | none | none |
| Payroll | full | own | none* | own | own | own | own | own | full | own | none | none | none |
| CRM | full | none | none | none | full | full | none | none | none | none | none | none | none |
| Recruitment | full | none | none | full | none | none | none | none | none | none | none | none | own apps |
| Clients | full | none | none | none | read | none | full | none | billing | none | own tenant | own tenant | none |
| Tickets | full | own | own | own | full | full | full | own | own | own | tenant | read | none |
| Billing | full | none | none | none | none | none | none | none | full | none | read | none | none |
| Performance | full | own | full | own | own | own | read | scoped | own | own | client_visible | client_visible | none |
| CMS | full | none | none | none | none | full | none | none | none | none | none | none | none |
| Reports / export | full | read | full | read | read | read | full | scoped | full | none | scoped | read | none |
| Approvals | full | act | act | none | none | none | act | act | act | act | act | none | none |

\*HR does not receive payroll compensation access unless also granted `payroll.*`.
