/**
 * Runtime corner-radius gate.
 *
 * Why this exists
 * ---------------
 * The brand is square, and that claim was previously checked only by *reading
 * class strings*. A static scan can prove that no `rounded-[16px]` survives in
 * `app/` or `components/`, but it cannot prove what a browser actually paints:
 * a radius can arrive through a CSS variable, a cascade from a parent, a
 * stylesheet, or a class emitted at runtime. Every automated gate that existed
 * during the square pass was green while `/signup` rendered a broken sentence,
 * and none of them ever looked at a rendered box.
 *
 * So this walks the real pages and measures computed `border-*-radius` on every
 * painted element.
 *
 * The exclusion, and why it is not a loophole
 * -------------------------------------------
 * `rounded-full` is excluded, because some shapes are circular *because they
 * mean something* rather than because they are brand chrome: avatars, the lime
 * bullet dots, the switch, the progress bar, the scrollbar thumb, and the
 * recruitment status chips. The exclusion is keyed on the class actually being
 * present, so an element cannot become an offender by being square-but-large —
 * and it cannot hide a bug by inheriting a radius, since inherited radii come
 * from an ancestor that is itself measured.
 *
 * A painted box counts as an offender at >= 8px on any corner, >= 2x2 CSS px.
 * The 2x2 floor skips elements that paint no visible box.
 *
 * Usage:  node scripts/audit/audit-runtime-radius.mjs [baseUrl]
 * Exit 0 on pass, 1 on any offender / broken image / non-200 / page error.
 */
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = process.argv[2] || "http://localhost:3100";

const ROUTES = [
  "/",
  "/about",
  "/services",
  "/why-beepa",
  "/careers",
  "/resources",
  "/contact",
  "/login",
  "/signup",
  "/forgot-password",
  "/terms",
  "/privacy",
];

const RADIUS_THRESHOLD_PX = 8;
const MIN_PAINTED_PX = 2;
const CIRCULAR_OK = "rounded-full";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const results = [];
let grandTotal = 0;

for (const route of ROUTES) {
  const pageErrors = [];
  const consoleErrors = [];
  const onConsole = (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
  };
  const onErr = (e) => pageErrors.push(String(e).slice(0, 200));
  page.on("console", onConsole);
  page.on("pageerror", onErr);

  const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  const status = resp ? resp.status() : 0;

  // A full-page screenshot of a lazy page photographs blank frames, which reads
  // as "broken image" and is not. Force every lazy image eager, then walk the
  // document so the measurement covers the whole page rather than the fold.
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => {
      i.loading = "eager";
    });
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  await page.waitForLoadState("networkidle").catch(() => {});

  const measured = await page.evaluate(
    ({ threshold, minPx, circularOk }) => {
      const offenders = [];
      let imagesOk = 0;
      let imagesBroken = 0;
      let imagesPending = 0;

      for (const el of document.querySelectorAll("*")) {
        const cls =
          el.className && el.className.toString ? el.className.toString() : "";
        if (cls.includes(circularOk)) continue;
        const cs = getComputedStyle(el);
        const corners = [
          "borderTopLeftRadius",
          "borderTopRightRadius",
          "borderBottomRightRadius",
          "borderBottomLeftRadius",
        ].map((k) => parseFloat(cs[k]) || 0);
        const max = Math.max(...corners);
        if (max < threshold) continue;
        const r = el.getBoundingClientRect();
        if (r.width < minPx || r.height < minPx) continue;
        offenders.push({
          tag: el.tagName.toLowerCase(),
          radius: max,
          cls: cls.slice(0, 120),
        });
      }

      for (const im of document.querySelectorAll("img")) {
        if (!im.complete) imagesPending++;
        else if (im.naturalWidth === 0) imagesBroken++;
        else imagesOk++;
      }
      return { offenders, imagesOk, imagesBroken, imagesPending };
    },
    {
      threshold: RADIUS_THRESHOLD_PX,
      minPx: MIN_PAINTED_PX,
      circularOk: CIRCULAR_OK,
    },
  );

  grandTotal += measured.offenders.length;
  results.push({
    route,
    status,
    nonCircularRounded: measured.offenders.length,
    offenders: measured.offenders,
    imagesOk: measured.imagesOk,
    imagesBroken: measured.imagesBroken,
    imagesPending: measured.imagesPending,
    pageErrors,
    consoleErrors,
  });

  page.off("console", onConsole);
  page.off("pageerror", onErr);
}

await browser.close();

const totalImgs = results.reduce(
  (a, r) => a + r.imagesOk + r.imagesBroken + r.imagesPending,
  0,
);
const totalBroken = results.reduce((a, r) => a + r.imagesBroken, 0);
const totalPending = results.reduce((a, r) => a + r.imagesPending, 0);
const non200 = results.filter((r) => r.status !== 200);
const offendersTotal = grandTotal;

const pass =
  offendersTotal === 0 &&
  totalBroken === 0 &&
  non200.length === 0 &&
  results.every((r) => r.pageErrors.length === 0);

const report = {
  check: "runtime-radius",
  generatedAt: new Date().toISOString(),
  base: BASE,
  threshold: `${RADIUS_THRESHOLD_PX}px on any corner`,
  excluded: CIRCULAR_OK,
  routes: results,
  totals: {
    routesChecked: results.length,
    nonCircularRounded: offendersTotal,
    imagesTotal: totalImgs,
    imagesBroken: totalBroken,
    imagesPending: totalPending,
    pageErrors: results.reduce((a, r) => a + r.pageErrors.length, 0),
    consoleErrors: results.reduce((a, r) => a + r.consoleErrors.length, 0),
    non200: non200.map((r) => `${r.route}:${r.status}`),
  },
  status: pass ? "PASS" : "FAIL",
};

const outDir = join(ROOT, "docs", "evidence");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "runtime-radius-check.json"),
  JSON.stringify(report, null, 2) + "\n",
  "utf8",
);

console.log(`RUNTIME RADIUS + RENDER SWEEP  (${BASE})`);
console.log("=".repeat(72));
console.log(`Excluded: ${CIRCULAR_OK} (circular by meaning, not brand chrome)`);
console.log(`Offender: painted box >= ${MIN_PAINTED_PX}x${MIN_PAINTED_PX}px with corner >= ${RADIUS_THRESHOLD_PX}px\n`);

for (const r of results) {
  const clean =
    r.nonCircularRounded === 0 &&
    r.imagesBroken === 0 &&
    r.status === 200 &&
    r.pageErrors.length === 0;
  const flag = clean ? "ok   " : "FAIL ";
  console.log(
    `[${flag}] ${r.route.padEnd(18)} status=${r.status} radius=${r.nonCircularRounded} broken=${r.imagesBroken} pending=${r.imagesPending} pageErr=${r.pageErrors.length}`,
  );
  for (const o of r.offenders) {
    console.log(`          -> <${o.tag}> ${o.radius}px  ${o.cls}`);
  }
}

console.log("=".repeat(72));
console.log(`routes checked     : ${results.length}`);
console.log(`non-circular radius : ${offendersTotal}`);
console.log(`images loaded      : ${totalImgs - totalBroken - totalPending}/${totalImgs} (pending ${totalPending}, broken ${totalBroken})`);
console.log(`page errors        : ${results.reduce((a, r) => a + r.pageErrors.length, 0)}`);
console.log(`non-200            : ${non200.length}`);
console.log(`\nRESULT: ${pass ? "PASS" : "FAIL"}`);
console.log(`wrote docs/evidence/runtime-radius-check.json`);

process.exit(pass ? 0 : 1);