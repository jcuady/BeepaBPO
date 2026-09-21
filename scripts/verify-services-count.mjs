import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
const titles = await page.locator("#services h3").allTextContents();
console.log("count", titles.length);
console.log(titles.join(" | "));
await page.locator("#services").screenshot({
  path: "e2e-evidence/services-expand/home-services-full-1440.png",
});

await page.goto("http://127.0.0.1:3000/services", { waitUntil: "networkidle" });
const cards = await page.locator("article[id] h3").allTextContents();
console.log("services page", cards.length, cards.join(" | "));
await browser.close();
