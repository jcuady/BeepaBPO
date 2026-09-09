/* Landing page verification: hero GSAP entrance, section redesigns, pinned
   process scroll-hijack, reduced-motion fallback, mobile layout. */
const { chromium } = require("@playwright/test");
const fs = require("fs");

const OUT = "e2e-evidence/landing";
const BASE = "http://localhost:3000";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const results = {};

  // ---- Desktop pass ----
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-hero='feature']", { timeout: 20000 });
  await page.waitForTimeout(2200); // let entrance timeline finish

  // 1. Hero: sidebar text removed
  results.sidebarRemoved = (await page.getByText("Great People Build Brighter").count()) === 0;

  // 2. Hero entrance: all animated elements fully visible
  results.heroVisible = await page.evaluate(() => {
    return [...document.querySelectorAll("[data-hero]")].every((el) => {
      const s = getComputedStyle(el);
      return Number(s.opacity) > 0.99 && s.transform !== "matrix(0, 0, 0, 0, 0, 0)";
    });
  });

  await page.screenshot({ path: `${OUT}/01-hero.png` });

  // 3. Sections screenshots
  const sections = ["#services", "#why-beepa"];
  for (const [i, sel] of sections.entries()) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1100); // reveal transitions
    await page.screenshot({ path: `${OUT}/0${i + 2}-${sel.slice(1)}.png` });
  }

  // 4. Process pin: find section, scroll into pin range, verify pinning + track translation
  const processInfo = await page.evaluate(() => {
    const section = document.querySelector("section:has(> div [data-step-track])") ||
      [...document.querySelectorAll("section")].find((s) => s.textContent.includes("A clear path"));
    return { found: !!section };
  });
  results.processFound = processInfo.found;

  // Scroll progressively and sample pin state
  await page.evaluate(() => {
    const section = [...document.querySelectorAll("section")].find((s) =>
      s.textContent.includes("A clear path"),
    );
    section.scrollIntoView();
  });
  await page.waitForTimeout(600);

  const pinSamples = [];
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(700);
    const sample = await page.evaluate(() => {
      const section = [...document.querySelectorAll("section")].find((s) =>
        s.textContent.includes("A clear path"),
      );
      const track = section.querySelector(".flex.md\\:flex-row");
      const rect = section.getBoundingClientRect();
      const x = new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
      const spacer = section.closest(".pin-spacer");
      return {
        sectionTop: Math.round(rect.top),
        trackX: Math.round(x),
        pinned: !!spacer,
        pinSpacerHeight: spacer ? Math.round(spacer.getBoundingClientRect().height) : 0,
      };
    });
    pinSamples.push(sample);
  }
  results.pinSamples = pinSamples;
  results.pinWorks =
    pinSamples.some((s) => s.pinned) &&
    pinSamples.some((s) => s.trackX < -50) &&
    pinSamples.some((s) => Math.abs(s.sectionTop) < 4);

  await page.screenshot({ path: `${OUT}/04-process-pinned.png` });

  // 5. FAQ interaction
  await page.evaluate(() => {
    [...document.querySelectorAll("section")].find((s) => s.textContent.includes("Questions teams ask"))?.scrollIntoView();
  });
  await page.waitForTimeout(900);
  const faqTrigger = page.locator("[data-slot='accordion-trigger']").first();
  await faqTrigger.click();
  await page.waitForTimeout(500);
  results.faqOpens = await page.evaluate(() => {
    const panel = document.querySelector("[data-slot='accordion-content']");
    return panel && panel.getBoundingClientRect().height > 10;
  });
  await page.screenshot({ path: `${OUT}/05-faq.png` });

  // 6. Final CTA
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/06-final-cta.png` });

  // 7. Horizontal scroll check
  results.noHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );

  await page.close();

  // ---- Reduced motion pass ----
  const rmPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await rmPage.goto(BASE, { waitUntil: "domcontentloaded" });
  await rmPage.waitForSelector("[data-hero='feature']", { timeout: 20000 });
  await rmPage.waitForTimeout(800);
  results.reducedMotion = await rmPage.evaluate(() => {
    const heroOk = [...document.querySelectorAll("[data-hero]")].every(
      (el) => Number(getComputedStyle(el).opacity) > 0.99,
    );
    const section = [...document.querySelectorAll("section")].find((s) =>
      s.textContent.includes("A clear path"),
    );
    const noPin = !section.closest(".pin-spacer");
    const track = section.querySelector(".flex.md\\:flex-row");
    const trackX = Math.abs(new DOMMatrixReadOnly(getComputedStyle(track).transform).m42);
    return { heroOk, noPin, trackAtRest: trackX < 1 };
  });
  await rmPage.evaluate(() => {
    [...document.querySelectorAll("section")].find((s) => s.textContent.includes("A clear path"))?.scrollIntoView();
  });
  await rmPage.waitForTimeout(500);
  await rmPage.screenshot({ path: `${OUT}/07-process-reduced-motion.png` });
  await rmPage.close();

  // ---- Mobile pass ----
  const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mob.goto(BASE, { waitUntil: "domcontentloaded" });
  await mob.waitForSelector("[data-hero='feature']", { timeout: 20000 });
  await mob.waitForTimeout(2000);
  await mob.screenshot({ path: `${OUT}/08-mobile-hero.png` });
  await mob.evaluate(() => {
    [...document.querySelectorAll("section")].find((s) => s.textContent.includes("A clear path"))?.scrollIntoView();
  });
  await mob.waitForTimeout(700);
  await mob.screenshot({ path: `${OUT}/09-mobile-process.png` });
  results.mobileNoHorizontalScroll = await mob.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
  await mob.close();

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
