/**
 * TDD seam — infinite trust marquee must move under prefers-reduced-motion:reduce.
 * No pause button; hover pauses (WCAG 2.2.2).
 * Exit 2 = RED (broken). Exit 0 = GREEN (fixed).
 */
const { chromium } = require("@playwright/test");

const BASE = process.env.MARQUEE_BASE_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector(".trust-marquee-track", { timeout: 20000 });
  await page.waitForTimeout(600);

  const sample = () =>
    page.evaluate(() => {
      const track = document.querySelector(".trust-marquee-track");
      const s = getComputedStyle(track);
      return {
        x: new DOMMatrixReadOnly(s.transform).m41,
        lists: track.querySelectorAll("ul").length,
        playState: s.animationPlayState,
        anim: s.animationName,
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    });

  const a = await sample();
  await page.waitForTimeout(900);
  const b = await sample();

  const pauseBtnCount = await page
    .getByRole("button", { name: /Pause focus areas carousel|Play focus areas carousel/i })
    .count();

  // Hover pause
  await page.locator(".trust-marquee-mask").hover();
  await page.waitForTimeout(250);
  const p1 = await sample();
  await page.waitForTimeout(700);
  const p2 = await sample();
  const hoverPauses = Math.abs(p2.x - p1.x) < 2 && p1.playState === "paused";

  const checks = {
    underReduce: a.reduced === true,
    duplicatedTracks: a.lists >= 2,
    movedLeft: b.x < a.x - 5,
    noPauseButton: pauseBtnCount === 0,
    hoverPauses,
    consoleClean: errors.length === 0,
  };

  const pass = Object.values(checks).every(Boolean);

  console.log(
    JSON.stringify(
      { a, b, delta: b.x - a.x, checks, errors, pass },
      null,
      2,
    ),
  );
  await browser.close();
  process.exit(pass ? 0 : 2);
})().catch((err) => {
  console.error(err);
  process.exit(2);
});
