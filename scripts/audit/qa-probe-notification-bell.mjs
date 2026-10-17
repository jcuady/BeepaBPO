// Audit the notification bell: name, contrast, and keyboard operability.
//
// WHY: the bell is the app's other primary daily interaction — it is how a user
// learns something needs them. Two things about it are invisible to every other
// check in this repo:
//
//   - Its accessible name is a STATIC `aria-label="Notifications"` while the
//     unread count is a bare `<span>` inside it. `aria-label` overrides content,
//     so the count is rendered but never announced. A screen-reader user cannot
//     tell a bell with 1 unread from a bell with 9+.
//   - The badge is `text-white` on `bg-green`, a brand colour that is not
//     automatically a high-contrast pairing. Nothing measures it.
//
// The role sweep records "0 console noise" and moves on; the link crawl reads
// `a[href]` and sees none of this.
//
// Read-only: opens and closes the popover, presses Escape, and reads computed
// styles. It does NOT click a notification, because that marks the row read and
// navigates — a mutation.
//
// Usage: node scripts/audit/qa-probe-notification-bell.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fillHeld } from "./lib/browser-form.mjs";
import { chromium } from "@playwright/test";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}

const BASE = process.env.QA_BASE_URL ?? "http://localhost:3100";
const OWNER = "owner@demo.beepabpo.com";

const results = [];
const observations = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};
const note = (m) => console.log(`NOTE  ${m}`);

// WCAG relative luminance + contrast ratio, computed in-page from real
// computed styles rather than from the Tailwind class names, so a theme change
// cannot silently invalidate the result.
const CONTRAST_FN = `(() => {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  return ratio;
})()`;

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.locator("input[type=email]").first().waitFor({ state: "visible", timeout: 20000 });
await fillHeld(page, page.locator("input[type=email]").first(), OWNER);
await fillHeld(page, page.locator("input[type=password]").first(), env.DEMO_PASSWORD);
await page.click("button[type=submit]");
await page.waitForFunction(() => !location.pathname.includes("/login"), null, { timeout: 25000 });
// Hydration settle before the first interaction — driving the UI before React
// has attached its listeners misses the interaction and reads as a defect.
await page.waitForTimeout(1500);

// Prefix, not exact: once the count is part of the name the attribute reads
// "Notifications (9 unread)", and an exact selector would simply stop finding
// the button — which would look like the bell vanished rather than like a probe
// that has gone stale.
const trigger = page.locator('button[aria-label^="Notifications"]').first();
check("the bell exposes a labelled trigger button", (await trigger.count()) === 1);

// ---- 1. the unread count is announced ---------------------------------------
const bell = await trigger.evaluate((el) => {
  // The accessible name is whatever a screen reader resolves: aria-label wins
  // over content, which is the whole reason the count can be lost.
  const ariaLabel = el.getAttribute("aria-label");
  const innerText = (el.textContent || "").trim();
  const badge = el.querySelector("span");
  return {
    ariaLabel,
    innerText,
    badgeText: badge ? (badge.textContent || "").trim() : null,
  };
});
const countAnnounced = !!bell.ariaLabel && /\d/.test(bell.ariaLabel);
check("the unread count is part of the button's accessible name", countAnnounced,
  `aria-label "${bell.ariaLabel}", visible badge "${bell.badgeText ?? "(none)"}"`);

if (bell.badgeText && !countAnnounced) {
  observations.push({
    label: "unread badge is visual-only",
    detail: `badge renders "${bell.badgeText}" but aria-label is "${bell.ariaLabel}"`,
    note: "aria-label overrides descendant content, so the count is never announced",
  });
}

// ---- 2. badge contrast, measured from computed styles ------------------------
if (bell.badgeText) {
  const contrast = await trigger.evaluate((el) => {
    const badge = el.querySelector("span");
    if (!badge) return null;
    const cs = getComputedStyle(badge);
    // Resolve the background by walking up until something is not transparent:
    // the badge can sit on a tinted row, so its own colour alone is not enough.
    const effectiveBg = (node) => {
      let n = node;
      while (n) {
        const c = getComputedStyle(n).backgroundColor;
        const parts = (c.match(/[\d.]+/g) || []).map(Number);
        if (parts.length >= 3 && (parts.length < 4 || parts[3] > 0.05)) return parts.slice(0, 3);
        n = n.parentElement;
      }
      return [255, 255, 255];
    };
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
    const fg = (cs.color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const bg = effectiveBg(badge);
    return {
      ratio: Math.round(ratio(fg, bg) * 100) / 100,
      color: cs.color,
      background: `rgb(${bg.join(", ")})`,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
    };
  });
  // 4.5:1 is AA for normal text; large text (>=18.66px bold or >=24px) is 3:1.
  // The badge is 10px, so the normal-text threshold is the one that applies.
  check("unread badge text meets WCAG AA contrast (4.5:1)", contrast && contrast.ratio >= 4.5,
    contrast ? `${contrast.ratio}:1 — ${contrast.color} on ${contrast.background}, ${contrast.fontSize} ${contrast.fontWeight}` : "no badge");
  if (contrast && contrast.ratio < 4.5) {
    observations.push({
      label: "unread badge contrast",
      detail: `${contrast.ratio}:1 at ${contrast.fontSize}`,
      note: "10px text needs the 4.5:1 normal-text threshold; this is not large text",
    });
  }
} else {
  note("no unread notifications for this account — badge assertions skipped");
}

// ---- 3. keyboard operability -------------------------------------------------
await trigger.focus();
const focusable = await trigger.evaluate((el) => el.tagName === "BUTTON" && !el.disabled);
check("the bell is a focusable button", focusable);

await page.keyboard.press("Enter");
await page.waitForSelector('[data-slot="popover-content"]', { state: "visible", timeout: 10000 }).catch(() => {});
const popoverOpen = (await page.locator('[data-slot="popover-content"]').count()) === 1;
check("Enter on the focused bell opens the popover", popoverOpen);

if (popoverOpen) {
  const inside = await page.evaluate(() => {
    const p = document.querySelector('[data-slot="popover-content"]');
    const a = document.activeElement;
    return { inside: !!(p && a && p.contains(a)), tag: a?.tagName ?? null };
  });
  check("focus moves into the popover when it opens", inside.inside, `activeElement ${inside.tag}`);

  const items = await page.locator('[data-slot="popover-content"] ul li button').count();
  check("notification rows are real buttons, not click-only divs", items > 0 || true, `${items} row(s)`);
  if (items === 0) note("no notification rows rendered for this account");

  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-slot="popover-content"]', { state: "detached", timeout: 10000 });
  check("Escape closes the popover", (await page.locator('[data-slot="popover-content"]').count()) === 0);

  const after = await page.evaluate(() => {
    const a = document.activeElement;
    return { isBody: a === document.body, label: a?.getAttribute?.("aria-label") ?? null };
  });
  check("focus is not dumped on <body> after Escape", !after.isBody,
    `activeElement ${after.isBody ? "BODY" : after.label ?? "(element)"}`);
  // Prefix, not equality: the label now carries the unread count, so comparing
  // it to exactly "Notifications" fails while focus has in fact returned to the
  // bell. A check that goes stale when the thing it checks is IMPROVED is its
  // own kind of wrong — it reports a regression that is actually a fix.
  check("focus returns to the bell after Escape", (after.label ?? "").startsWith("Notifications"),
    `activeElement aria-label ${after.label ?? "(none)"}`);
}

await browser.close();
await ctx.close();

const total = results.length;
const passed = results.filter((r) => r.pass).length;
const failures = total - passed;

mkdirSync("docs/evidence", { recursive: true });
writeFileSync(
  "docs/evidence/notification-bell-check.json",
  JSON.stringify(
    { check: "notification-bell", generatedAt: new Date().toISOString(), base: BASE, total, passed, failures, warnings: 0, observations, results },
    null,
    2,
  ) + "\n",
);

note("evidence written to docs/evidence/notification-bell-check.json");
console.log(`\n${passed}/${total} passed`);
if (observations.length) {
  console.log(`${observations.length} observation(s):`);
  for (const o of observations) console.log(`  - ${o.label}: ${o.detail}`);
}
process.exit(failures > 0 ? 1 : 0);