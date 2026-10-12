/**
 * The user-facing copy for a failed write.
 *
 * WHY THIS EXISTS
 * Sixty-eight call sites across eighteen `"use server"` modules were written as
 *
 *     error: error?.message ?? "Unable to create lead."
 *
 * and the fallback was **unreachable**. `??` only applies when the left side is
 * nullish, and PostgREST always supplies a message — so what the user actually
 * read was always the driver's own text:
 *
 *     insert failed: duplicate key value violates unique constraint "crm_leads_pkey"
 *     null value in column "approved_by" violates not-null constraint
 *
 * and never the words the author had already chosen. `lib/auth/error-messages.ts`
 * records the same lesson for auth: a message that cannot distinguish causes
 * sends every investigation down the wrong path, and PostgREST vocabulary tells
 * a Beepa employee nothing they can act on.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * It does not classify the error. There is no mapping table, because mapping
 * Postgres error classes to product copy means inventing 68 decisions about
 * screens this file does not own — and the one thing all of those strings had
 * in common was that they were wrong.
 *
 * The error is not consulted at all. That is the contract: the detail belongs in
 * the server log, not in a toast. A function that takes the error and ignores it
 * is odd; a call site that passes only the author's chosen copy is not, and it
 * cannot be tempted into reintroducing the leak.
 *
 * Kept out of `lib/actions/types.ts` and the action modules themselves because a
 * `"use server"` module may only export async functions, which would make this
 * untestable — the same constraint documented in `lib/auth/error-messages.ts`.
 */

/**
 * Return the copy the caller supplies, ignoring any database error entirely.
 *
 * Call it as `writeFailed("Unable to create lead.")` at a site that has already
 * established an error occurred. The returned string is always `copy`; the
 * function exists so the *intent* — that this failure has known, human copy and
 * the driver's message is deliberately discarded — is visible at the call site
 * and greppable.
 */
export function writeFailed(copy: string): string {
  return copy;
}