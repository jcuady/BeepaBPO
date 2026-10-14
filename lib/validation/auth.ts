import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const employeeLoginSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your work email or employee ID.")
    .refine(
      (value) =>
        z.string().email().safeParse(value).success ||
        /^[a-zA-Z0-9._-]{3,40}$/.test(value),
      "Enter a valid work email or employee ID.",
    ),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/**
 * Who is signing up. The two audiences are not variations of one form.
 *
 * An applicant is looking for a job and has no company; a client is a business
 * registering to hire. Before this field existed the form was client-shaped for
 * both -- "Work email", a `you@company.com` placeholder, and a Company name
 * field -- while the server assigned every single signup the `applicant` role.
 * A client registering through that form got an applicant account and the
 * applicant portal, with no way to reach the client portal they had just
 * registered for.
 */
export const signupIntentSchema = z.enum(["applicant", "client"]);

export const signupSchema = z
  .object({
    intent: signupIntentSchema.default("applicant"),
    fullName: z.string().min(1, "Full name is required.").max(160),
    email: z.string().email("Enter a valid email address."),
    company: z.string().max(120).optional(),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
    acceptTerms: z
      .boolean()
      .refine((v) => v === true, {
        message: "You must accept the Terms and Privacy Policy.",
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  // A company name is required to register a company, and meaningless for
  // someone applying for a job -- which is why it is now conditional rather
  // than merely optional. Optional meant it could be silently absent for the
  // one audience where it is the whole point of the form.
  .refine((data) => data.intent !== "client" || !!data.company?.trim(), {
    message: "Company name is required.",
    path: ["company"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid work email."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().optional(),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * Changing a password while signed in needs the CURRENT one as well as the new
 * pair. `resetPasswordSchema` cannot be reused here: it has no `currentPassword`
 * field, so validating the new pair alone is what let a bare session rotate the
 * credential (CWE-620).
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(8, "Confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120),
  email: z.string().email("Enter a valid work email."),
  company: z.string().min(1, "Company is required.").max(120),
  message: z
    .string()
    .min(10, "Tell us a bit more about what you need.")
    .max(2000),
  /** Honeypot. Must stay empty. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
