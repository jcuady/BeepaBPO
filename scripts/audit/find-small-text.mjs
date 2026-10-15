/**
 * Names the exact elements whose computed font-size falls below the mobile
 * floor, so a fix can be made deliberately rather than by guessing at classes.
 *
 * Read-only browser probe. Run against a production build, not next dev.
 *   BASE_URL=http://localhost:3100 node scripts/audit/find-small-text.mjs <email> <route...>
 */
import { chromium } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.QA_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3100";
const EMAIL = process.argv[2] ?? "employee@demo.beepabpo.com";
const ROUTES = process.argv.slice(3);
const WIDTH = Number(process.env.WIDTH ?? 390);
const MIN = Number(process.env.MIN_PX ?? 16);

if (!ROUTES.length) {
  console.error("usage: find-small-text.mjs <email> <route...>");
  process.exit(1);
}

function env() {
  const p = ".env.local";
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    let x = line.slice(i + 1).trim();
    if ((x.startsWith('"') && x.endsWith('"')) || (x.startsWith("'") && x.endsWith("'"))) x = x.slice(1, -1);
    out[line.slice(0, i).trim()] = x;
  }
  return out;
}

const e = env();
const password = e.DEMO_PASSWORD;
if (!password) {
  console.error("DEMO_PASSWORD missing from .env.local");
  process.exit(1);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/employee/login`, { waitUntil: "domcontentloaded" });
await page.getByLabel(/email/i).fill(EMAIL);
await page.getByLabel(/^password$/i).fill(password);
await page.getByRole("button", { name: /access portal/i }).click();
await page.waitForURL(/\/app/, { timeout: 45_000 });
console.log(`Authenticated as ${EMAIL} at ${WIDTH}px\n`);

let grand = 0;
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const offenders = await page.evaluate((min) => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!el.textContent?.trim()) continue;
      // Only elements that directly render text.
      const hasDirectText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent?.trim(),
      );
      if (!hasDirectText) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const size = parseFloat(cs.fontSize);
      if (size >= min) continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || "").toString().slice(0, 120),
        size: size,
        text: (el.textContent || "").trim().slice(0, 48),
      });
    }
    return out;
  }, MIN);

  console.log(`${route}  ->  ${offenders.length} element(s) under ${MIN}px`);
  for (const o of offenders) {
    console.log(`   ${o.tag}  ${o.size}px  "${o.text}"`);
    console.log(`      class="${o.cls}"`);
  }
  console.log("");
  grand += offenders.length;
}

console.log(`Total: ${grand}`);
await browser.close();