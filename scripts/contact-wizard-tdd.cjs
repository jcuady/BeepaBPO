/**
 * Contact / Let's Talk verification
 * Seams: console clean, wizard mounts, step advance works, header brand labels stable
 * Exit 2 = RED, Exit 0 = GREEN
 */
const { chromium } = require("@playwright/test");

const BASE = process.env.CONTACT_BASE_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/contact`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForSelector("[data-contact-wizard]", { timeout: 20000 });
  await page.waitForTimeout(1200);

  const aria = await page
    .locator('header a[aria-label]')
    .first()
    .getAttribute("aria-label");

  const step0 = await page.getAttribute(
    "[data-contact-wizard='active']",
    "data-contact-step",
  );

  // Invalid continue should stay on step 1 (you)
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(200);
  const stillYou = await page.getAttribute(
    "[data-contact-wizard='active']",
    "data-contact-step",
  );
  const nameErr = await page.getByText("Name is required.").count();

  await page.locator("[id$='-name']").first().fill("Alex Rivera");
  await page.locator("[id$='-email']").first().fill("alex@acme.test");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(300);

  const step1 = await page.getAttribute(
    "[data-contact-wizard='active']",
    "data-contact-step",
  );

  await page.locator("[id$='-company']").first().fill("Acme Co");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForTimeout(300);

  const step2 = await page.getAttribute(
    "[data-contact-wizard='active']",
    "data-contact-step",
  );
  const submitVisible = await page
    .getByRole("button", { name: "Build Your Team" })
    .count();

  const loop = errors.some(
    (e) =>
      /Maximum update depth/i.test(e) ||
      /getSnapshot should be cached/i.test(e) ||
      /hydration/i.test(e),
  );

  const checks = {
    wizardFound: Boolean(step0),
    startsOnYou: step0 === "you",
    blocksEmptyContinue: stillYou === "you" && nameErr > 0,
    advancesToCompany: step1 === "company",
    advancesToNeed: step2 === "need",
    submitReady: submitVisible > 0,
    headerBrandStable: Boolean(aria && /Beepa home/i.test(aria)),
    consoleClean: errors.length === 0,
    noLoopOrHydration: !loop,
  };

  const pass = Object.values(checks).every(Boolean);
  console.log(
    JSON.stringify({ checks, aria, steps: { step0, stillYou, step1, step2 }, errors }, null, 2),
  );
  await browser.close();
  process.exit(pass ? 0 : 2);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
