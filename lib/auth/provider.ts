/** @deprecated Supabase Auth replaces the mock provider. */
export type AuthProvider = never;

/** @deprecated Supabase Auth replaces the mock provider. */
export function getAuthProvider(): never {
  throw new Error("Mock auth provider removed. Use Supabase Auth via lib/auth/actions.");
}
