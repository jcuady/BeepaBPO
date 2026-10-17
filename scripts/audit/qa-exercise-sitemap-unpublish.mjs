// Does archiving a published article actually remove it from the public sitemap?
//
// WHY THIS EXISTS
// `/sitemap.xml` is a metadata route that Next prerenders at BUILD time (the build log
// marks it `(Static)`), and `revalidateCmsPublic()` in lib/cms/actions.ts
// revalidates seven paths -- `/app/cms`, `/resources`, `/services`, `/about`,
// `/contact`, `/case-studies` -- and NOT `/sitemap.xml`. So the sitemap's notion of
// "published" is frozen at the last deploy, while every other public surface re-queries
// live.
//
// The prediction, stated before running anything: archiving an article makes its
// public URL 404 and drops it from the index, but the sitemap keeps advertising a URL
// that now returns 404, until the next deploy.
//
// WHAT IS ACTUALLY BEING TESTED, and why it needs a rebuild
// The sitemap only contains a URL if it was published WHEN THE BUILD RAN. Proving the
// staleness therefore requires the article to pass through a build while published.
// The run does that itself: it publishes the article, rebuilds and restarts, CONFIRMS
// the article is in the sitemap (a positive control -- without it the test is
// ungrounded and proves nothing), archives the article through the real CMS action,
// and then measures the three public surfaces.
//
// SAFETY
// Only QA-marked content is created, and it is deleted in the finally block. No
// existing demo row is touched. The server is stopped before every `next build` and
// started again afterwards, because a build must never run while `next start` holds
// the port. A final rebuild restores the sitemap to the real content, so the run
// leaves no trace even in the build output.
//
// Usage: node scripts/audit/qa-exercise-sitemap-unpublish.mjs

import { readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { fillHeld } from "./lib/browser-form.mjs";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  const q = String.fromCharCode(39);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith(q) && v.endsWith(q))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const PORT = Number(BASE.split(":").pop()) || 3100;
const CMS_EMAIL = "marketing@demo.beepabpo.com"; // the only demo role holding cms.manage
const MARK = `qasm${Date.now().toString(36)}`;
const SLUG = `qa-sitemap-${MARK}`;
const TITLE = `QA Sitemap Article ${MARK}`;

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  - ${detail}` : ""}`);
}
function note(m) { console.log(`NOTE  ${m}`); }

async function must(p, what) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data ?? [];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** What does /sitemap.xml currently advertise? */
async function sitemapHas(pathname, page) {
  const res = await page.request.get(`${BASE}/sitemap.xml`);
  if (!res.ok()) throw new Error(`sitemap.xml returned ${res.status()}`);
  const xml = await res.text();
  return xml.includes(`<loc>`) && xml.includes(pathname);
}

function portOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" }, () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    setTimeout(() => { s.destroy(); resolve(false); }, 1500);
  });
}

/** The PID currently holding the port, or null. */
function portPid() {
  if (process.platform !== "win32") return null;
  const ps = spawnSync("powershell.exe", ["-NoProfile", "-Command",
    `(Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess`],
    { encoding: "utf8" });
  const pid = (ps.stdout ?? "").trim();
  return pid || null;
}

/**
 * Stop whatever holds the port and PROVE it released it.
 *
 * This matters more than it looks. If the old server is still holding the port when
 * `next start` runs, the new one fails to bind, exits, and the OLD build keeps serving
 * — so a measurement taken after a "rebuild" is really a measurement of the build from
 * before. That produced a wrong answer on the first attempt of this script: the fresh
 * sitemap appeared not to contain an article that had been published before the build.
 * Returning the pid before the kill, and asserting a DIFFERENT pid afterwards, turns a
 * silent stale-build measurement into a hard failure.
 */
async function stopServer() {
  const before = portPid();
  if (!before) return { wasOpen: false, closed: true };
  spawnSync("taskkill", ["/PID", before, "/F"], { encoding: "utf8" });
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    if (!portPid()) return { wasOpen: true, closed: true, pid: before };
  }
  return { wasOpen: true, closed: false, pid: before };
}

async function startServer() {
  // spawn, NOT spawnSync. spawnSync blocks until the child EXITS, and `detached`
  // does not change that -- the first version of this script hung here forever
  // because a server that is supposed to keep running never returns from a
  // synchronous spawn.
  spawn("npx.cmd", ["next", "start", "-p", String(PORT)], {
    cwd: process.cwd(), detached: true, stdio: "ignore", shell: true,
  }).unref();
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    if (await portOpen(PORT)) return true;
  }
  return false;
}

/** Build, stopping the server first. Asserts the new server is genuinely new. */
async function rebuild(why) {
  note(`${why}: stopping the server before building`);
  const stopped = await stopServer();
  if (!stopped.closed) throw new Error(`the old server (pid ${stopped.pid}) still holds port ${PORT}; a rebuild would silently keep serving the old build`);

  const r = spawnSync("npx.cmd", ["next", "build"], { cwd: process.cwd(), encoding: "utf8", shell: true });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const staticLine = out.split(/\r?\n/).find((l) => /\/sitemap\.xml/.test(l)) ?? "";
  note(`build finished (exit ${r.status}); sitemap line: ${staticLine.trim() || "not printed"}`);
  if (r.status !== 0) throw new Error(`next build failed with exit ${r.status}`);

  const up = await startServer();
  note(`server restarted: ${up ? "yes" : "NO"}`);
  if (!up) throw new Error(`the server did not come back up on ${PORT}`);

  const after = portPid();
  if (stopped.wasOpen && after && after === stopped.pid) {
    throw new Error(`pid ${after} is serving after the rebuild — this is the old server, not the new build`);
  }
  note(`serving pid ${after ?? "unknown"} (previous build's server was ${stopped.pid ?? "none"})`);
  return { ok: true, isStatic: /\(Static\)|\u25CB/.test(staticLine), buildOutput: out };
}

let browser = null;
try {
  // This run stops and starts the server twice, so it cannot assume one was already
  // up when it began. The first version died immediately with ERR_CONNECTION_REFUSED
  // because a previous cancelled run had left the port closed.
  if (!(await portOpen(PORT))) {
    note(`nothing listening on ${PORT}; starting the server`);
    if (!(await startServer())) throw new Error(`could not start the server on ${PORT}`);
  }

  browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // ---- sign in as the only role that can reach the CMS page.
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(page, page.locator("input[type=email]").first(), CMS_EMAIL);
  await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded");
  if (page.url().includes("/login")) throw new Error(`${CMS_EMAIL} could not sign in`);

  // ---- create the article
  await page.goto(`${BASE}/app/cms`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const fields = { title: TITLE, slug: SLUG, excerpt: `QA excerpt ${MARK}`, body: `QA body ${MARK}.` };
  for (const [name, value] of Object.entries(fields)) {
    await page.locator(`#blog-${name}`).fill(value);
  }
  await page.locator("#blog-title").locator("xpath=ancestor::form").first()
    .getByRole("button", { name: /save draft/i }).click();
  await page.waitForTimeout(4000);

  const created = (await must(
    db.from("blog_posts").select("id, slug, status").eq("slug", SLUG).limit(1),
    "created post",
  ))[0];
  check("the article is created", Boolean(created), created?.id.slice(0, 8) ?? "no row");
  if (!created) throw new Error("cannot continue without the article");

  // ---- publish it through the real action
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const row = page.locator("tr").filter({ hasText: TITLE }).first();
  const publish = row.getByRole("button", { name: /^Publish$/ });
  check("a Publish control exists on its row", (await publish.count()) > 0);
  await publish.first().click();
  await page.waitForTimeout(1200);
  // ConfirmDialog: the button is not the action.
  const confirm = page.locator("[role=dialog]").getByRole("button", { name: /^Publish$/ }).last();
  if (await confirm.count()) await confirm.click();
  await page.waitForTimeout(4000);
  const published = (await must(
    db.from("blog_posts").select("status").eq("id", created.id).limit(1), "after publish",
  ))[0];
  check("publishing moves it to published", published?.status === "published", `status=${published?.status}`);

  // ---- THE CONTRACT: publishing makes a URL discoverable, with no deploy.
  //
  // This used to assert the opposite. It baselined the sitemap BEFORE
  // publication, required it to be absent ("build-frozen"), then rebuilt and
  // required it to be present -- a pair of assertions that only pass while the
  // sitemap is baked at build time.
  //
  // Baking it was the defect: `app/sitemap.ts` carried no directive, so
  // `/sitemap.xml` was prerendered and served `x-nextjs-cache: HIT` forever. A
  // newly published article could not reach search engines until someone
  // happened to deploy. `revalidate = 3600` did not fix it either -- ISR still
  // served the pre-publication document for up to an hour. It is now
  // `force-dynamic`, and the guarantee is the useful one: publish, and the URL
  // is in the sitemap on the very next request.
  //
  // The rebuild that used to sit between these two assertions is gone, because
  // requiring it is requiring the bug.
  const inSitemapAfterPublish = await sitemapHas(`/resources/${SLUG}`, page);
  check(
    "*** a published article is in the sitemap WITHOUT a rebuild ***",
    inSitemapAfterPublish === true,
    inSitemapAfterPublish
      ? "present on the next request - the sitemap is generated per request"
      : "ABSENT - publishing does not currently make content discoverable",
  );
  if (!inSitemapAfterPublish) throw new Error("positive control failed; the rest of the run would be ungrounded");

  // While published, all three surfaces must agree.
  const liveBefore = await page.request.get(`${BASE}/resources/${SLUG}`);
  const indexBefore = await (await page.request.get(`${BASE}/resources`)).text();
  check("while published, the article URL resolves", liveBefore.status() === 200, `HTTP ${liveBefore.status()}`);
  check("while published, the index lists it", indexBefore.includes(SLUG));

  // ---- ARCHIVE it through the real CMS action.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await admin.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await admin.locator("input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
  await fillHeld(admin, admin.locator("input[type=email]").first(), CMS_EMAIL);
  await fillHeld(admin, admin.locator("input[type=password]").first(), env.DEMO_PASSWORD);
  await admin.click("button[type=submit]");
  await admin.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
  await admin.goto(`${BASE}/app/cms`, { waitUntil: "domcontentloaded" });
  await admin.waitForTimeout(3000);
  const row2 = admin.locator("tr").filter({ hasText: TITLE }).first();
  const archive = row2.getByRole("button", { name: /^Archive$/ });
  check("an Archive control exists on its row", (await archive.count()) > 0);
  await archive.first().click();
  await admin.waitForTimeout(1200);
  const confirmA = admin.locator("[role=dialog]").getByRole("button", { name: /^Archive$/ }).last();
  if (await confirmA.count()) await confirmA.click();
  await admin.waitForTimeout(4000);
  const archived = (await must(
    db.from("blog_posts").select("status").eq("id", created.id).limit(1), "after archive",
  ))[0];
  check("archiving moves it to archived", archived?.status === "archived", `status=${archived?.status}`);
  await adminCtx.close();

  // ---- measure the three public surfaces AFTER archiving, with NO rebuild.
  const liveAfter = await page.request.get(`${BASE}/resources/${SLUG}`);
  const indexAfter = await (await page.request.get(`${BASE}/resources`)).text();
  const sitemapAfter = await sitemapHas(`/resources/${SLUG}`, page);

  check("after archiving, the article URL no longer resolves", liveAfter.status() === 404, `HTTP ${liveAfter.status()}`);
  check("after archiving, the index no longer lists it", !indexAfter.includes(SLUG));
  check(
    "*** after archiving, the sitemap no longer advertises it ***",
    sitemapAfter === false,
    sitemapAfter
      ? "STILL LISTED - /sitemap.xml advertises a URL that now returns 404, and revalidateCmsPublic() never touches it"
      : "correctly dropped",
  );

  // Pin the mechanism, so the finding is not just an observation.
  const cmsSrc = readFileSync("lib/cms/actions.ts", "utf8");
  const block = cmsSrc.match(/function revalidateCmsPublic\(\)[\s\S]*?\n}/)?.[0] ?? "";
  check(
    "revalidateCmsPublic() does not include /sitemap.xml, which is why",
    !block.includes("/sitemap.xml") && block.includes("/resources"),
    block.replace(/\s+/g, " ").slice(0, 150),
  );

  await ctx.close();
} catch (e) {
  console.error(`\nRUN ERROR: ${e.message}`);
  process.exitCode = 1;
} finally {
  // Remove the QA row, then read the live sitemap back.
  //
  // This used to rebuild so that "even the generated sitemap forgets them",
  // because the sitemap was baked at build time and could not forget anything
  // on its own. It is `force-dynamic` now, so the next request already reflects
  // the deletion — which makes this a stronger check than the one it replaced:
  // it reads the document a crawler would actually receive, without a deploy
  // in between.
  const { error: delErr } = await db.from("blog_posts").delete().eq("slug", SLUG);
  note(`cleanup: ${delErr ? `FAILED - ${delErr.message}` : "QA article deleted"}`);
  const { data: leftover } = await db.from("blog_posts").select("id, slug").like("slug", `%${MARK}%`);
  note(`rows still carrying the marker: ${leftover?.length ?? 0}`);

  if (browser) await browser.close().catch(() => {});
  const probe = await fetch(`${BASE}/sitemap.xml`).then((r) => r.text()).catch(() => "");
  note(`the live sitemap still mentions the QA article: ${probe.includes(SLUG)}`);
  note(`the real articles are still listed: ${probe.includes("/resources/")}`);
}

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} assertions passed`);
process.exitCode = passed === results.length ? 0 : 1;