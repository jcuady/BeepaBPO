/**
 * Runtime performance audit.
 *
 * Captures real Core Web Vitals in-browser (TTFB, FCP, LCP, CLS) plus transfer
 * weight and request counts for representative routes. LCP and CLS are only
 * observable from a PerformanceObserver installed before first paint, so this
 * uses addInitScript rather than reading the timeline after load.
 *
 * Usage:
 *   node scripts/audit-performance.mjs [baseUrl] [route ...]
 *   AUTH_EMAIL=owner@demo.beepabpo.com node scripts/audit-performance.mjs
 */
import { chromium } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Accept BASE_URL like the other audit scripts, and keep the positional form
// for backwards compatibility. Previously only argv[2] was read, so setting
// BASE_URL silently pointed the whole run at http://localhost:3000 — and the
// resulting total measurement outage still reported "7/7 within budget".
// `QA_BASE_URL` first, matching the other audit scripts in this repo, and
// defaulting to 3100 rather than 3000. This defaulted to `BASE_URL` and port
// 3000, so a run against the documented `next start -p 3100` measured a
// connection-refused for every route and reported it as a performance result.
// `BASE_URL` and a positional argument are still honoured.
const BASE = process.env.QA_BASE_URL ?? process.env.BASE_URL ?? process.argv[2] ?? "http://localhost:3100";
const ROUTES = process.argv.slice(3);
const routes = ROUTES.length
  ? ROUTES
  : ["/", "/services", "/about", "/contact", "/careers", "/app/my", "/app/dashboard"];

const envLine = (key) => {
  if (!existsSync(".env.local")) return undefined;
  const m = readFileSync(".env.local", "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
};

const PASSWORD = process.env.DEMO_PASSWORD ?? envLine("DEMO_PASSWORD");
const AUTH_EMAIL = process.env.AUTH_EMAIL;

// Thresholds: "good" per web.dev Core Web Vitals.
const BUDGET = { lcp: 2500, fcp: 1800, cls: 0.1, ttfb: 800 };

const initVitals = () => {
  window.__vitals = { lcp: 0, cls: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__vitals.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__vitals.cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {}
};

const browser = await chromium.launch();

let statePath;
if (AUTH_EMAIL && PASSWORD) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/employee/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).fill(AUTH_EMAIL);
  await page.getByLabel(/^password$/i).fill(PASSWORD);
  await page
    .getByRole("button", { name: /access portal/i })
    .click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 30_000 });
  statePath = join(tmpdir(), `beepa-perf-${Date.now()}.json`);
  await ctx.storageState({ path: statePath });
  await ctx.close();
  console.log(`Authenticated as ${AUTH_EMAIL}\n`);
} else {
  console.log("No AUTH_EMAIL/DEMO_PASSWORD — measuring public routes only.\n");
}

const rows = [];
for (const route of routes) {
  const ctx = await browser.newContext({
    storageState: statePath,
    viewport: { width: 1440, height: 900 },
  });
  await ctx.addInitScript(initVitals);
  const page = await ctx.newPage();

  const bytesByType = { total: 0, script: 0, image: 0, font: 0, other: 0 };
  let requests = 0;
  const failed = [];
  page.on("response", async (res) => {
    requests++;
    const status = res.status();
    if (status >= 400) failed.push(`${status} ${res.url().slice(0, 80)}`);
    try {
      const len = Number(res.headers()["content-length"] ?? 0);
      if (len) bytesByType.total += len;
    } catch {
      /* opaque responses have no content-length */
    }
  });

  try {
    await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 45_000 });
  } catch {
    rows.push({ route, error: "navigation failed" });
    await ctx.close();
    continue;
  }
  // Give LCP/CLS a chance to settle, then freeze the measurements.
  await page.waitForTimeout(1500);

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = performance.getEntriesByType("paint");
    const fcpEntry = paint.find((p) => p.name === "first-contentful-paint");
    const res = performance.getEntriesByType("resource");
    const byType = { script: 0, image: 0, font: 0, other: 0 };
    for (const r of res) {
      const t = r.initiatorType === "script" || r.initiatorType === "other"
        ? r.initiatorType
        : r.initiatorType;
      const size = r.transferSize || r.encodedBodySize || 0;
      if (t === "script") byType.script += size;
      else if (t === "img" || t === "css") byType.image += size;
      else if (t === "css" || t === "link") byType.font += size;
      else byType.other += size;
    }
    return {
      ttfb: nav ? nav.responseStart : 0,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
      load: nav ? nav.loadEventEnd : 0,
      fcp: fcpEntry ? fcpEntry.startTime : 0,
      lcp: window.__vitals?.lcp ?? 0,
      cls: window.__vitals?.cls ?? 0,
      domNodes: document.querySelectorAll("*").length,
      resBytes: byType,
      resCount: res.length,
      transfer: res.reduce((s, r) => s + (r.transferSize || 0), 0),
    };
  });

  rows.push({ route, ...m, requests, failed });
  await ctx.close();
}

await browser.close();

const kb = (n) => `${Math.round(n / 1024)}kB`;
const ms = (n) => `${Math.round(n)}ms`;
const flag = (v, budget) => (v <= budget ? "ok " : "OVER");

console.log(
  "route".padEnd(20) +
    "TTFB".padEnd(9) +
    "FCP".padEnd(9) +
    "LCP".padEnd(9) +
    "CLS".padEnd(8) +
    "transfer".padEnd(10) +
    "reqs".padEnd(6) +
    "nodes",
);
console.log("-".repeat(90));

let overBudget = 0;
let unmeasured = 0;
const RED = process.env.NO_COLOR ? "" : "\x1b[31m";
const RESET = process.env.NO_COLOR ? "" : "\x1b[0m";
for (const r of rows) {
  if (r.error) {
    // A route that never loaded was not measured. Counting it as "within
    // budget" is how a total measurement outage still reported 7/7 green.
    unmeasured++;
    console.log(`${r.route.padEnd(20)} ${RED}${r.error} (not measured)${RESET}`);
    continue;
  }
  if (r.ttfb > BUDGET.ttfb || r.lcp > BUDGET.lcp || r.cls > BUDGET.cls) overBudget++;
  console.log(
    r.route.padEnd(20) +
      `${ms(r.ttfb)} ${flag(r.ttfb, BUDGET.ttfb)}`.padEnd(9) +
      `${ms(r.fcp)} ${flag(r.fcp, BUDGET.fcp)}`.padEnd(9) +
      `${ms(r.lcp)} ${flag(r.lcp, BUDGET.lcp)}`.padEnd(9) +
      `${r.cls.toFixed(3)} ${flag(r.cls, BUDGET.cls)}`.padEnd(8) +
      `${kb(r.transfer)}`.padEnd(10) +
      `${String(r.resCount).padEnd(6)}` +
      r.domNodes,
  );
  if (r.failed.length) {
    console.log(`   ${r.failed.length} failed request(s):`);
    for (const f of r.failed.slice(0, 5)) console.log(`     - ${f}`);
  }
}

console.log(
  `\nbudget: LCP<=${BUDGET.lcp}ms  FCP<=${BUDGET.fcp}ms  CLS<=${BUDGET.cls}  TTFB<=${BUDGET.ttfb}ms`,
);
const measured = rows.length - unmeasured;
console.log(`${measured}/${rows.length} routes measured; ${overBudget} over budget; ${unmeasured} not measured`);
if (unmeasured > 0) {
  console.log(
    `${RED}Routes that failed to load cannot be judged. Fix the navigation before trusting this run.${RESET}`,
  );
}
process.exit(overBudget || unmeasured ? 1 : 0);