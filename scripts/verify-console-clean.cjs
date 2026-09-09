/* Prove console CSP + image-quality errors are gone on the landing page. */
const { chromium } = require("@playwright/test");
const fs = require("fs");

const OUT = "e2e-evidence/landing-console";
const BASE = "http://localhost:3000";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  /** @type {string[]} */
  const consoleErrors = [];
  /** @type {string[]} */
  const pageErrors = [];
  /** @type {string[]} */
  const failedRequests = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("requestfailed", (req) => {
    failedRequests.push(`${req.failure()?.errorText || "failed"} :: ${req.url()}`);
  });

  const response = await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  const csp = response?.headers()["content-security-policy"] || "";

  await page.waitForSelector("[data-hero='feature']", { timeout: 20000 });

  // Force careers image into view so it loads
  await page.evaluate(() => {
    [...document.querySelectorAll("section")].find((s) =>
      s.textContent?.includes("Grow your career"),
    )?.scrollIntoView();
  });
  await page.waitForTimeout(1500);

  // Scroll whole page so all images/lazy content load
  await page.evaluate(async () => {
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 200));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);

  const careersSrc = await page.evaluate(() => {
    const img = [...document.querySelectorAll("img")].find((el) =>
      (el.getAttribute("alt") || "").includes("collaborating"),
    );
    return img ? img.currentSrc || img.src : null;
  });

  const careersNatural = await page.evaluate(() => {
    const img = [...document.querySelectorAll("img")].find((el) =>
      (el.getAttribute("alt") || "").includes("collaborating"),
    );
    if (!img) return null;
    return { w: img.naturalWidth, h: img.naturalHeight, complete: img.complete };
  });

  const heroQualityWarn = consoleErrors.some((t) =>
    /quality.*80|unconfigured-qualities/i.test(t),
  );
  const cspPicsumBlock = consoleErrors.some((t) =>
    /Content Security Policy|picsum|fastly\.picsum/i.test(t),
  );
  const picsumFailed = failedRequests.some((t) => /picsum/i.test(t));

  // Relevant CSP check: no picsum host allowed (we use local assets)
  const imgSrcDirective = (csp.match(/img-src[^;]*/)?.[0] || "").toLowerCase();
  const cspAllowsPicsum = /picsum/.test(imgSrcDirective);

  await page.screenshot({ path: `${OUT}/careers.png`, fullPage: false });
  await page.evaluate(() => {
    [...document.querySelectorAll("section")].find((s) =>
      s.textContent?.includes("Grow your career"),
    )?.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/careers-in-view.png` });

  const result = {
    status: response?.status() ?? null,
    careersSrc,
    careersNatural,
    heroQualityWarn,
    cspPicsumBlock,
    picsumFailed,
    cspAllowsPicsum,
    imgSrcDirective,
    consoleErrors,
    pageErrors,
    failedRequests: failedRequests.filter(
      (t) => !/favicon|hmr|webpack|turbopack|_next\/static/i.test(t),
    ),
    pass:
      !heroQualityWarn &&
      !cspPicsumBlock &&
      !picsumFailed &&
      !cspAllowsPicsum &&
      !!careersSrc &&
      !/picsum/i.test(careersSrc || "") &&
      (careersNatural?.w ?? 0) > 0,
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(result.pass ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
