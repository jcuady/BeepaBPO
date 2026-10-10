// Exercise the notification domain: mark one read, mark them all read, and change
// the delivery preferences.
//
// WHY: three actions in lib/notifications/actions.ts, never driven through a browser.
//
// THE HAZARD THIS RUN IS BUILT AROUND
//
// `markAllRead` updates EVERY notification the signed-in user owns. A QA run that
// clicks it and deletes its own rows afterwards has still quietly marked every other
// notification in the demo account read -- and nothing would report it. So this run
// snapshots `read_at` for every notification the user owns BEFORE touching anything,
// and restores each value afterwards, rather than deleting a diff.
//
// `markNotificationRead` carries a real guard worth watching: `.eq("user_id", me)` and
// `.is("read_at", null)`. A second notification belonging to somebody else is created
// deliberately, so "mark all read" has something it must NOT reach.
//
// SAFETY: rows created here are deleted in a `finally`; the restoration is asserted
// by reading the rows back and comparing against the snapshot, not by trusting the
// number of updates issued.
//
// Usage: node scripts/audit/qa-exercise-notifications-workflow.mjs

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
const notes = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};
const note = (m) => { notes.push(m); console.log(`NOTE  ${m}`); };
async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

const MARK = `qanotif${Date.now().toString(36)}`;

// Pick the demo user who owns the most notifications: the run then has real pre-existing
// state to snapshot and restore, which is the whole point.
// `must()` returns the rows themselves, so this must NOT be destructured as
// `{ data }` -- doing so silently yields undefined and the next line throws
// "not iterable" a long way from the mistake.
const owned = await must(db.from("notifications").select("user_id").limit(5000), "notifications");
const byUser = new Map();
for (const r of owned) byUser.set(r.user_id, (byUser.get(r.user_id) ?? 0) + 1);
const topUser = [...byUser.entries()].sort((a, b) => b[1] - a[1])[0];
if (!topUser) throw new Error("no notifications in the database");
const TEST_USER_ID = topUser[0];

const { data: authData, error: authErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
if (authErr) throw new Error(`auth users: ${authErr.message}`);
const authUser = authData.users.find((u) => u.id === TEST_USER_ID);
if (!authUser?.email) throw new Error(`no auth user for profile ${TEST_USER_ID}`);
const TEST_EMAIL = authUser.email;

// Somebody else's notification, so the ownership guard has something to refuse.
const otherUser = (await must(
  db.from("notifications").select("user_id").neq("user_id", TEST_USER_ID).limit(1),
  "other user notification",
))[0];
if (!otherUser) throw new Error("need a notification owned by a second user for the ownership check");

console.log(`subject user: ${TEST_EMAIL} (${TEST_USER_ID.slice(0, 8)}) with ${topUser[1]} notification(s)`);
console.log(`other user:   ${otherUser.user_id.slice(0, 8)}\n`);

// ---- snapshot BEFORE any write -------------------------------------------------
const snapNotifications = new Map();
for (const n of await must(
  db.from("notifications").select("id, read_at").eq("user_id", TEST_USER_ID),
  "snapshot notifications",
)) {
  snapNotifications.set(n.id, n.read_at ?? null);
}
const prefBefore = (
  await must(
    db.from("notification_preferences").select("*").eq("user_id", TEST_USER_ID).limit(1),
    "snapshot preferences",
  )
)[0] ?? null;

console.log(
  `snapshot: ${snapNotifications.size} notification read_at value(s) remembered; ` +
    `preferences ${prefBefore ? "exist" : "do not exist"}\n`,
);

const createdIds = new Set();
const browser = await chromium.launch();

const countOf = async (table) =>
  (await db.from(table).select("id", { count: "exact", head: true })).count ?? 0;
const beforeCount = await countOf("notifications");

async function signIn(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const field = page.locator("input[name=email], input[type=email]").first();
  await field.waitFor({ state: "visible", timeout: 20000 });
  await field.fill(email);
  await page.locator("input[type=password]").first().fill(env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
}

const readAtOf = async (id) =>
  (await must(db.from("notifications").select("read_at").eq("id", id).limit(1), "read lookup"))[0]?.read_at ?? null;

try {
  // Three unread notifications for the subject user, one for somebody else.
  const mine = await must(
    db
      .from("notifications")
      .insert([
        { user_id: TEST_USER_ID, type: "test.qa", title: `${MARK} alpha`, body: `QA notification alpha ${MARK}` },
        { user_id: TEST_USER_ID, type: "test.qa", title: `${MARK} bravo`, body: `QA notification bravo ${MARK}` },
        { user_id: TEST_USER_ID, type: "test.qa", title: `${MARK} charlie`, body: `QA notification charlie ${MARK}` },
      ])
      .select("id, title"),
    "create notifications",
  );
  for (const n of mine) createdIds.add(n.id);

  const theirs = (
    await must(
      db
        .from("notifications")
        .insert({
          user_id: otherUser.user_id,
          type: "test.qa",
          title: `${MARK} not yours`,
          body: `QA notification belonging to another user ${MARK}`,
        })
        .select("id"),
      "create other notification",
    )
  )[0];
  createdIds.add(theirs.id);
  const otherBefore = await readAtOf(theirs.id);
  check("the other user's notification starts unread", otherBefore === null, String(otherBefore));

  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await signIn(page, TEST_EMAIL);
  await page.goto(`${BASE}/app/my/notifications`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);

  check(
    "the page renders the QA notifications",
    await page.getByText(`${MARK} alpha`).first().isVisible(),
  );
  check(
    "another user's notification is not shown",
    (await page.getByText(`${MARK} not yours`).count()) === 0,
  );
  check("unread rows are marked Unread", (await page.getByText(/· Unread/).count()) >= 3);

  // ------------------------------------------------------- markNotificationRead
  await page.getByText(`${MARK} alpha`).first().click();
  await page.waitForTimeout(2500);

  const alpha = mine.find((n) => n.title.endsWith("alpha"));
  const bravo = mine.find((n) => n.title.endsWith("bravo"));
  check("markNotificationRead sets read_at", (await readAtOf(alpha.id)) !== null, String(await readAtOf(alpha.id)));
  check("markNotificationRead leaves other notifications alone", (await readAtOf(bravo.id)) === null);

  // ------------------------------------------------------------------ markAllRead
  const markAll = page.getByRole("button", { name: "Mark all read" });
  check("the Mark all read button appears while something is unread", await markAll.isVisible());
  await markAll.click();
  await page.waitForTimeout(2500);

  const afterAll = await must(
    db.from("notifications").select("id, read_at").eq("user_id", TEST_USER_ID),
    "read all back",
  );
  const stillUnread = afterAll.filter((n) => n.read_at === null);
  check("markAllRead marks every one of the user's notifications read", stillUnread.length === 0, `${stillUnread.length} still unread`);

  check(
    "markAllRead does not touch another user's notification",
    (await readAtOf(theirs.id)) === null,
    String(await readAtOf(theirs.id)),
  );

  const unreadLabels = await page.getByText(/· Unread/).count();
  check("the page shows no unread rows afterwards", unreadLabels === 0, `${unreadLabels} left`);

  // ----------------------------------------------- updateNotificationPreferences
  const emailToggle = page.getByRole("switch", { name: "Email digests" });
  const toggleExists = await emailToggle.count();
  check("the email digest preference toggle is present", toggleExists === 1, `${toggleExists}`);

  if (toggleExists === 1) {
    const before = await emailToggle.getAttribute("aria-checked");
    await emailToggle.click();
    await page.waitForTimeout(2500);

    const prefRow = (
      await must(
        db.from("notification_preferences").select("*").eq("user_id", TEST_USER_ID).limit(1),
        "preference lookup",
      )
    )[0] ?? null;
    check("updateNotificationPreferences persists a row", prefRow !== null);

    const wasEnabled = before === "true";
    const wantAfter = !wasEnabled;
    check(
      "the persisted value matches the toggle the user left",
      prefRow?.email_enabled === wantAfter,
      `was ${before}, stored ${String(prefRow?.email_enabled)}`,
    );

    // Put it back through the UI so the UI path is exercised both ways.
    await emailToggle.click();
    await page.waitForTimeout(2500);
    const restored = (
      await must(
        db.from("notification_preferences").select("email_enabled").eq("user_id", TEST_USER_ID).limit(1),
        "preference recheck",
      )
    )[0];
    check(
      "toggling back writes the original value",
      restored?.email_enabled === wasEnabled,
      // Compare booleans: `aria-checked` hands back the string "true", the column
      // holds a boolean, and `"true" === true` fails while printing two identical
      // values -- a failure that looks like a product bug and is not.
      `expected ${wasEnabled}, stored ${String(restored?.email_enabled)}`,
    );
  }

  const realErrors = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
  check("no unexpected console errors", realErrors.length === 0, realErrors.slice(0, 2).join(" | "));
  check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));

  await context.close();
  await browser.close().catch(() => {});
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  results.push({ name: "run completed without throwing", pass: false });
} finally {
  // Remove the rows this run created.
  for (const id of createdIds) {
    await db.from("notifications").delete().eq("id", id);
  }

  // Restore every read_at the run may have moved. Compared against the snapshot, not
  // against a remembered id list, so a row this run did not know about still gets put
  // back.
  let restoredCount = 0;
  for (const [id, readAt] of snapNotifications.entries()) {
    const now = await readAtOf(id);
    if (now === readAt) continue;
    const { error } = await db.from("notifications").update({ read_at: readAt }).eq("id", id);
    if (!error) restoredCount += 1;
  }
  console.log(`\n(cleanup) restored ${restoredCount} read_at value(s) that had moved`);

  // Preferences: put the row back exactly as it was, including its absence.
  if (prefBefore) {
    await db.from("notification_preferences").update(prefBefore).eq("user_id", TEST_USER_ID);
  } else {
    await db.from("notification_preferences").delete().eq("user_id", TEST_USER_ID);
  }

  const leftOver = await must(
    db.from("notifications").select("id").ilike("title", `%${MARK}%`),
    "leftover check",
  );
  console.log(`(cleanup) notifications still carrying the marker: ${leftOver.length}`);

  // Assert the restoration by reading rows back.
  let mismatched = 0;
  for (const [id, readAt] of snapNotifications.entries()) {
    if ((await readAtOf(id)) !== readAt) mismatched += 1;
  }
  console.log(`(cleanup) read_at values that do not match the snapshot: ${mismatched}`);

  const restored =
    leftOver.length === 0 && mismatched === 0 && (await countOf("notifications")) === beforeCount;
  console.log(`the sweep left the demo data as it found it: ${restored ? "yes" : "NO"}`);
  if (!restored) process.exitCode = 1;

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} assertions passed`);
  if (passed !== results.length) process.exitCode = 1;
  if (notes.length) {
    console.log("\nnotes:");
    for (const n of notes) console.log(`  - ${n}`);
  }
}