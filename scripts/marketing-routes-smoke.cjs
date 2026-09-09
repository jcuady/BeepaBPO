/**
 * Public marketing route smoke — expects 200 and key anchors.
 * Exit 2 = RED, 0 = GREEN
 */
const { chromium } = require("@playwright/test");

const BASE = process.env.MARKETING_BASE_URL || "http://localhost:3000";
const ROUTES = [
  "/",
  "/services",
  "/about",
  "/careers",
  "/resources",
  "/case-studies",
  "/contact",
  "/privacy",
  "/terms",
  "/login",
  "/employee/login",
  "/signup",
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  const results = [];

  for (const route of ROUTES) {
    const res = await page.goto(`${BASE}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    const status = res?.status() ?? 0;
    const ok = status >= 200 && status < 400;
    results.push({ route, status, ok });
    if (!ok) errors.push(`${route} → ${status}`);
  }

  // Landing anchors
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  for (const id of ["services", "why-beepa"]) {
    const count = await page.locator(`#${id}`).count();
    if (!count) errors.push(`missing #${id} on /`);
  }

  // Services anchors (fallback or CMS)
  await page.goto(`${BASE}/services`, { waitUntil: "domcontentloaded" });
  for (const id of ["customer-support", "back-office", "virtual-assistants"]) {
    const count = await page.locator(`#${id}`).count();
    if (!count) errors.push(`missing #${id} on /services`);
  }

  // Header CTA
  const cta = await page.locator('a[href="/contact"]').first().count();
  if (!cta) errors.push("no /contact CTA found from /services");

  console.log(JSON.stringify({ results, errors, pass: errors.length === 0 }, null, 2));
  await browser.close();
  process.exit(errors.length ? 2 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
