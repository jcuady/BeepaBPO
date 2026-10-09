import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

mkdirSync("e2e-evidence/blur-kill", { recursive: true });
const browser = await chromium.launch();
for (const w of [1440, 768, 375]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: `e2e-evidence/blur-kill/hero-${w}.png`,
    clip: { x: 0, y: 0, width: w, height: Math.min(900, w === 375 ? 820 : 900) },
  });
  await page.locator("#services").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `e2e-evidence/blur-kill/services-${w}.png` });
  await page.close();
}
await browser.close();
console.log("ok");
