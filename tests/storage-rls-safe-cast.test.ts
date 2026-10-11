import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Six storage policies in 20260906000800_storage_buckets.sql cast the first
 * folder segment of a storage object name straight to uuid:
 *
 *   public.is_self_employee(((storage.foldername(name))[1])::uuid)
 *   public.can_access_client(((storage.foldername(name))[1])::uuid)
 *
 * Object names are caller-supplied, so any name whose first segment is not a
 * uuid made the policy evaluation RAISE `invalid input syntax for type uuid`
 * rather than return false. A policy that raises is not a policy that denies:
 * the error aborts the statement, so one malformed object made every read
 * against that bucket fail outright.
 *
 * The fix routes the cast through an immutable, regex-guarded `public.try_uuid`
 * so a malformed path yields NULL and the predicate denies. It is a new
 * migration because 20260906000800 is applied to the live database.
 *
 * The subtle half is that NULL is not automatically "deny". The two helpers
 * treat NULL differently, and getting that wrong turns the fix into an
 * escalation:
 *
 *   is_self_employee(NULL) -> false. Its body is `exists (... where e.id = $1)`,
 *     and `e.id = NULL` matches no row, so EXISTS is false. Safe cast alone denies.
 *
 *   can_access_client(NULL) -> CAN BE TRUE. Its body ORs in
 *     has_permission('clients.read' | 'clients.manage' | 'system.manage'),
 *     none of which depend on the argument, so a permission holder gets TRUE
 *     for a NULL organization id. Safe cast alone would have converted "raise,
 *     therefore deny" into "allow the entire bucket" for exactly those users.
 *     Those three policies need an explicit `is not null` guard, and the
 *     assertions below pin that guard so it cannot be dropped as redundancy.
 *
 * These assertions read migration source text. They cannot run a policy, so
 * they pin the *shape* of the fix: the helper exists and is immutable, the six
 * policies are dropped rather than left in place, and every bucket name,
 * permission code, command and role is byte-identical to the original.
 */

/** The exact unsafe shape the original migration uses. */
const UNSAFE_CAST = /foldername\(name\)\)\[1\]\)\s*::uuid/i;

/**
 * Every `::uuid` outside the helper's own body. The helper is the only place a
 * cast may appear at all, which catches not just the original shape but any
 * variant of it, including a safe call with a redundant cast bolted on top.
 */
function uuidCastsOutsideHelper(sql: string): number {
  const code = stripComments(sql);
  const m = /as\s+\$\$([\s\S]*?)\$\$;\s*revoke execute on function public\.try_uuid/i.exec(code);
  if (!m || m.index === undefined) return Number.POSITIVE_INFINITY;
  const outside = code.slice(0, m.index) + code.slice(m.index + m[0].length);
  return (outside.match(/::uuid/gi) ?? []).length;
}

/** Every policy whose first path segment is cast to uuid in the original. */
const AFFECTED = [
  "storage_employee_docs_select",
  "storage_employee_docs_insert",
  "storage_client_docs_select",
  "storage_client_docs_insert",
  "storage_contracts_select",
  "storage_payslips_select",
];

/** Policies in the original that carry no uuid cast and must not be touched. */
const UNTOUCHED = [
  "storage_avatars_select",
  "storage_avatars_insert",
  "storage_avatars_update",
  "storage_avatars_delete",
  "storage_employee_docs_update",
  "storage_employee_docs_delete",
  "storage_applicant_docs_select",
  "storage_applicant_docs_insert",
  "storage_applicant_docs_manage",
  "storage_applicant_docs_delete",
  "storage_ticket_attachments_select",
  "storage_ticket_attachments_insert",
  "storage_client_docs_manage",
  "storage_contracts_insert",
  "storage_payslips_insert",
  "storage_marketing_media_select",
  "storage_marketing_media_insert",
  "storage_marketing_media_manage",
  "storage_marketing_media_delete",
];

const ORIGINAL = "20260906000800_storage_buckets.sql";
const FIX = "20261011130000_storage_rls_safe_uuid_cast.sql";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), "utf8");

const stripComments = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const allMigrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => ({ file: f, raw: read(f), code: stripComments(read(f)) }));

const originalRaw = read(ORIGINAL);
const originalCode = stripComments(originalRaw);
const fixRaw = read(FIX);
const fixCode = stripComments(fixRaw);
const afterFix = allMigrations.filter((m) => m.file > FIX);

type Policy = {
  name: string;
  cmd: string;
  roles: string;
  buckets: string[];
  permissions: string[];
  body: string;
};

/**
 * Split on `;`. No policy body contains a semicolon, and the one dollar-quoted
 * function body in the fix migration splits across statements harmlessly: the
 * halves do not start with `create policy`, so they are ignored.
 */
function parsePolicies(sql: string): Map<string, Policy> {
  const out = new Map<string, Policy>();
  for (const chunk of stripComments(sql).split(";")) {
    const head = /^\s*create\s+policy\s+(\w+)\s+on\s+storage\.objects\b/i.exec(chunk);
    if (!head) continue;
    const name = head[1];
    out.set(name, {
      name,
      cmd: /for\s+(select|insert|update|delete)\b/i.exec(chunk)?.[1] ?? "?",
      roles:
        /to\s+([a-z0-9_,\s]+?)\s+(?:using|with\s+check)/i.exec(chunk)?.[1]
          ?.trim()
          .replace(/\s+/g, " ") ?? "?",
      buckets: [...chunk.matchAll(/bucket_id\s*=\s*'([^']+)'/gi)].map((m) => m[1]),
      permissions: [...chunk.matchAll(/has_permission\('([^']+)'\)/gi)].map((m) => m[1]),
      body: chunk,
    });
  }
  return out;
}

const originalPolicies = parsePolicies(originalRaw);
const fixPolicies = parsePolicies(fixRaw);

/** Policies the fix drops, parsed out of its `drop policy if exists` statements. */
function droppedPolicies(sql: string): string[] {
  return [...stripComments(sql).matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?(\w+)\s+on\s+storage\.objects/gi)].map(
    (m) => m[1],
  );
}

/** The predicate half of a policy: everything after the first `using` / `with check`. */
function predicate(policy: Policy): string {
  const i = policy.body.search(/using|with\s+check/i);
  return i < 0 ? policy.body : policy.body.slice(i);
}

describe("storage RLS casts a malformed path safely", () => {
  it("found the migrations to scan, and scopes the forward checks correctly", () => {
    expect(allMigrations.length, "no migrations read; every check below would pass vacuously").toBeGreaterThan(20);
    expect(allMigrations.map((m) => m.file)).toContain(FIX);
    expect(ORIGINAL < FIX, "the original policy creator should sort before the fix").toBe(true);

    // The scan has to actually see the defect it claims to be guarding against.
    expect(originalCode).toMatch(UNSAFE_CAST);
    expect(originalPolicies.size).toBeGreaterThan(0);
  });

  it("the original migration is left intact, because it is already applied", () => {
    // Editing applied migration history is how a fix gets lost on the next reset.
    // The unsafe casts stay; the forward-looking checks below are what carry it.
    expect(originalRaw).toMatch(UNSAFE_CAST);
    expect(fixRaw).toContain("20260906000800");
  });

  it("provides try_uuid as an immutable, regex-guarded pure-SQL cast", () => {
    expect(fixCode).toMatch(
      /create\s+or\s+replace\s+function\s+public\.try_uuid\s*\(\s*\w+\s+text\s*\)\s*\nreturns\s+uuid/i,
    );
    // IMMUTABLE is load-bearing: the helper is used inside a policy predicate and
    // must stay usable in index and policy expressions.
    expect(fixCode).toMatch(/function\s+public\.try_uuid[\s\S]*?language\s+sql[\s\S]*?immutable/i);
    expect(fixCode).not.toMatch(/function\s+public\.try_uuid[\s\S]*?language\s+plpgsql/i);

    const body = /as\s+\$\$([\s\S]*?)\$\$;\s*revoke execute on function public\.try_uuid/i.exec(fixCode)?.[1] ?? "";
    expect(body, "could not isolate the try_uuid body").not.toBe("");
    // A plpgsql EXCEPTION block is a subtransaction and cannot be treated as a
    // safe constant; the guard must be the regex CASE instead.
    expect(body).not.toMatch(/exception/i);
    expect(body).toMatch(/~/);
    expect(body).toMatch(/\^?\[0-9a-f[^\]]{0,12}\]\{8\}/i);
    expect(body).toMatch(/then\s+p_value::uuid/i);
    expect(body).toMatch(/else\s+null::uuid/i);
  });

  it("does not reintroduce a bare uuid cast of a foldername anywhere", () => {
    expect(fixCode, "the fix migration re-creates a policy with the raising cast").not.toMatch(UNSAFE_CAST);
    expect(
      uuidCastsOutsideHelper(fixCode),
      "a uuid cast escaped the helper body, so some predicate can still raise",
    ).toBe(0);

    // Every foldername predicate in the fix goes through the helper.
    for (const chunk of fixCode.split(";")) {
      if (/storage\.foldername/.test(chunk)) {
        expect(chunk, `a foldername predicate bypasses try_uuid:\n${chunk.trim()}`).toMatch(/public\.try_uuid\(/);
      }
    }
  });

  it("no later migration puts the raising cast back into a storage policy", () => {
    const offenders = afterFix
      .filter((m) => UNSAFE_CAST.test(m.code))
      .map((m) => m.file);
    expect(
      offenders,
      `these migrations run after ${FIX} and cast a foldername straight to uuid, which raises:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("re-creates exactly the six affected policies, and drops them rather than redefining in place", () => {
    // `create policy` has no OR REPLACE, so a redefinition would raise
    // "policy already exists" at apply time and the migration would half-apply.
    expect(droppedPolicies(fixRaw).sort(), "every affected policy must be dropped first").toEqual([...AFFECTED].sort());
    expect([...fixPolicies.keys()].sort(), "the fix must recreate the six policies it touches").toEqual(
      [...AFFECTED].sort(),
    );
  });

  it("leaves the policies that never cast alone", () => {
    // Dropping and recreating a policy that was already correct risks losing a
    // detail nobody noticed, for no security gain.
    expect(droppedPolicies(fixRaw)).not.toContain("storage_avatars_select");
    expect(droppedPolicies(fixRaw)).not.toContain("storage_marketing_media_delete");
    for (const name of UNTOUCHED) {
      expect(fixPolicies.has(name), `${name} was recreated but carries no uuid cast`).toBe(false);
    }
    // And they are all still present in the original, so the list above is real.
    for (const name of UNTOUCHED) {
      expect(originalPolicies.has(name), `${name} missing from the original migration; re-check UNTOUCHED`).toBe(true);
    }
  });

  it("preserves every bucket, permission, command and role from the original", () => {
    for (const name of AFFECTED) {
      const before = originalPolicies.get(name);
      const after = fixPolicies.get(name);
      expect(before, `${name} not found in ${ORIGINAL}`).toBeDefined();
      expect(after, `${name} not recreated by ${FIX}`).toBeDefined();
      if (!before || !after) continue;

      expect(after.cmd, `${name}: the command changed`).toBe(before.cmd);
      expect(after.roles, `${name}: the role list changed`).toBe(before.roles);
      expect(after.buckets, `${name}: the bucket_id changed`).toEqual(before.buckets);
      // Order too: a rewritten permission list is how a subtly wider policy lands.
      expect(after.permissions, `${name}: the permission alternatives changed`).toEqual(before.permissions);
    }
  });

  it("keeps the original's permission asymmetry instead of tidying it", () => {
    // select honours employees.documents.read, insert does not. That is
    // pre-existing and intentional; "helpfully" adding read to insert would
    // widen access, and removing it from select would narrow it.
    expect(fixPolicies.get("storage_employee_docs_insert")?.permissions).toEqual([
      "employees.documents.manage",
    ]);
    expect(fixPolicies.get("storage_employee_docs_select")?.permissions).toEqual([
      "employees.documents.read",
      "employees.documents.manage",
    ]);
  });
});

describe("a NULL cast denies instead of raising, in both directions", () => {
  it("is_self_employee is NULL-safe on its own, so it takes the bare safe call", () => {
    // is_self_employee is `exists (select 1 from public.employees e where e.id = $1 ...)`,
    // so `e.id = NULL` matches nothing and it returns false. Verified against the
    // definition in 20260906000700_workforce_attendance_leave.sql.
    for (const name of ["storage_employee_docs_select", "storage_employee_docs_insert", "storage_payslips_select"]) {
      const body = predicate(fixPolicies.get(name)!);
      expect(body, `${name} should call is_self_employee through try_uuid`).toMatch(
        /is_self_employee\(\s*public\.try_uuid\(\s*\(storage\.foldername\(name\)\)\[1\]\s*\)\s*\)/i,
      );
    }
  });

  it("can_access_client is NOT NULL-safe, so it takes an explicit guard", () => {
    // can_access_client ORs in has_permission('clients.read' | 'clients.manage' |
    // 'system.manage'), which do not depend on the argument. Without the guard,
    // try_uuid returning NULL would hand a permission holder the whole bucket
    // on any malformed path, turning a denial into an escalation.
    for (const name of ["storage_client_docs_select", "storage_client_docs_insert", "storage_contracts_select"]) {
      const body = predicate(fixPolicies.get(name)!);
      expect(body, `${name} calls can_access_client without a null guard`).toMatch(
        /public\.try_uuid\(\s*\(storage\.foldername\(name\)\)\[1\]\s*\)\s+is\s+not\s+null\s+and\s+public\.can_access_client\(\s*public\.try_uuid\(/i,
      );
    }
  });

  it("records why the two helpers are handled differently, so it is not 'simplified' away", () => {
    expect(fixRaw).toContain("is_self_employee(NULL) returns FALSE");
    expect(fixRaw).toContain("can_access_client(NULL) can return TRUE");
  });
});

describe("negative controls", () => {
  // The point of these is that the assertions above are load-bearing. A guard
  // that cannot fail is worse than no guard, because it reads like a check.

  it("catches the bare cast being reintroduced", () => {
    const regressed = fixRaw.replace(
      /public\.try_uuid\(\(storage\.foldername\(name\)\)\[1\]\)/,
      "((storage.foldername(name))[1])::uuid",
    );
    expect(regressed).not.toBe(fixRaw);
    expect(regressed).toMatch(UNSAFE_CAST);
    expect(uuidCastsOutsideHelper(regressed)).toBeGreaterThan(0);
  });

  it("catches the null guard being dropped from a can_access_client policy", () => {
    const regressed = fixRaw.replace(
      /public\.try_uuid\(\(storage\.foldername\(name\)\)\[1\]\) is not null\s*\n\s*and\s+/,
      "",
    );
    expect(regressed).not.toBe(fixRaw);
    expect(predicate(parsePolicies(regressed).get("storage_client_docs_select")!)).not.toMatch(/is\s+not\s+null/i);
  });

  it("catches a permission being dropped from a recreated policy", () => {
    const regressed = fixRaw.replace("public.has_permission('billing.read')\n", "");
    expect(regressed).not.toBe(fixRaw);
    expect(parsePolicies(regressed).get("storage_contracts_select")!.permissions).not.toEqual(
      originalPolicies.get("storage_contracts_select")!.permissions,
    );
  });

  it("catches a bucket being repointed", () => {
    const regressed = fixRaw.replace("bucket_id = 'payslips'", "bucket_id = 'contracts'");
    expect(regressed).not.toBe(fixRaw);
    expect(parsePolicies(regressed).get("storage_payslips_select")!.buckets).not.toEqual(
      originalPolicies.get("storage_payslips_select")!.buckets,
    );
  });

  it("catches a policy being redefined without being dropped", () => {
    // Re-stating this is what makes the `droppedPolicies` assertion meaningful.
    const regressed = fixRaw.replace(/drop policy if exists storage_payslips_select on storage\.objects;/, "");
    expect(regressed).not.toBe(fixRaw);
    expect(droppedPolicies(regressed)).not.toContain("storage_payslips_select");
  });

  it("catches try_uuid being demoted to plpgsql", () => {
    const regressed = fixRaw.replace(/(function\s+public\.try_uuid[\s\S]*?)language sql/i, "$1language plpgsql");
    expect(regressed).not.toBe(fixRaw);
    expect(regressed).toMatch(/function\s+public\.try_uuid[\s\S]*?language\s+plpgsql/i);
  });

  it("the parser really does read the original policies, not an empty set", () => {
    // If `parsePolicies` silently matched nothing, every preservation assertion
    // above would pass on empty maps.
    expect(originalPolicies.size).toBe(19 + 6);
    expect(originalPolicies.get("storage_contracts_select")?.buckets).toEqual(["contracts"]);
    expect(originalPolicies.get("storage_payslips_select")?.permissions).toEqual([
      "payroll.read",
      "payroll.manage",
      "payroll.self",
    ]);
    expect(originalPolicies.get("storage_client_docs_select")?.roles).toBe("authenticated");
  });
});