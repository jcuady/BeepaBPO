// Exercise the CMS end to end: create, edit, publish, archive, for all six
// content types, plus the About page.
//
// WHY: `lib/cms` holds 14 exported actions — the largest single block in the app
// — and none had ever been driven through a browser. Every one of them requires
// the `cms.manage` permission, which exactly one demo role holds: `marketing`.
// `owner` and `super_admin` cannot reach this page at all, which §2 records as a
// separate open question.
//
// A structural gap this pass confirms rather than assumes: there is NO delete
// action anywhere in lib/cms/actions.ts. Content can be created, edited,
// published and archived — never removed. The exercise asserts that absence, and
// deletes its own rows through the service role, which is the only way a real
// user could not.
//
// SAFETY: every row carries a unique QA marker, so cleanup deletes by marker
// rather than by a remembered list of ids, and the count assertions can actually
// fail. The About page is snapshotted first and restored byte for byte.
//
// Usage: node scripts/audit/qa-exercise-cms-workflow.mjs

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { fillHeld } from "./lib/browser-form.mjs";
import { writeEvidence } from "./lib/evidence.mjs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (m) => console.log(`NOTE  ${m}`);
async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

const MARK = `qa${Date.now().toString(36)}`;
const CMS_EMAIL = "marketing@demo.beepabpo.com";
// The negative case was `owner@demo.beepabpo.com` precisely BECAUSE owner lacked
// `cms.manage` -- a privileged internal user who should be refused. It stopped being a valid
// negative case when `20261012010000_cms_manage_admin_recovery.sql` granted owner (and
// super_admin) the permission, which is the intended effect, not a regression.
//
// `hr` is the stronger replacement anyway: still a heavily-privileged internal role, and
// genuinely without `cms.manage`. Asserting that a senior internal user is refused tests the
// permission boundary rather than just the bottom of the role list.
const NON_CMS_EMAIL = "hr@demo.beepabpo.com";
// Roles that now hold `cms.manage` for recovery reasons, checked positively below.
const RECOVERY_ROLE_EMAIL = "owner@demo.beepabpo.com";

/**
 * The six content types, with the form-field suffixes each one registers under.
 * `prefix` matches the default `idPrefix` each form is rendered with on /app/cms.
 */
const ENTITIES = [
  {
    key: "blog", table: "blog_posts", entity: "blog_post", label: "blog post",
    primary: "title",
    create: { title: `QA Blog ${MARK}`, slug: `qa-blog-${MARK}`, excerpt: `QA excerpt ${MARK}`, body: `QA body ${MARK}.` },
    edit: (m) => ({ title: `QA Blog Edited ${m}` }),
  },
  {
    key: "service", table: "services", entity: "service", label: "service",
    primary: "title",
    create: { title: `QA Service ${MARK}`, slug: `qa-service-${MARK}`, summary: `QA summary ${MARK}`, description: `QA description ${MARK}.` },
    edit: (m) => ({ title: `QA Service Edited ${m}` }),
  },
  {
    key: "faq", table: "faqs", entity: "faq", label: "FAQ",
    primary: "question",
    create: { question: `QA question ${MARK}?`, category: "General", answer: `QA answer ${MARK}.` },
    edit: (m) => ({ question: `QA question edited ${m}?` }),
  },
  {
    key: "industry", table: "industries", entity: "industry", label: "industry",
    primary: "name",
    create: { name: `QA Industry ${MARK}`, slug: `qa-industry-${MARK}`, description: `QA industry description ${MARK}.` },
    edit: (m) => ({ name: `QA Industry Edited ${m}` }),
  },
  {
    key: "testimonial", table: "testimonials", entity: "testimonial", label: "testimonial",
    primary: "client_name",
    create: { client_name: `QA Client ${MARK}`, client_title: "Head of Ops", company_name: `QA Co ${MARK}`, rating: "5", quote: `QA quote ${MARK}.` },
    edit: (m) => ({ client_name: `QA Client Edited ${m}` }),
  },
  {
    key: "case", table: "case_studies", entity: "case_study", label: "case study",
    primary: "title",
    create: { title: `QA Case ${MARK}`, slug: `qa-case-${MARK}`, client_name: `QA Client ${MARK}`, industry: "BPO", summary: `QA case summary ${MARK}`, body: `QA case body ${MARK}.` },
    edit: (m) => ({ title: `QA Case Edited ${m}` }),
  },
];

const aboutKey = "public_about";
const { data: aboutBefore } = await must(
  db.from("site_settings").select("key, value, description, updated_by").eq("key", aboutKey).maybeSingle(),
  "about snapshot",
);
console.log(`marker: ${MARK}`);
console.log(`about page before: ${aboutBefore ? "present" : "(never set)"}\n`);

const beforeCounts = {};
for (const e of ENTITIES) {
  beforeCounts[e.table] = (await db.from(e.table).select("id", { count: "exact", head: true })).count;
}

const browser = await chromium.launch();
const consoleErrors = [];
const pageErrors = [];
const createdIds = [];

async function signIn(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const field = page.locator('input[name=email], input[type=email]').first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, field, email);
  await fillHeld(page, page.locator('input[type=password]').first(), env.DEMO_PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);
}

/**
 * Form field ids are per-FORM, not per-field-name.
 *
 * A single suffix map cannot work: testimonial renders `client_name` as
 * `-name`, while case study renders the same field as `-client`. Mapping by
 * field name made the case-study form unreachable (`#case-name` does not exist)
 * and aborted the run on the sixth and last entity. Each entity therefore
 * carries its own id map; anything not listed maps to itself.
 */
const ID_MAPS = {
  testimonial: { client_name: "name", client_title: "title", company_name: "company" },
  case: { client_name: "client" },
};

/** The form field id for a given field name, honouring that entity's id map. */
function fieldId(entityKey, prefix, name) {
  const map = ID_MAPS[entityKey] ?? {};
  return `#${prefix}-${map[name] ?? name}`;
}

/**
 * The list row for a specific piece of content.
 *
 * Scoped to a UNIQUE per-entity string, never to the shared run marker. Every
 * row created in one run carries the same marker, and the six CMS lists are
 * stacked in one DOM with FAQs *above* industries — so matching on the marker
 * returned the FAQ row while publishing, and silently re-published the FAQ
 * instead of the industry. The run reported "industry publish failed" against
 * code that was correct.
 */
function rowFor(page, text) {
  return page.locator("tr").filter({ hasText: text }).first();
}

try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });

  await signIn(page, CMS_EMAIL);
  await page.goto(`${BASE}/app/cms`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  check("a cms.manage holder can open /app/cms", !page.url().includes("/login") && !page.url().includes("denied"),
    page.url().replace(BASE, ""));

  // ---- the permission guard, before anything is created ----
  // `owner` holds 47 permissions and NOT cms.manage (verified by calling the
  // user_permission_codes RPC signed in as them, not by joining role_permissions,
  // which is a different source of truth). Sampling the URL once after a fixed
  // sleep raced the server-side redirect and read "/app/cms" for a page that was
  // about to refuse — so wait for the URL to settle before judging.
  {
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await signIn(otherPage, NON_CMS_EMAIL);
    await otherPage.goto(`${BASE}/app/cms`, { waitUntil: "domcontentloaded" });
    await otherPage.waitForURL(/access-denied|\/app\/cms/, { timeout: 15000 }).catch(() => {});
    await otherPage.waitForTimeout(3000);
    const url = otherPage.url();
    const text = (await otherPage.locator("body").innerText()).replace(/\s+/g, " ");
    // Assert on CONTENT, not on the URL. The guard is `forbidden()`, which may
    // redirect or may render the denial in place, and a URL-only check reported
    // "owner reached /app/cms" for a page that had already refused them.
    const creationForms = await otherPage
      .locator("#blog-title, #service-title, #faq-question, #industry-name, #testimonial-name, #case-title, #about-headline")
      .count();
    const cmsLists = await otherPage.locator("th", { hasText: /^(Question|Title|Client|Name)$/ }).count();
    const deniedBanner = /access denied|no active workspace access/i.test(text);
    const refused = creationForms === 0 && cmsLists === 0;
    check("a user WITHOUT cms.manage sees no CMS content or forms", refused,
      refused
        ? `url=${url.replace(BASE, "")} creationForms=${creationForms} cmsLists=${cmsLists}` +
          (deniedBanner ? " (explicit denial shown)" : " (no denial banner — see note)")
        : `url=${url.replace(BASE, "")} creationForms=${creationForms} cmsLists=${cmsLists}`);
    if (refused && !deniedBanner) {
      // Not a leak, but worth recording: if the page simply renders empty, the
      // user gets no explanation for a CMS they can see in the nav.
      note(`no explicit "access denied" banner was shown; the page body began: "${text.slice(0, 140)}"`);
    }
    await other.close();
  }

  // ---- the recovery grant, verified through the product rather than the database ----
  //
  // `qa-inspect-super-admin-gaps.mjs` proves `cms.manage` is granted to owner and super_admin
  // by reading `role_permissions`. That is the data layer; this is the product actually
  // honouring it. Without this the grant could be applied and still inert -- a page that
  // checks a different code, or a nav that hides the link, would leave `cms.manage` held by
  // three roles and still unreachable.
  {
    const rec = await browser.newContext();
    const recPage = await rec.newPage();
    await signIn(recPage, RECOVERY_ROLE_EMAIL);
    await recPage.goto(`${BASE}/app/cms`, { waitUntil: "domcontentloaded" });
    await recPage.waitForURL(/access-denied|\/app\/cms/, { timeout: 15000 }).catch(() => {});
    await recPage.waitForTimeout(3000);
    const recUrl = recPage.url();
    const recText = (await recPage.locator("body").innerText()).replace(/\s+/g, " ");
    const recForms = await recPage
      .locator("#blog-title, #service-title, #faq-question, #industry-name, #testimonial-name, #case-title, #about-headline")
      .count();
    const recDenied = /access denied|no active workspace access/i.test(recText);
    const allowed = !recDenied && recForms > 0;
    check(
      "owner can now reach the CMS (the cms.manage recovery grant works)",
      allowed,
      `url=${recUrl.replace(BASE, "")} creationForms=${recForms}${recDenied ? " (denied!)" : ""}`,
    );
    await rec.close();
  }

  // ---- one pass per content type ----
  for (const e of ENTITIES) {
    const fields = e.create;

    // --- create ---
    for (const [name, value] of Object.entries(fields)) {
      await page.locator(fieldId(e.key, e.key, name)).fill(value);
    }
    // The submit button is looked up from the form, via the MAPPED field id.
    // `#testimonial-client_name` does not exist — the form registers it as
    // `#testimonial-name` — so the button locator has to go through fieldId too.
    await page.locator(fieldId(e.key, e.key, e.primary)).locator("xpath=ancestor::form").first()
      .getByRole("button", { name: /save draft|save changes/i }).click();
    await page.waitForTimeout(5000);

    const created = (await must(
      db.from(e.table).select("id, status, " + e.primary).like(e.primary, `%${MARK}%`),
      `${e.table} after create`,
    ))[0];
    check(`create ${e.label}: a draft row exists`, Boolean(created),
      created ? `status=${created.status}` : `no row matching ${MARK}`);
    if (!created) continue;
    createdIds.push({ table: e.table, id: created.id });
    check(`create ${e.label}: it starts as a draft`, created.status === "draft", created.status);

    const editValues = e.edit(MARK);
    const editPrefix = `edit-${e.entity}-${created.id.slice(0, 8)}`;
    // --- edit ---
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const row = rowFor(page, fields[e.primary]);
    const editBtn = row.getByRole("button", { name: /^Edit$/ });
    if (await editBtn.count()) {
      await editBtn.click();
      await page.waitForTimeout(1500);
      const dlg = page.locator("[role=dialog]").last();
      // The edit dialog renders the SAME form under a per-record prefix, so the
      // same id map applies with that prefix swapped in.
      await dlg.locator(fieldId(e.key, editPrefix, e.primary)).fill(editValues[e.primary]);
      await dlg.getByRole("button", { name: /save changes/i }).click();
      await page.waitForTimeout(5000);
      const updated = await must(
        db.from(e.table).select(e.primary).eq("id", created.id).single(),
        `${e.table} after edit`,
      );
      check(`update ${e.label}: the edit is persisted`, updated[e.primary] === editValues[e.primary],
        `row now reads "${updated[e.primary]}"`);
    } else {
      check(`update ${e.label}: an Edit control exists`, false,
        `no Edit button on the row for "${fields[e.primary]}"`);
    }

    // --- publish, then archive ---
    // Keyed on this entity's own edited title, which is unique within the run.
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const row2 = rowFor(page, editValues[e.primary]);
    const publishBtn = row2.getByRole("button", { name: /^Publish$/ });
    if (await publishBtn.count()) {
      await publishBtn.click();
      await page.waitForTimeout(1200);
      // ConfirmDialog: the button is not the action.
      const confirm = page.locator("[role=dialog]").getByRole("button", { name: /^Publish$/ }).last();
      if (await confirm.count()) await confirm.click();
      await page.waitForTimeout(5000);
      // Only blog_posts carries published_at. Selecting it on any other table
      // raises a PostgREST error and aborts the run mid-loop — a column guessed
      // from the first entity rather than checked per entity.
      const published = await must(
        db.from(e.table).select(e.table === "blog_posts" ? "status, published_at" : "status")
          .eq("id", created.id).single(),
        `${e.table} after publish`,
      );
      check(`status ${e.label}: publish moves it to published`, published.status === "published",
        published.status === "published"
          ? (e.table === "blog_posts" ? `published_at=${published.published_at ? "set" : "NOT SET"}` : "published")
          : `status=${published.status}`);
    } else {
      check(`status ${e.label}: a Publish control exists`, false, "no Publish button on the row");
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    const row3 = rowFor(page, editValues[e.primary]);
    const archiveBtn = row3.getByRole("button", { name: /^Archive$/ });
    if (await archiveBtn.count()) {
      await archiveBtn.click();
      await page.waitForTimeout(1200);
      const confirmA = page.locator("[role=dialog]").getByRole("button", { name: /^Archive$/ }).last();
      if (await confirmA.count()) await confirmA.click();
      await page.waitForTimeout(5000);
      const archived = await must(
        db.from(e.table).select("status").eq("id", created.id).single(),
        `${e.table} after archive`,
      );
      check(`status ${e.label}: archive moves it to archived`, archived.status === "archived", archived.status);
    } else {
      check(`status ${e.label}: an Archive control exists`, false, "no Archive button on the row");
    }
  }

  // ---- the About page ----
  {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await page.locator("#about-headline").fill(`QA About headline ${MARK}`);
    await page.locator("#about-body").fill(`QA About body ${MARK}.`);
    await page.locator("#about-headline").locator("xpath=ancestor::form").first()
      .getByRole("button", { name: /save about page/i }).click();
    await page.waitForTimeout(5000);
    const after = await must(
      db.from("site_settings").select("value, updated_by").eq("key", aboutKey).maybeSingle(),
      "about after save",
    );
    check("upsertAboutPage writes the About content", after?.value?.headline === `QA About headline ${MARK}`,
      after ? `headline="${String(after.value?.headline).slice(0, 60)}"` : "no row written");
    note(`about page before this run: ${aboutBefore ? `headline="${String(aboutBefore.value?.headline).slice(0, 60)}"` : "never set — the row will be removed again"}`);
  }

  // ---- the structural gap: no delete action exists ----
  const cmsSource = readFileSync("lib/cms/actions.ts", "utf8");
  const hasDelete = /\.from\("(\w+)"\)\s*\.delete\(\)/.test(cmsSource)
    || /deleteService|deleteBlogPost|deleteFaq|deleteIndustry|deleteTestimonial|deleteCaseStudy/i.test(cmsSource);
  check("*** there is NO delete action for CMS content ***", hasDelete === false,
    hasDelete ? "a delete path was found" : "confirmed: content can be created, edited, published and archived, but never deleted");

  check("no uncaught page errors during the CMS run", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
  if (consoleErrors.length) note(`${consoleErrors.length} console error(s) (informational): ${consoleErrors.slice(0, 2).join(" | ").slice(0, 160)}`);
  await ctx.close();
} catch (e) {
  console.error(`\nRUN ERROR: ${e.message}`);
  console.error(e.stack?.split("\n").slice(1, 4).join("\n"));
  process.exitCode = 1;
} finally {
  // No delete action exists in the product, so the exercise removes its own rows
  // through the service role. Targeted by MARK, never by a remembered id list.
  for (const e of ENTITIES) {
    const { data, error } = await db.from(e.table).delete().like(e.primary, `%${MARK}%`).select("id");
    if (error) console.error(`  cleanup FAILED for ${e.table}: ${error.message}`);
    else if ((data ?? []).length) console.log(`  (cleanup) removed ${(data ?? []).length} ${e.label} row(s) created by this run`);
  }

  // Restore the About page exactly as it was — including deleting the row when
  // it did not exist before, which is the case here.
  if (aboutBefore) {
    await db.from("site_settings").update({ value: aboutBefore.value, description: aboutBefore.description, updated_by: aboutBefore.updated_by }).eq("key", aboutKey);
    console.log("  (cleanup) About page restored to its previous value");
  } else {
    const { error } = await db.from("site_settings").delete().eq("key", aboutKey);
    console.log(error
      ? `  cleanup FAILED to remove the About row: ${error.message}`
      : "  (cleanup) About row removed — it did not exist before this run");
  }
  await browser.close().catch(() => {});

  for (const e of ENTITIES) {
    const now = (await db.from(e.table).select("id", { count: "exact", head: true })).count;
    check(`no ${e.table} rows leaked`, now === beforeCounts[e.table], `${beforeCounts[e.table]} -> ${now}`);
  }
  const { data: aboutAfter } = await must(
    db.from("site_settings").select("key, value").eq("key", aboutKey).maybeSingle(),
    "about after cleanup",
  );
  check("the About page is exactly as it was found",
    JSON.stringify(aboutAfter ?? null) === JSON.stringify(aboutBefore ?? null),
    aboutBefore ? "restored" : "row absent again");

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("\nFAILURES:");
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }

  // Evidence, written by the exercise itself, after the last `process.exitCode`
  // assignment because `writeEvidence` derives the verdict from it.
  // See `scripts/audit/lib/evidence.mjs`.
  try {
    const { file } = writeEvidence({
      id: "cms",
      script: "scripts/audit/qa-exercise-cms-workflow.mjs",
      claim: "the CMS end to end across all six content types plus the About page: create, edit, publish, archive, and the absence of any delete action",
      base: BASE,
      checks: results,
      exitCode: process.exitCode ?? 0,
      extra: {
        // The rows this run created, and the About page's key and before/after
        // value. `createdIds` is what the service-role cleanup deletes, so it is
        // the one thing a reader needs to check the cleanup against.
        createdIds,
        publicAbout: { key: aboutKey, before: aboutBefore, after: aboutAfter },
      },
    });
    console.log(`wrote ${file}`);
  } catch (err) {
    console.error(
      "could not write evidence:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

void createdIds;