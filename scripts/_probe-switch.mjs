// TEMPORARY probe: why does the switch's ::after overlay contribute height but
// not width to the measured touch target?
//
// The a11y check computes:
//   h += max(-top, -bottom, 0) * 2      -> 14 + 16 = 30   (works)
//   w += max(-left, -right, 0) * 2      -> 24 + 0  = 24   (does not)
//
// It adopts the session auth.setup.ts already paid for, exactly like the spec
// does, rather than doing a password grant.
import { chromium, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const file = resolve(process.cwd(), ".auth", "employee.json");
if (!existsSync(file)) {
  console.error(`no session at ${file}`);
  process.exit(2);
}
const { cookies = [] } = JSON.parse(readFileSync(file, "utf8"));

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
await ctx.addCookies(cookies);
const page = await ctx.newPage();

await page.goto(`${BASE}/app/my/notifications`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const out = await page.evaluate(() => {
  const el = document.querySelector('[role="switch"]');
  if (!el) return { error: "no switch found", url: location.pathname };
  const a = getComputedStyle(el, "::after");
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    url: location.pathname,
    ariaLabel: el.getAttribute("aria-label"),
    dataSize: el.getAttribute("data-size"),
    box: `${Math.round(r.width)}x${Math.round(r.height)}`,
    pointerCoarse: matchMedia("(pointer: coarse)").matches,
    after: {
      content: a.content,
      position: a.position,
      top: a.top,
      bottom: a.bottom,
      left: a.left,
      right: a.right,
      insetBlock: a.insetBlock,
      insetInline: a.insetInline,
      inset: a.inset,
      width: a.width,
      height: a.height,
    },
    // Does the generated stylesheet actually contain the coarse rule for this?
    matchedRules: [...document.styleSheets]
      .flatMap((s) => {
        try {
          return [...s.cssRules];
        } catch {
          return [];
        }
      })
      .filter((r2) => r2.cssText?.includes("pointer: coarse") && r2.cssText?.includes("inset"))
      .map((r2) => r2.cssText.replace(/\s+/g, " ").slice(0, 200)),
  };
});

console.log(JSON.stringify(out, null, 2));
await browser.close();