/**
 * QA: Manpower model section (replaces consultancy process timeline)
 * Exit 2 = RED, 0 = GREEN
 */
const { chromium } = require("@playwright/test");

const BASE = process.env.PROCESS_BASE_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("[data-manpower-model]", { timeout: 20000 });
  await page.locator("[data-manpower-model]").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const info = await page.evaluate(() => {
    const section = document.querySelector("[data-manpower-model]");
    const text = section?.textContent ?? "";
    return {
      found: Boolean(section),
      hasSearch: /find the people|Search|talent/i.test(text),
      hasPay: /salary|pay/i.test(text),
      noDiscoveryRail: !document.querySelector("[data-process='static-rail']"),
      noPin: document.querySelectorAll(".pin-spacer").length === 0,
      cta: Boolean(section?.querySelector('a[href="/contact"]')),
    };
  });

  const checks = {
    found: info.found,
    hasSearch: info.hasSearch,
    hasPay: info.hasPay,
    oldProcessGone: info.noDiscoveryRail,
    noPin: info.noPin,
    hasCta: info.cta,
    consoleClean: errors.length === 0,
  };

  const pass = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ info, checks, errors, pass }, null, 2));
  await browser.close();
  process.exit(pass ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
