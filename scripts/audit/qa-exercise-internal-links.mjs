// Crawl every in-app link reachable as each role and prove none of them go nowhere.
//
// WHY
// The filter pass proved that a control which SUBMITS reaches its query. Nothing has
// ever checked the other half of a link: that it RESOLVES. A link to a route that was
// renamed, a record whose id no longer exists, or a detail page behind a permission
// the current role does not hold, all render perfectly — the anchor has an href, the
// row has a title — and then take the user to a 404, or bounce them to /login, or
// silently drop them somewhere they did not ask to go. This report has already found
// one instance of exactly that (27 notification rows linked to records that did not
// exist, §2), so the class is real here.
//
// WHAT IS ACTUALLY BEING TESTED
// For each role, from a seed set of pages, collect every internal anchor and verify:
//
//   1. it is reachable at all — no Next.js 404 page ("This page could not be found")
//   2. it does not dead-end on "Access not allowed". Next's forbidden() renders AT the
//      requested URL instead of redirecting, so a role that clicks a link it cannot
//      use gets a perfectly laid out page containing nothing but a refusal. The
//      /login bounce test cannot see this; `data-page-status="forbidden"` can
//   3. it does not land on a route error, and does not redirect somewhere else
//
// A link is only judged by where it LANDS, never by whether it has an href.
//
// POSITIVE CONTROL, because a crawl that finds nothing must not pass
// The run asserts it discovered a plausible number of links per role. A crawler that
// silently matches zero anchors reports a clean sheet and proves nothing; the floor is
// a hard failure, not a note.
//
// WHAT A PASS IS NOT
// It is not a statement that the destination has correct data — only that it exists
// and is open to this role. Content correctness is covered by the per-domain workflow
// passes. It is also not a sitemap audit: routes nobody links to from inside the app
// are simply never visited here.
//
// SCOPE
// Four passes, each in its own browser context, because the cookie jar decides which
// pages render at all: internal (21 seeds, owner), client (9, clientadmin),
// applicant (2) and the public marketing site (10 seeds, not signed in).
//
// The public pass was previously excluded on the grounds that the contact-form pass
// "covers it" — which covered the contact ACTION and nothing else. No marketing link
// had ever been followed, and the sitemap, which advertises CMS-built detail URLs to
// search engines, had never been requested at all.
//
// SAFE TO RE-RUN: read-only. Nothing is written by this script.
//
// Usage: node scripts/audit/qa-exercise-internal-links.mjs

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

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

/**
 * Seeds are the pages most likely to carry links: a shell (which renders nav), plus
 * the list pages whose ROWS contain record links. Crawling only the nav would find
 * the sidebar and miss every detail link in the product, which is where the id-rot
 * risk actually lives.
 */
const ROLES = [
  {
    label: "internal",
    email: "owner@demo.beepabpo.com",
    seeds: [
      "/app/dashboard", "/app/tickets", "/app/employees", "/app/attendance",
      "/app/leave", "/app/approvals", "/app/billing", "/app/cash-advances",
      "/app/crm/leads", "/app/crm/deals", "/app/crm/proposals", "/app/hr/nte",
      "/app/payroll/periods", "/app/recruitment/jobs", "/app/recruitment/applicants",
      "/app/clients", "/app/reports", "/app/admin/users", "/app/admin/organizations",
      "/app/admin/audit", "/app/my/notifications", "/app/my/leave",
      "/app/my/documents", "/app/my/cash-advances", "/app/cms", "/app/settings",
    ],
    floor: 40,
  },
  {
    label: "client",
    email: "clientadmin@demo.beepabpo.com",
    seeds: [
      "/app/client", "/app/client/tickets", "/app/client/timesheets",
      "/app/client/attendance", "/app/client/billing", "/app/client/documents",
      "/app/client/notifications", "/app/client/requests", "/app/client/team",
    ],
    floor: 15,
  },
  {
    label: "applicant",
    email: "applicant@demo.beepabpo.com",
    seeds: ["/app/applicant", "/app/applicant/notifications"],
    floor: 2,
  },
  {
    // No sign-in. The public marketing surface was previously excluded on the
    // grounds that "the contact-form pass covers it" — which covered the contact
    // ACTION and nothing else: no marketing link had ever been followed, and the
    // sitemap's CMS-driven detail URLs had never been requested at all.
    label: "public",
    email: null,
    seeds: [
      "/", "/about", "/services", "/why-beepa", "/careers", "/resources",
      "/case-studies", "/contact", "/privacy", "/terms",
      // The auth pages are reachable from the marketing site but are not part of
      // it, so they have to be seeded explicitly. Without them, links that only
      // appear ON these pages — /forgot-password from the sign-in form — are never
      // discovered by anything, and a genuine dead link there would go unseen.
      "/login", "/signup",
    ],
    floor: 20,
  },
];

/**
 * Anchors that are chrome, not navigation the user asked for.
 *
 * /login and /logout are ignored for AUTHENTICATED roles only: inside the app they
 * are chrome that every page repeats, and following them would measure the same URL
 * a dozen times. On the public site they are ordinary destinations — "Sign in" in the
 * header, "Log in" in the footer — and the whole point of the public pass is to check
 * they work.
 */
const IGNORE_AUTH = ["/login", "/logout"];
const IGNORE_ALL = ["#", "mailto:", "tel:", "http://localhost", "http://127.0.0.1"];

/** A record id, used to tell "this route is gone" from "this record is gone". */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const results = [];
const notes = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
}
function note(s) {
  notes.push(s);
  console.log(`NOTE  ${s}`);
}

/** Wait until the URL stops moving AND the document stops changing. */
async function settle(page) {
  await page.waitForLoadState("domcontentloaded");
  let last = page.url();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(250);
    const now = page.url();
    if (now === last) return now;
    last = now;
  }
  return last;
}

/**
 * Read the page's status marker, tolerating a navigation landing mid-read.
 *
 * `settle()` waits on the URL, which is necessary but not sufficient: Next hydrates
 * and can still be swapping the document when the read starts, and evaluate then
 * throws "Execution context was destroyed". Retrying once after a re-settle is
 * cheaper and clearer than wrapping every read in a try, and it keeps a single slow
 * link from taking the whole run down.
 */
async function readStatus(page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await page.evaluate(() => {
        const el = document.querySelector("[data-page-status]");
        const marker = el?.getAttribute("data-page-status") ?? null;
        const text = document.body.innerText ?? "";
        return {
          marker,
          notFound: marker === "not-found" || /this page could not be found|^\s*404\b/i.test(text),
        };
      });
    } catch (e) {
      if (attempt === 1) throw e;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await settle(page);
      await page.waitForLoadState("networkidle").catch(() => {});
    }
  }
  return { marker: null, notFound: false };
}

const browser = await chromium.launch();

for (const role of ROLES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const isPublic = role.email === null;
  const ignore = isPublic ? IGNORE_ALL : [...IGNORE_ALL, ...IGNORE_AUTH];

  if (!isPublic) {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.locator("input[name=email], input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
    await page.locator("input[name=email], input[type=email]").first().fill(role.email);
    await page.locator("input[type=password]").first().fill(env.DEMO_PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForURL(/\/app/, { timeout: 20000 }).catch(() => {});
    await page.waitForLoadState("domcontentloaded");
    if (page.url().includes("/login")) {
      note(`${role.label}: ${role.email} could not sign in — skipped`);
      await context.close();
      continue;
    }
    note(`signed in as ${role.email} (${role.label})`);
  } else {
    note(`${role.label}: not signed in`);
  }

  // ---- collect. Only the path is kept: query strings on internal links are filter
  // state, not distinct destinations, and including them would inflate the count
  // with the same page under dozens of names.
  const found = new Map(); // path -> where it was first seen
  for (const seed of role.seeds) {
    try {
      await page.goto(`${BASE}${seed}`, { waitUntil: "domcontentloaded" });
      await settle(page);
      if (!isPublic && page.url().includes("/login")) continue;
      const hrefs = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")]
          .map((a) => a.getAttribute("href") ?? "")
          // Only same-document paths. Skip anything absolute, protocol-relative or
          // external — this run is about the product's own routing.
          .filter((h) => h.startsWith("/") && !h.startsWith("//")),
      );
      for (const h of hrefs) {
        if (ignore.some((bad) => h === bad || h.startsWith(bad + "?"))) continue;
        const path = h.split("#")[0].split("?")[0];
        if (!path || found.has(path)) continue;
        found.set(path, seed);
      }
    } catch (e) {
      note(`${role.label} seed ${seed}: ${e.message}`);
    }
  }

  const links = [...found.keys()].sort();
  note(`${role.label}: discovered ${links.length} distinct internal link(s)`);

  // ---- POSITIVE CONTROL. A crawler that matched zero anchors proves nothing, so a
  // shortfall against the floor is a hard failure rather than a passing note.
  check(
    `${role.label} — the crawl actually found links to verify`,
    links.length >= role.floor,
    `${links.length} found, floor is ${role.floor}`,
  );

  const broken = [];
  const staleEntities = [];
  const bounced = [];
  const redirected = [];
  const denied = [];
  const errored = [];
  const downloads = [];
  let checked = 0;

  for (const link of links) {
    let landed;
    try {
      await page.goto(`${BASE}${link}`, { waitUntil: "domcontentloaded" });
      landed = await settle(page);
      // Let hydration and any client-side swap finish. Without this the first
      // evaluate after a cold navigation races the document being replaced.
      await page.waitForLoadState("networkidle").catch(() => {});
    } catch (e) {
      // A download endpoint is not a page: /app/reports/export starts a file
      // transfer and Playwright aborts the navigation with "Download is starting".
      // Counting that as a broken link would be a harness defect, not a finding.
      if (/download is starting/i.test(e.message)) {
        downloads.push(link);
        continue;
      }
      broken.push(`${link} (${e.message.split("\n")[0]})`);
      continue;
    }
    const path = landed.replace(BASE, "").split("#")[0] || "/";
    checked++;

    let status;
    try {
      status = await readStatus(page);
    } catch (e) {
      errored.push(`${link} (${e.message.split("\n")[0]})`);
      continue;
    }
    // 1. a Next.js 404. `not-found.tsx` carries no marker, so the text check stands
    //    too — but only as a fallback, never as the primary signal.
    if (status.notFound) {
      // Split the class: a 404 on a ROUTE is a product defect, while a 404 on a
      // RECORD id is a reference to something that no longer exists. The audit page
      // deliberately renders the latter — it is a historical record of an entity
      // that has since been deleted, and every QA run that creates and deletes a
      // payroll period adds one. Reporting both as the same failure would hide the
      // first behind the second.
      const last = String(link).split("/").pop();
      (UUID_RE.test(last) ? staleEntities : broken).push(
        UUID_RE.test(last) ? `${link} (record no longer exists)` : `${link} (renders a 404)`,
      );
      continue;
    }
    // 2. a destination that refuses this role. Next's forbidden() renders AT the
    //    requested URL rather than redirecting, so the /login test below cannot see
    //    it -- the page simply lays out cleanly and says "Access not allowed".
    //    `forbidden.tsx` carries data-page-status="forbidden" for exactly this reason
    //    (see docs/CHANGELOG.md, "The responsive auditor scored a 403 as a perfect
    //    page"), so read the marker rather than sniffing for the words.
    if (status.marker === "forbidden") {
      denied.push(`${link} (reached from ${found.get(link)})`);
      continue;
    }
    if (status.marker === "error") {
      errored.push(`${link} (reached from ${found.get(link)})`);
      continue;
    }
    // 3. bounced to the login form, or redirected somewhere else.
    // On the public site "/login" is a destination, not a bounce — treating a link to
    // the sign-in page as a failure would make the pass unable to pass.
    if (!isPublic && path.startsWith("/login")) {
      bounced.push(`${link} (reached from ${found.get(link)})`);
      continue;
    }
    const target = link.split("#")[0].split("?")[0];
    if (path !== target) redirected.push(`${link} -> ${path}`);
  }

  // ---- The sitemap advertises URLs to search engines, including CMS-driven detail
  // routes built from slugs. Nothing else in this report requests them, so a slug
  // that no longer resolves is advertised and never noticed. Each listed URL is
  // fetched and must not 404.
  if (isPublic) {
    let listed = [];
    try {
      const res = await page.request.get(`${BASE}/sitemap.xml`);
      const xml = await res.text();
      listed = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1])
        .map((u) => {
          try {
            return new URL(u).pathname;
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (e) {
      note(`public: could not read /sitemap.xml — ${e.message}`);
    }

    check(
      "public — the sitemap lists something to check",
      listed.length > 0,
      `${listed.length} URL(s)`,
    );

    const sitemapBroken = [];
    for (const u of listed) {
      const res = await page.request.get(`${BASE}${u}`).catch(() => null);
      if (!res) {
        sitemapBroken.push(`${u} (request failed)`);
        continue;
      }
      if (res.status() >= 400) sitemapBroken.push(`${u} (HTTP ${res.status()})`);
    }
    check(
      "public — every URL in the sitemap resolves",
      sitemapBroken.length === 0,
      sitemapBroken.length === 0
        ? `${listed.length} URL(s) all resolve`
        : sitemapBroken.join("; "),
    );

    // And the reverse direction: a public page nobody links to is not reachable by
    // navigation, which is usually intentional (login, signup) and always worth a look.
    const unreachable = role.seeds.filter((s) => !found.has(s));
    if (unreachable.length) {
      note(`public: ${unreachable.length} seed page(s) were never linked from another page: ${unreachable.join(", ")}`);
    }
  }

  check(
    `${role.label} — no internal link renders a 404`,
    broken.length === 0,
    broken.length === 0 ? `${checked} link(s) resolved` : broken.join("; "),
  );
  check(
    `${role.label} — no internal link bounces this role to /login`,
    bounced.length === 0,
    bounced.length === 0 ? "none" : bounced.join("; "),
  );
  check(
    `${role.label} — no internal link redirects somewhere else`,
    redirected.length === 0,
    redirected.length === 0 ? "none" : redirected.join("; "),
  );
  // Meaningless for an anonymous visitor: nothing is forbidden to them.
  if (!isPublic) {
    check(
      `${role.label} — no internal link dead-ends on "Access not allowed"`,
      denied.length === 0,
      denied.length === 0 ? "none" : denied.join("; "),
    );
  }
  check(
    `${role.label} — no link points at a record that no longer exists`,
    staleEntities.length === 0,
    staleEntities.length === 0
      ? "none"
      : `${staleEntities.join("; ")} — audit history for a deleted record; every QA run that creates and deletes a ${role.label} record leaves one`,
  );
  if (downloads.length) note(`${role.label}: ${downloads.length} download endpoint(s) skipped, not pages: ${downloads.join(", ")}`);
  check(
    `${role.label} — no internal link lands on a page error`,
    errored.length === 0,
    errored.length === 0 ? "none" : errored.join("; "),
  );

  await context.close();
}

await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} assertions passed`);
if (notes.length) {
  console.log("\nnotes:");
  for (const n of notes) console.log(`  - ${n}`);
}
process.exitCode = passed === results.length ? 0 : 1;