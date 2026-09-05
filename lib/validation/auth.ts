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

export const signupSchema = z
  .object({
    firstName: z.string().min(1, "First name is required.").max(80),
    lastName: z.string().min(1, "Last name is required.").max(80),
    email: z.string().email("Enter a valid work email."),
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
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid work email."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
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
