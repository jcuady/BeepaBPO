/* Strict infinite marquee QA — GSAP engine, continuous left motion, loop seam */
const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "no-preference",
  });

  await page.goto("http://localhost:3000", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForSelector('[data-marquee-engine="gsap"]', { timeout: 20000 });
  // Let GSAP mount
  await page.waitForTimeout(400);

  const samples = [];
  for (let i = 0; i < 8; i++) {
    samples.push(
      await page.evaluate(() => {
        const track = document.querySelector(".trust-marquee-track");
        const s = getComputedStyle(track);
        const m = new DOMMatrixReadOnly(s.transform);
        const lists = [...track.querySelectorAll("ul")];
        return {
          engine: track.getAttribute("data-marquee-engine"),
          x: m.m41,
          xPercentApprox: track.offsetWidth
            ? (m.m41 / track.offsetWidth) * 100
            : null,
          listCount: lists.length,
          listW: lists.map((l) => Math.round(l.getBoundingClientRect().width)),
          cssAnim: s.animationName,
        };
      }),
    );
    await page.waitForTimeout(400);
  }

  const xs = samples.map((s) => s.x);
  const deltas = xs.slice(1).map((x, i) => x - xs[i]);
  const alwaysLeft = deltas.every((d) => d < -2);
  const equalTracks =
    Math.abs(samples[0].listW[0] - samples[0].listW[1]) <= 1;
  const gsapEngine = samples[0].engine === "gsap";
  // No CSS keyframe driving it (GSAP owns transform)
  const cssNotDriving =
    !samples[0].cssAnim || samples[0].cssAnim === "none";

  // Pause button must pause; resume must continue
  await page.getByRole("button", { name: /Pause focus areas carousel/i }).click();
  await page.waitForTimeout(300);
  const pausedX1 = await page.evaluate(
    () =>
      new DOMMatrixReadOnly(
        getComputedStyle(document.querySelector(".trust-marquee-track")).transform,
      ).m41,
  );
  await page.waitForTimeout(600);
  const pausedX2 = await page.evaluate(
    () =>
      new DOMMatrixReadOnly(
        getComputedStyle(document.querySelector(".trust-marquee-track")).transform,
      ).m41,
  );
  const pauses = Math.abs(pausedX2 - pausedX1) < 1;

  await page.getByRole("button", { name: /Play focus areas carousel/i }).click();
  await page.waitForTimeout(300);
  const playX1 = await page.evaluate(
    () =>
      new DOMMatrixReadOnly(
        getComputedStyle(document.querySelector(".trust-marquee-track")).transform,
      ).m41,
  );
  await page.waitForTimeout(700);
  const playX2 = await page.evaluate(
    () =>
      new DOMMatrixReadOnly(
        getComputedStyle(document.querySelector(".trust-marquee-track")).transform,
      ).m41,
  );
  const resumes = playX2 < playX1 - 2;

  // Long sample: prove it keeps going (infinite), not a one-shot
  await page.waitForTimeout(2500);
  const laterX = await page.evaluate(
    () =>
      new DOMMatrixReadOnly(
        getComputedStyle(document.querySelector(".trust-marquee-track")).transform,
      ).m41,
  );
  const keepsGoing = laterX < playX2 - 10;

  const result = {
    gsapEngine,
    cssNotDriving,
    equalTracks,
    alwaysLeft,
    pauses,
    resumes,
    keepsGoing,
    xs: xs.map((n) => Math.round(n)),
    deltas: deltas.map((n) => Math.round(n * 10) / 10),
    listW: samples[0].listW,
    pausedDelta: Math.round((pausedX2 - pausedX1) * 10) / 10,
    resumeDelta: Math.round((playX2 - playX1) * 10) / 10,
    laterX: Math.round(laterX),
  };

  const pass =
    gsapEngine &&
    cssNotDriving &&
    equalTracks &&
    alwaysLeft &&
    pauses &&
    resumes &&
    keepsGoing;

  console.log(JSON.stringify({ ...result, pass }, null, 2));
  await browser.close();
  process.exit(pass ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
