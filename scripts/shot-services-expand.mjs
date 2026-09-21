import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

mkdirSync("e2e-evidence/services-expand", { recursive: true });

const browser = await chromium.launch();

for (const w of [1440, 768, 375]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto("http://127.0.0.1:3000/services", {
    waitUntil: "networkidle",
    timeout: 60000,
  });
  await page.waitForTimeout(400);
  await page.locator("text=Where we place talent").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({
    path: `e2e-evidence/services-expand/services-${w}.png`,
    fullPage: true,
  });
  await page.close();
}

const home = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await home.goto("http://127.0.0.1:3000/", {
  waitUntil: "networkidle",
  timeout: 60000,
});
await home.locator("#services").scrollIntoViewIfNeeded();
await home.waitForTimeout(400);
await home.screenshot({
  path: "e2e-evidence/services-expand/home-services-1440.png",
});
await browser.close();
console.log("ok");
