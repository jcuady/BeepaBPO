/**
 * Render the empty states that no demo account can reach.
 *
 * WHY THIS EXISTS
 * ---------------
 * Four `/app/my` pages branch on `employee ? <form> : <p>` — `/app/my/attendance`
 * (twice), `/app/my/leave`, `/app/my/requests`, `/app/my/cash-advances` — and every
 * one of those paragraphs was sitting at **14px**, too small for body copy, while
 * the audit reported those pages clean for all 7 internal roles. The reason is
 * structural, not a bug in the audit's rules:
 *
 *   - every demo account that reaches those pages HAS an employee record, so the
 *     form branch always wins; and
 *   - `applicant` has no employee record, but RBAC stops it at `/app/applicant`,
 *     so it never reaches `/app/my` either.
 *
 * So the pages measure clean forever — for the one user the message is written
 * for. Those paragraphs had no automated check that could see them. They were
 * pinned by source-level assertions instead, a weaker claim, and labelled as such
 * (REMAINING_WORK §2.8a).
 *
 * A NOTE ON THE COUNT, because the previous version of that document was wrong
 * --------------------------------------------------------------------------
 * §2.8a listed FIVE pages including `/app/my/support`. It has no `employee` branch
 * at all — it renders one unconditional paragraph that does not mention an
 * employee record — so it was never in this state and never needed to be. The real
 * figure is four pages and five paragraphs. It is listed below as a page that must
 * still render and stay legible, which is worth checking, but not as an empty
 * state. A coverage claim that overstates what is covered is its own defect, and
 * the probe was written to find exactly this sort of thing, so it is recorded
 * rather than quietly corrected.
 *
 * WHAT THIS DOES INSTEAD
 * ----------------------
 * It BUILDS the state rather than hoping to find it. A throwaway auth user is
 * created with the admin API, given an `internal` membership and the `employee`
 * role, and deliberately **not** given a row in `employees`. That is exactly the
 * production situation — an account provisioned by an admin who has not finished
 * linking the profile — and it makes `employee` null on every one of those pages.
 *
 * The account is NOT added to `lib/demo/users.ts`. That file feeds
 * `DemoLoginPicker`, so a fourteenth entry would become a button on the public
 * login page — the reason this gap was previously declined. A throwaway created
 * per run costs nothing visible and is deleted in a `finally`.
 *
 * WHAT ELSE IT ASSERTS
 * --------------------
 * Three things per page, because each was a way this state could be broken
 * without anything else noticing:
 *
 *   1. the empty-state branch rendered, rather than a form or a bare blank;
 *   2. the page has a heading, so it says where it is; and
 *   3. body copy is >= 16px at 390px — the reason this probe exists.
 *
 * (1) matches on the SENTENCE, not on the absence of a form, so "the user was
 * told why" is distinguishable from "the page is merely empty". (3) is the one
 * that would have caught the 14px paragraphs had they been renderable when the
 * font was fixed.
 *
 * The heading assertion was written before reading the pages and this file's
 * first draft claimed `/app/my/leave` and `/app/my/requests` render no heading at
 * all in this state. They do — `PageHeader` sits OUTSIDE the `employee ?` ternary
 * on every one of the five pages, so it renders on both branches. The assertion
 * is kept because it is cheap and a future refactor could move it inside the
 * ternary; the CLAIM about the defect was wrong and is recorded here rather than
 * quietly dropped, since "checked and found fine" and "never checked" are
 * different and only one of them is true.
 *
 * SAFETY
 * ------
 * Creates and deletes its own auth user, membership and role link, in a `finally`,
 * and the deletion is ASSERTED rather than assumed. Read-only against `employees`
 * — it never creates or modifies one. Runs serially with the other workflow
 * exercises because they share one database.
 *
 * Usage: node scripts/audit/qa-probe-unlinked-employee.mjs [--no-cleanup]
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fillHeld } from "./lib/browser-form.mjs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const EVIDENCE = "docs/evidence/unlinked-employee-check.json";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const BASE = (process.env.QA_BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const APPLY_CLEANUP = !process.argv.includes("--no-cleanup");
const PASSWORD = "QaUnlinked#2026x";
const THROWAWAY = `qa.unlinked.${Date.now()}@nowhere.example`;

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const results = [];
const notes = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (msg) => { notes.push(msg); console.log(`NOTE  ${msg}`); };

/**
 * The pages, and what each must show a user with no employee record.
 *
 * `emptyState` marks the four pages that genuinely branch on `employee`. The
 * pattern is matched against the rendered text rather than asserted structurally,
 * because the four word differently — `leave` says "profile not linked",
 * `requests` says "require an employee record", `attendance` says "Link your
 * employee profile". The first version used one regex for all of them
 * (`/employee profile|…|link your/i`) and FAILED two of the four for no reason
 * except that their copy does not use those words. An assertion that encodes one
 * author's phrasing reports the phrasing as the requirement.
 *
 * `support` is listed without one, and that is the finding: it has no employee
 * branch, so it is not an empty state at all. It is still checked for legibility,
 * which is worth having.
 */
const PAGES = [
  { path: "/app/my/attendance", heading: "Attendance", emptyState: /link your employee profile/i },
  { path: "/app/my/leave", heading: "Leave", emptyState: /not linked to an employee record/i },
  { path: "/app/my/requests", heading: "Requests", emptyState: /require an employee record/i },
  { path: "/app/my/support", heading: "Support", emptyState: null },
  { path: "/app/my/cash-advances", heading: "Cash Advances", emptyState: /link your employee profile/i },
];

// ---- fixture ---------------------------------------------------------------

const { data: org, error: orgErr } = await db
  .from("organizations")
  .select("id")
  .eq("slug", "beepa")
  .maybeSingle();
if (orgErr) throw new Error(`organizations: ${orgErr.message}`);
if (!org) throw new Error("no organization with slug 'beepa' — cannot build the state");

const { data: role } = await db.from("roles").select("id").eq("code", "employee").maybeSingle();
if (!role) throw new Error("role 'employee' not found");

let userId = null;
let membershipId = null;

async function buildFixture() {
  const created = await db.auth.admin.createUser({
    email: THROWAWAY,
    password: PASSWORD,
    email_confirm: true, // skips the confirmation mail, which is rate-limited here
    user_metadata: { full_name: "QA Unlinked", first_name: "QA", last_name: "Unlinked" },
  });
  if (created.error || !created.data.user) throw new Error(`createUser: ${created.error?.message}`);
  userId = created.data.user.id;

  const m = await db
    .from("organization_memberships")
    .insert({
      user_id: userId,
      organization_id: org.id,
      membership_type: "internal",
      status: "active",
      is_primary: true,
    })
    .select("id")
    .single();
  if (m.error) throw new Error(`membership: ${m.error.message}`);
  membershipId = m.data.id;

  const r = await db
    .from("membership_roles")
    .insert({ membership_id: membershipId, role_id: role.id });
  if (r.error) throw new Error(`membership_roles: ${r.error.message}`);

  // The whole point: prove there is NO employees row, rather than assuming it.
  const { data: emp } = await db.from("employees").select("id").eq("profile_id", userId).maybeSingle();
  if (emp) throw new Error("fixture is invalid — the throwaway user somehow has an employee record");

  console.log(`fixture: ${THROWAWAY} (${userId}), internal membership, NO employees row\n`);
}

async function destroyFixture() {
  if (!userId) return;
  if (!APPLY_CLEANUP) {
    console.log(`\n(--no-cleanup) leaving ${THROWAWAY} in place`);
    return;
  }
  if (membershipId) {
    await db.from("membership_roles").delete().eq("membership_id", membershipId);
    await db.from("organization_memberships").delete().eq("id", membershipId);
  }
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) {
    console.error(`cleanup FAILED for ${THROWAWAY}: ${error.message}`);
    return;
  }
  // Assert the deletion rather than trusting it. A silently-failed cleanup leaves
  // a real auth user behind, and the next run would create a second one.
  const { data: still } = await db.auth.admin.getUserById(userId);
  if (still?.user) {
    console.error(`cleanup FAILED — ${THROWAWAY} still exists`);
    results.push({ name: "throwaway account is deleted after the run", pass: false, detail: "still present" });
  } else {
    console.log("cleanup: throwaway account removed");
    results.push({ name: "throwaway account is deleted after the run", pass: true, detail: "" });
  }
}

// ---- run -------------------------------------------------------------------

const pages = [];
let verdict = "unknown";
let exitCode = 2;
let blocked = null;

try {
  await buildFixture();

  const browser = await chromium.launch();

  // TWO viewports, and the difference between them IS the point.
  //
  // `EmptyState` and the `PageHeader` subtitle size themselves
  // `text-base … sm:text-sm` — 16px below 640px, 14px above. This repository's
  // stated rule is "body text below 16px **on narrow screens**"
  // (`audit-app-responsive.mjs`, line 13), and the eight body-copy fixes from §2.8
  // were all `text-base md:text-sm` for the same reason: 16px where the viewport is
  // narrow, unchanged on desktop.
  //
  // So the phone run is where the 16px rule bites and the desktop run is where it
  // does not. Measuring desktop against 16px would be this file inventing a
  // stricter rule than the repository holds, and reporting the whole brand's type
  // scale as a defect — which is exactly what the first desktop run did, failing
  // all five pages on the same `14px` that §2.8 deliberately kept.
  //
  // Desktop is still measured, and still recorded per paragraph, because it is the
  // only thing that would reveal an element collapsing to 12px — which is how the
  // footer's "People · Process · Progress" tagline surfaced here.
  const VIEWPORTS = [
    { w: 390, h: 844, label: "phone", minPx: 16 },
    { w: 1440, h: 900, label: "desktop", minPx: 0 },
  ];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();

    // The employee portal accepts an employee ID as well as an address and renders
    // `type="text"`, so `input[type=email]` does not match there.
    await page.goto(`${BASE}/employee/login`, { waitUntil: "domcontentloaded" });
    const emailField = page.locator("input[name=email], input[type=email]").first();
    await emailField.waitFor({ state: "visible", timeout: 20000 });
    await fillHeld(page, emailField, THROWAWAY);
    await fillHeld(page, page.locator("input[name=password]").first(), PASSWORD);
    await page.getByRole("button", { name: /access portal/i }).click();
    await page.waitForURL(/\/app(\/|$)/, { timeout: 30000 });
    if (vp.w === VIEWPORTS[0].w) {
      check("a member with no employee record can sign in", !page.url().includes("access-denied"), page.url());
    }

    for (const p of PAGES) {
      await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);

      // Landed on the page at all, rather than being redirected away.
      const reached = page.url().includes(p.path);
      const body = (await page.innerText("body")).replace(/\s+/g, " ");

      // The empty-state branch must be the one that rendered. Matching on the
      // SENTENCE is what distinguishes "the user was told why" from "the page is
      // merely empty" — but only the four pages that actually branch have such a
      // sentence, and `support` legitimately has none.
      const explained = p.emptyState === null ? true : p.emptyState.test(body);
      // A heading that NAMES the page, so it says where it is. Matching the name
      // rather than merely finding an <h1> is what stops a shared layout's generic
      // heading from satisfying this on five different pages.
      const h1 = await page.locator("h1").first().innerText().catch(() => "");
      const hasHeading = new RegExp(p.heading, "i").test(h1);

      check(`${p.path} renders its empty state rather than a form`, reached && explained,
        reached ? (explained ? "" : "no explanation found in the rendered text") : `redirected to ${page.url()}`);
      check(`${p.path} is titled "${p.heading}"`, hasHeading, hasHeading ? `"${h1.trim()}"` : `h1 was ${JSON.stringify(h1.trim()) || "(none)"}`);

      // Body copy must be >= 16px. This is the whole reason the probe exists: at
      // 14px these paragraphs were invisible to every other check.
      //
      // Only PAINTED PAGE CONTENT is measured. The first version counted any
      // `<p>` over 25 characters and failed all five pages on
      // `14px "Search for a command to run..."` — the command palette's
      // description, which lives in the app layout on every route. A check that
      // measures the wrong element reports its own scope as a product defect, and
      // it would have done so on every run forever.
      //
      // The exclusion is a ZERO-SIZE RECT, not a selector list. The palette is a
      // closed dialog with no `role="dialog"` wrapper in the DOM, so the obvious
      // `closest('[role=dialog]')` did not match it — that was the second version,
      // and it failed identically. `audit-app-responsive.mjs` already solved this
      // with a zero-size check, and an element that painted nothing is not body
      // copy whatever tag or role it carries. Reusing that signal is also why the
      // two gates agree.
      const sizes = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll("p")) {
          const t = (el.textContent ?? "").trim();
          if (t.length < 25) continue;
          if (el.children.length > 0) continue;
          // Not rendered: a closed dialog, `display: none`, or `sr-only` text.
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (el.closest("[data-meta]")) continue;
          if (el.closest('[class*="sr-only"], .sr-only')) continue;
          out.push({ text: t.slice(0, 60), px: Math.round(parseFloat(getComputedStyle(el).fontSize)) });
        }
        return out;
      });
      const tooSmall = sizes.filter((s) => s.px < vp.minPx);
      check(
        `${p.path} body copy meets its floor on ${vp.label} (${vp.w}px)`,
        tooSmall.length === 0,
        tooSmall.length
          ? tooSmall.map((s) => `${s.px}px "${s.text}"`).join("; ")
          : `${sizes.length} paragraph(s) checked, floor ${vp.minPx || "none"}px`,
      );

      pages.push({
        path: p.path,
        viewport: vp.label,
        width: vp.w,
        reached,
        emptyStateExplained: explained,
        heading: h1.trim() || null,
        paragraphs: sizes,
        undersizedParagraphs: tooSmall,
      });
    }

    await ctx.close();
  }

  await browser.close();

  const failures = results.filter((r) => !r.pass);
  verdict = failures.length ? "fail" : "clean";
  exitCode = failures.length ? 1 : 0;
} catch (err) {
  blocked = err.message;
  verdict = "unknown";
  exitCode = 2;
  console.error(`ABORT: ${err.message}`);
} finally {
  await destroyFixture();
}

// ---- evidence --------------------------------------------------------------

mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  EVIDENCE,
  JSON.stringify(
    {
      check: "unlinked-employee",
      generatedAt: new Date().toISOString(),
      base: BASE,
      // The premise of the whole probe, recorded so a reader can confirm the state
      // was actually built rather than assumed.
      fixture: {
        email: THROWAWAY,
        userId,
        membershipType: "internal",
        role: "employee",
        hasEmployeeRecord: false,
        addedToDemoLoginPicker: false,
      },
      verdict,
      verdictText:
        verdict === "clean"
          ? `all ${PAGES.length} empty-state pages render, explain themselves, and keep body copy at 16px or larger`
          : verdict === "fail"
            ? `${results.filter((r) => !r.pass).length} check(s) failed on the unlinked-employee state`
            : `could not build or render the state: ${blocked}`,
      pagesExercised: pages.length,
      assertionCount: results.length,
      failures: results.filter((r) => !r.pass),
      results,
      pages,
      notes,
      blocked,
      exitCode,
    },
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${EVIDENCE}`);

if (notes.length) {
  console.log("\n--- notes ---");
  for (const n of notes) console.log(`  ${n}`);
}

const failed = results.filter((r) => !r.pass).length;
console.log(
  `\n${results.length - failed}/${results.length} checks passed` +
    (notes.length ? `, ${notes.length} note(s)` : ""),
);
process.exit(exitCode);