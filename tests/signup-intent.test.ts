import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { signupSchema } from "@/lib/validation/auth";

/**
 * Sign-up serves two different people, and used to serve neither correctly.
 *
 * The form was client-shaped — "Work email", a `you@company.com` placeholder,
 * a Company name field — while `signupAction` unconditionally called
 * `assignApplicantMembership`. So a client registering their company got an
 * applicant account and the applicant portal, with no route to the client
 * portal they had just signed up for, and an applicant was asked for a company
 * they do not have.
 *
 * The company registration now records a CRM lead instead of granting a role.
 * That distinction is the security-relevant one and is asserted here directly:
 * `client_admin` carries org-scoped permissions (`clients.employee_visibility`,
 * `attendance.read`, `billing.read`), so a signup that minted one would let an
 * anonymous visitor create their own client tenant and read its people and
 * invoices. Nothing on this page may ever grant a portal role by itself.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** JSX text is rendered with collapsed whitespace; assert on what is read. */
const flatten = (s: string) => s.replace(/\s+/g, " ");
const actions = read("lib/auth/actions.ts");
const form = read("components/auth/signup-form.tsx");
const employeeForm = read("components/auth/employee-login-form.tsx");

const signupActionBody = actions.slice(
  actions.indexOf("export async function signupAction"),
);

const base = {
  fullName: "Juan Dela Cruz",
  email: "juan@example.com",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
  acceptTerms: true,
};

describe("signup schema: two audiences, two field sets", () => {
  it("lets an applicant register without a company", () => {
    const parsed = signupSchema.safeParse({ ...base, intent: "applicant" });
    expect(parsed.success, JSON.stringify(parsed)).toBe(true);
  });

  it("refuses a company registration with no company name", () => {
    const parsed = signupSchema.safeParse({ ...base, intent: "client" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.company).toBeDefined();
    }
  });

  it("rejects a whitespace-only company rather than storing it", () => {
    const parsed = signupSchema.safeParse({
      ...base,
      intent: "client",
      company: "   ",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a company registration with a company name", () => {
    const parsed = signupSchema.safeParse({
      ...base,
      intent: "client",
      company: "Northwind Logistics",
    });
    expect(parsed.success, JSON.stringify(parsed)).toBe(true);
  });

  it("defaults to applicant when intent is absent, not to client", () => {
    // The safe default is the one that grants no more than an applicant
    // membership. Defaulting to `client` would route a caller that never sent
    // the field into the branch that writes a lead.
    const parsed = signupSchema.parse({ ...base });
    expect(parsed.intent).toBe("applicant");
  });
});

describe("a client registration never grants portal access", () => {
  it("routes the client intent to a CRM lead, not a membership", () => {
    expect(signupActionBody).toContain("recordClientRegistration");
    expect(actions).toContain('from("crm_leads")');
    expect(actions).toContain('source: "website_signup"');
  });

  it("assigns the applicant role only in the non-client branch", () => {
    // Search for the *call*, not the bare name: the explanatory comment above
    // the branch mentions `assignApplicantMembership`, so a naive first-index
    // lookup finds the comment and reports the guard as misplaced.
    const call = signupActionBody.indexOf("await assignApplicantMembership(");
    const guard = signupActionBody.indexOf("if (isClient)");
    expect(guard, "the client branch guard is missing").toBeGreaterThan(-1);
    expect(call, "the applicant assignment call is missing").toBeGreaterThan(guard);
    expect(signupActionBody).toMatch(
      /if \(isClient\) \{[\s\S]*?\} else \{[\s\S]*?await assignApplicantMembership\(/,
    );
  });

  it("never names a client portal role anywhere in the signup path", () => {
    // The blunt invariant: signup must not be able to mint a tenant role.
    expect(signupActionBody).not.toContain("client_admin");
    expect(signupActionBody).not.toContain("client_viewer");
    expect(signupActionBody).not.toContain("organization_memberships");
  });

  it("does not send a client to a portal they cannot enter", () => {
    expect(signupActionBody).toContain(
      'authCallbackUrl(isClient ? "/contact" : "/app/applicant")',
    );
  });
});

describe("the form asks each audience only what applies to them", () => {
  it("defaults to the applicant audience", () => {
    expect(form).toContain('useState<Intent>("applicant")');
  });

  it("renders the company field only for a company registration", () => {
    expect(form).toMatch(/\{isClient \? \(\s*<div className="space-y-2">\s*<Label htmlFor="company">/);
  });

  it("does not ask an applicant for a work email", () => {
    expect(form).toContain(
      '{isClient ? "Work email" : "Email address"}',
    );
  });

  it("tells a company registrant that portal access comes later", () => {
    // Otherwise a client registers, verifies, clicks through, and is refused
    // at /app/client with no idea that the account was never provisioned.
    expect(form).toContain("Portal access is enabled once your company is set up");
  });
});

describe("staff accounts are not self-service", () => {
  it("states that People Ops creates the account", () => {
    // JSX collapses a newline between text runs into a single space at render
    // time, so the source contains "are\n          created" while the page says
    // "are created". Normalising whitespace asserts what the user reads.
    expect(flatten(employeeForm)).toContain(
      "Employee and admin accounts are created by People Ops",
    );
  });

  it("routes a stuck starter to IT Support", () => {
    expect(employeeForm).toContain("mailto:it@beepabpo.com");
  });

  it("offers no employee sign-up link", () => {
    // A "create your account" affordance on the staff portal would let anyone
    // claim a Beepa identity. The requirement was that the path be visible,
    // not that it be self-served.
    expect(employeeForm).not.toMatch(/href=["']\/signup/);
  });
});