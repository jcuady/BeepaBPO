import { z } from "zod";

export const leaveRequestSchema = z
  .object({
    leave_type_id: z.string().uuid("Select a leave type."),
    start_date: z.string().min(1, "Start date is required."),
    end_date: z.string().min(1, "End date is required."),
    reason: z.string().max(2000).optional(),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "End date must be on or after start date.",
    path: ["end_date"],
  });

export const attendanceCorrectionSchema = z.object({
  attendance_record_id: z.string().uuid("Select an attendance record."),
  reason: z.string().min(5, "Explain the correction needed.").max(2000),
  requested_clock_in_at: z.string().optional(),
  requested_clock_out_at: z.string().optional(),
});

export const ticketSchema = z.object({
  category: z.string().min(1, "Select a category."),
  subject: z.string().min(3, "Subject is required.").max(200),
  description: z.string().min(10, "Describe the issue.").max(5000),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
});

export const ticketMessageSchema = z.object({
  ticket_id: z.string().uuid(),
  body: z.string().min(1, "Message cannot be empty.").max(5000),
});

export const ticketStatusSchema = z.object({
  ticket_id: z.string().uuid(),
  status: z.enum([
    "new",
    "assigned",
    "in_progress",
    "waiting_for_client",
    "resolved",
    "closed",
  ]),
});

export const profileUpdateSchema = z.object({
  display_name: z.string().min(1, "Display name is required.").max(160),
  phone: z.string().max(40).optional(),
  timezone: z.string().min(1, "Timezone is required.").max(80),
});

export const cashAdvanceSchema = z.object({
  requested_amount: z.coerce
    .number()
    .positive("Amount must be greater than zero."),
  reason: z.string().min(5, "Reason is required.").max(2000),
  requested_repayment_periods: z.coerce.number().int().min(1).max(24).optional(),
});

export const crmLeadSchema = z.object({
  company_name: z.string().min(1, "Company name is required.").max(160),
  contact_name: z.string().max(120).optional(),
  contact_email: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  contact_phone: z.string().max(40).optional(),
  industry: z.string().max(80).optional(),
  notes: z.string().max(5000).optional(),
  source: z.string().max(80).optional(),
});

export const crmLeadStatusSchema = z.object({
  lead_id: z.string().uuid(),
  status: z.enum([
    "new",
    "contacted",
    "qualified",
    "unqualified",
    "converted",
    "lost",
  ]),
  notes: z.string().max(2000).optional(),
});

export const crmDealSchema = z.object({
  title: z.string().min(2, "Title is required.").max(200),
  lead_id: z.string().uuid().optional().or(z.literal("")),
  estimated_value: z.string().max(40).optional(),
  currency: z.string().min(3).max(3).optional(),
  expected_close_date: z.string().optional(),
});

export const crmDealStageSchema = z.object({
  deal_id: z.string().uuid(),
  stage: z.enum([
    "new_lead",
    "contacted",
    "qualified",
    "discovery",
    "proposal",
    "negotiation",
    "won",
    "lost",
    "on_hold",
    "follow_up_later",
  ]),
  lost_reason: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
});

export const convertDealToClientSchema = z.object({
  deal_id: z.string().uuid(),
  organization_name: z
    .string()
    .min(2, "Organization name is required.")
    .max(120)
    .optional(),
});

export const jobPostSchema = z.object({
  title: z.string().min(3, "Title is required.").max(200),
  slug: z
    .string()
    .min(3, "Slug is required.")
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  description: z.string().max(10000).optional(),
  requirements: z.string().max(10000).optional(),
  responsibilities: z.string().max(10000).optional(),
  location_text: z.string().max(120).optional(),
  location_type: z.enum(["remote", "onsite", "hybrid"]).optional(),
  employment_type: z
    .enum(["regular", "probationary", "contractual", "part_time", "intern"])
    .optional(),
  salary_display: z.string().max(80).optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
});

export const jobPostUpdateSchema = jobPostSchema.extend({
  id: z.string().uuid(),
});

export const jobPostIdSchema = z.object({
  id: z.string().uuid(),
});

export const jobApplicationSchema = z.object({
  job_post_id: z.string().uuid(),
  first_name: z.string().min(1, "First name is required.").max(80),
  last_name: z.string().min(1, "Last name is required.").max(80),
  email: z.string().email("Enter a valid email."),
  phone: z.string().max(40).optional(),
  linkedin_url: z.string().url("Enter a valid URL.").optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export const leaveApprovalSchema = z.object({
  leave_request_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

export const attendanceCorrectionReviewSchema = z.object({
  correction_request_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

export const clientTimesheetReviewSchema = z.object({
  attendance_record_id: z.string().uuid("Select a timesheet day."),
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

export const submitTimesheetForClientReviewSchema = z.object({
  attendance_record_id: z.string().uuid("Select a timesheet day."),
});

export const nteCaseSchema = z.object({
  employee_id: z.string().uuid("Select an employee."),
  incident_date: z.string().min(1, "Incident date is required."),
  incident_type: z.string().min(2, "Incident type is required.").max(120),
  subject: z.string().min(3, "Subject is required.").max(200),
  description: z.string().min(10, "Description is required.").max(5000),
  response_due_at: z.string().optional(),
});

export const nteResponseSchema = z.object({
  nte_case_id: z.string().uuid(),
  response_text: z.string().min(10, "Response is required.").max(5000),
});

export const nteResolveSchema = z.object({
  nte_case_id: z.string().uuid(),
  resolution_type: z.enum([
    "cleared",
    "verbal_warning",
    "written_warning",
    "suspension",
    "dismissal",
    "other",
  ]),
  resolution_notes: z.string().min(5, "Resolution notes are required.").max(5000),
  effective_date: z.string().optional(),
});

export const adminInviteSchema = z.object({
  email: z.string().email("Enter a valid work email."),
  first_name: z.string().min(1, "First name is required.").max(80),
  last_name: z.string().min(1, "Last name is required.").max(80),
  role_code: z.enum([
    "employee",
    "hr",
    "recruiter",
    "sales",
    "marketing",
    "operations",
    "account_manager",
    "team_lead",
    "finance",
  ]),
});

export const clientInviteSchema = z.object({
  organization_id: z.string().uuid("Select a client organization."),
  email: z.string().email("Enter a valid email."),
  first_name: z.string().min(1, "First name is required.").max(80),
  last_name: z.string().min(1, "Last name is required.").max(80),
  role_code: z.enum(["client_admin", "client_viewer"]),
});

export const applicationStageSchema = z.object({
  application_id: z.string().uuid(),
  stage: z.enum([
    "applied",
    "screening",
    "initial_interview",
    "assessment",
    "client_endorsement",
    "client_interview",
    "offer",
    "hired",
    "rejected",
    "withdrawn",
    "talent_pool",
    "on_hold",
  ]),
  notes: z.string().max(2000).optional(),
});

export const hireApplicantSchema = z.object({
  application_id: z.string().uuid(),
  hire_date: z.string().optional(),
  work_email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export const createPayrollPeriodSchema = z
  .object({
    name: z.string().min(2, "Period name is required.").max(120),
    start_date: z.string().min(1, "Start date is required."),
    end_date: z.string().min(1, "End date is required."),
    pay_date: z.string().min(1, "Pay date is required."),
    seed_records: z.coerce.boolean().optional().default(true),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "End date must be on or after start date.",
    path: ["end_date"],
  })
  .refine((data) => data.pay_date >= data.end_date, {
    message: "Pay date must be on or after period end.",
    path: ["pay_date"],
  });

export const documentMetaSchema = z.object({
  title: z.string().min(2, "Title is required.").max(200),
  category: z.string().min(2, "Category is required.").max(80),
  employee_id: z.string().uuid().optional(),
  client_organization_id: z.string().uuid().optional(),
});

export const invoicePaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  paid_at: z.string().optional(),
  reference: z.string().max(120).optional(),
  method: z.string().max(80).optional(),
});

export const issueInvoiceSchema = z
  .object({
    client_organization_id: z.string().uuid("Select a client."),
    period_start: z.string().min(1, "Period start is required."),
    period_end: z.string().min(1, "Period end is required."),
    issue_date: z.string().min(1, "Issue date is required."),
    due_date: z.string().min(1, "Due date is required."),
    currency: z.string().min(3).max(3).default("USD"),
    description: z.string().min(3, "Line description is required.").max(500),
    quantity: z.coerce.number().positive("Quantity must be greater than zero."),
    unit_rate: z.coerce.number().min(0, "Unit rate cannot be negative."),
  })
  .refine((data) => data.period_end >= data.period_start, {
    message: "Period end must be on or after start.",
    path: ["period_end"],
  })
  .refine((data) => data.due_date >= data.issue_date, {
    message: "Due date must be on or after issue date.",
    path: ["due_date"],
  });

const cmsSlug = z
  .string()
  .min(2, "Slug is required.")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");

export const cmsBlogPostSchema = z.object({
  title: z.string().min(3, "Title is required.").max(200),
  slug: cmsSlug,
  excerpt: z.string().max(500).optional(),
  body: z.string().min(10, "Body is required.").max(50000),
});

export const cmsServiceSchema = z.object({
  title: z.string().min(3, "Title is required.").max(200),
  slug: cmsSlug,
  summary: z.string().max(500).optional(),
  description: z.string().max(10000).optional(),
});

export const cmsContentStatusSchema = z.object({
  id: z.string().uuid(),
  entity: z.enum([
    "blog_post",
    "service",
    "faq",
    "industry",
    "testimonial",
    "case_study",
  ]),
  status: z.enum(["draft", "published", "archived"]),
});

export const cmsFaqSchema = z.object({
  question: z.string().min(5, "Question is required.").max(300),
  answer: z.string().min(5, "Answer is required.").max(5000),
  category: z.string().min(2).max(80).optional(),
});

export const cmsAboutSchema = z.object({
  headline: z.string().min(5, "Headline is required.").max(200),
  body: z.string().min(20, "Body is required.").max(20000),
});

export const cmsIndustrySchema = z.object({
  name: z.string().min(2, "Name is required.").max(120),
  slug: cmsSlug,
  description: z.string().max(5000).optional(),
});

export const cmsTestimonialSchema = z.object({
  client_name: z.string().min(2, "Client name is required.").max(120),
  quote: z.string().min(10, "Quote is required.").max(2000),
  client_title: z.string().max(120).optional(),
  company_name: z.string().max(160).optional(),
  rating: z.string().optional(),
});

export const cmsCaseStudySchema = z.object({
  title: z.string().min(3, "Title is required.").max(200),
  slug: cmsSlug,
  summary: z.string().max(500).optional(),
  body: z.string().min(10, "Body is required.").max(50000),
  client_name: z.string().max(160).optional(),
  industry: z.string().max(120).optional(),
});

const withCmsId = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({ id: z.string().uuid() });

export const cmsBlogPostUpdateSchema = withCmsId(cmsBlogPostSchema);
export const cmsServiceUpdateSchema = withCmsId(cmsServiceSchema);
export const cmsFaqUpdateSchema = withCmsId(cmsFaqSchema);
export const cmsIndustryUpdateSchema = withCmsId(cmsIndustrySchema);
export const cmsTestimonialUpdateSchema = withCmsId(cmsTestimonialSchema);
export const cmsCaseStudyUpdateSchema = withCmsId(cmsCaseStudySchema);
