import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two failures cost two `db push` attempts on `20261006140000`, and both looked
 * like database bugs rather than authoring bugs.
 *
 * 1. `create or replace function ... language plpgsql ... as $$` with no
 *    `returns` clause. PostgreSQL rejects that with `42P13 function result type
 *    must be specified`. A trigger function still has to declare `returns
 *    trigger`; Postgres does not infer it.
 * 2. After adding it in the canonical position — `language` first, `returns`
 *    second — the push failed again, this time with `syntax error at or near
 *    "trigger"`. That is not a PostgreSQL error: the same body with the same
 *    clauses in the order `returns trigger`, `language plpgsql` applies
 *    cleanly, and so does the same function with a single-quoted body. The
 *    Supabase CLI's migration splitter accepts `RETURNS` only before `LANGUAGE`.
 *
 * Both are silent until the migration runs against a real database, which is
 * why they belong in the unit suite rather than in review.
 */
const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");
const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));

type Fn = { name: string; returnsAt: number; languageAt: number; hasReturns: boolean };
const functions: Array<Fn & { file: string }> = [];

for (const file of files) {
  const text = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
  // Statement head runs from CREATE FUNCTION up to the opening dollar quote.
  const re = /create\s+(?:or\s+replace\s+)?function\s+([\w.]+)\s*\([\s\S]*?\)\s*([\s\S]*?)\bas\s+\$/g;
  for (const m of text.matchAll(re)) {
    const [, name, clauses] = m;
    const returnsMatch = /\breturns\s+/i.exec(clauses);
    const languageMatch = /\blanguage\s+/i.exec(clauses);
    functions.push({
      file,
      name,
      returnsAt: returnsMatch?.index ?? -1,
      languageAt: languageMatch?.index ?? -1,
      hasReturns: Boolean(returnsMatch),
    });
  }
}

describe("migration function clauses", () => {
  it("found the CREATE FUNCTION statements to check", () => {
    expect(functions.length, "no functions found; this suite would pass vacuously").toBeGreaterThan(0);
  });

  it("every function declares a return type", () => {
    // 42P13 at apply time otherwise. Trigger functions are not inferred.
    const missing = functions.filter((f) => !f.hasReturns).map((f) => `${f.file}: ${f.name}`);
    expect(missing, `no RETURN clause; PostgreSQL fails these with 42P13:\n${missing.join("\n")}`).toEqual([]);
  });

  it("declares RETURNS before LANGUAGE, which is the order the CLI accepts", () => {
    const wrong = functions
      .filter((f) => f.hasReturns && f.returnsAt > f.languageAt)
      .map((f) => `${f.file}: ${f.name} has LANGUAGE before RETURNS`);
    expect(
      wrong,
      `the Supabase CLI rejects these with 'syntax error at or near' the return type:\n${wrong.join("\n")}`,
    ).toEqual([]);
  });
});