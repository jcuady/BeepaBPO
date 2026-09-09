/**
 * TDD seam — Why Beepa section media:
 * 1) Uses the local sec1-derived asset (/images/sections/why-beepa-agent.webp)
 * 2) Image loads (naturalWidth > 0)
 * 3) Fills its frame (cover): rendered box matches the bezel frame size within 2px
 *
 * Exit 2 = RED, Exit 0 = GREEN
 */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const BASE = process.env.WHY_BASE_URL || "http://localhost:3000";
const ASSET = path.join(
  process.cwd(),
  "public/images/sections/why-beepa-agent.webp",
);

(async () => {
  const assetExists = fs.existsSync(ASSET);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("#why-beepa", { timeout: 20000 });
  await page.locator("#why-beepa").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  const info = await page.evaluate(() => {
    const section = document.querySelector("#why-beepa");
    const img = section?.querySelector("img");
    const frame = img?.parentElement;
    if (!img || !frame) return { found: false };
    const ir = img.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    return {
      found: true,
      src: img.currentSrc || img.src,
      alt: img.getAttribute("alt") || "",
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      imgW: Math.round(ir.width),
      imgH: Math.round(ir.height),
      frameW: Math.round(fr.width),
      frameH: Math.round(fr.height),
      fillsWidth: Math.abs(ir.width - fr.width) <= 2,
      fillsHeight: Math.abs(ir.height - fr.height) <= 2,
      portraitish: fr.height > fr.width * 0.95,
    };
  });

  const checks = {
    assetExists,
    found: !!info.found,
    usesWhyAsset: /why-beepa-agent/i.test(info.src || ""),
    loaded: (info.naturalWidth || 0) > 0 && info.complete,
    fillsFrame: !!info.fillsWidth && !!info.fillsHeight,
    consoleClean: errors.length === 0,
  };

  const pass = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ info, checks, errors, pass }, null, 2));
  await browser.close();
  process.exit(pass ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
