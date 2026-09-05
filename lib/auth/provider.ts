import { createHash, randomBytes } from "node:crypto";
import type { LoginInput, SignupInput } from "@/lib/validation/auth";

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  verified: boolean;
  passwordHash: string;
  resetTokenHash?: string;
  resetTokenExp?: number;
  verifyTokenHash?: string;
};

export type AuthResult =
  | { ok: true; user: Omit<AuthUser, "passwordHash" | "resetTokenHash" | "verifyTokenHash"> }
  | { ok: false; error: string };

export type AuthProvider = {
  signIn(input: LoginInput): Promise<AuthResult>;
  signUp(input: SignupInput): Promise<AuthResult & { verifyToken?: string }>;
  requestPasswordReset(email: string): Promise<{ ok: true; token?: string }>;
  resetPassword(token: string, password: string): Promise<AuthResult>;
  verifyEmail(token: string): Promise<AuthResult>;
  getUserById(id: string): Promise<AuthUser | null>;
};

function hashPassword(password: string): string {
  return createHash("sha256").update(`beepa:${password}`).digest("hex");
}

function publicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    company: user.company,
    verified: user.verified,
  };
}

/** In-memory mock. ponytail: ceiling = process memory; swap to Supabase AuthProvider. */
const store = new Map<string, AuthUser>();

export const mockAuthProvider: AuthProvider = {
  async signIn(input) {
    const key = input.email.toLowerCase();
    const user = [...store.values()].find(
      (u) =>
        u.email.toLowerCase() === key ||
        u.id.toLowerCase() === key,
    );
    if (!user || user.passwordHash !== hashPassword(input.password)) {
      return {
        ok: false,
        error: "Invalid email or password.",
      };
    }
    return { ok: true, user: publicUser(user) };
  },

  async signUp(input) {
    const exists = [...store.values()].some(
      (u) => u.email.toLowerCase() === input.email.toLowerCase(),
    );
    if (exists) {
      // No account enumeration: same success shape after a fake delay path
      return {
        ok: false,
        error: "Unable to create account with that email.",
      };
    }
    const verifyToken = randomBytes(24).toString("hex");
    const user: AuthUser = {
      id: randomBytes(12).toString("hex"),
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company || undefined,
      verified: false,
      passwordHash: hashPassword(input.password),
      verifyTokenHash: hashPassword(verifyToken),
    };
    store.set(user.id, user);
    return { ok: true, user: publicUser(user), verifyToken };
  },

  async requestPasswordReset(email) {
    const user = [...store.values()].find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    // Always ok to avoid enumeration
    if (!user) return { ok: true };
    const token = randomBytes(24).toString("hex");
    user.resetTokenHash = hashPassword(token);
    user.resetTokenExp = Date.now() + 1000 * 60 * 60;
    store.set(user.id, user);
    return { ok: true, token };
  },

  async resetPassword(token, password) {
    const tokenHash = hashPassword(token);
    const user = [...store.values()].find(
      (u) =>
        u.resetTokenHash === tokenHash &&
        u.resetTokenExp &&
        u.resetTokenExp > Date.now(),
    );
    if (!user) {
      return { ok: false, error: "This reset link is invalid or has expired." };
    }
    user.passwordHash = hashPassword(password);
    user.resetTokenHash = undefined;
    user.resetTokenExp = undefined;
    store.set(user.id, user);
    return { ok: true, user: publicUser(user) };
  },

  async verifyEmail(token) {
    const tokenHash = hashPassword(token);
    const user = [...store.values()].find(
      (u) => u.verifyTokenHash === tokenHash,
    );
    if (!user) {
      return { ok: false, error: "This verification link is invalid or has expired." };
    }
    user.verified = true;
    user.verifyTokenHash = undefined;
    store.set(user.id, user);
    return { ok: true, user: publicUser(user) };
  },

  async getUserById(id) {
    return store.get(id) ?? null;
  },
};

export function getAuthProvider(): AuthProvider {
  return mockAuthProvider;
}
