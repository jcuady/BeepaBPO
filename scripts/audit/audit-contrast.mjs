/**
 * Runtime text-contrast gate.
 *
 * Why this exists
 * ---------------
 * Every contrast number the project had was a number somebody typed by hand into
 * a document: "primary #008338 is 2.4:1 with white", "muted #5e6066 fails". A
 * hand-computed figure cannot see what the browser paints. It cannot see the
 * alpha on `bg-white/80`, the `opacity` on a wrapper, the ancestor that supplies
 * the real background, the font-size that decides whether 3:1 or 4.5:1 applies,
 * or the fact that the same token is used as a fill on one page and as body copy
 * on another.
 *
 * That gap is not theoretical. During the landing-page port the reference palette
 * was adopted verbatim, and the record claimed a set of pass/fail figures that
 * were derived from the source CSS rather than from any rendered page. Re-measuring
 * the live site is what surfaced the real failures — and it also showed the
 * pre-existing product palette failing in the same places, which is why this gate
 * covers marketing, auth and app surfaces together rather than just the new page.
 *
 * So this walks the real pages and measures the effective contrast of every
 * text-bearing element: compositing background-colors up the ancestor chain,
 * folding in alpha and group `opacity`, resolving the threshold from the computed
 * font-size and weight, and skipping the things WCAG itself exempts.
 *
 * What it deliberately does NOT do
 * --------------------------------
 * It does not guess at text painted over photography, gradients or absolutely
 * positioned siblings. Those are collected as `unresolved` with a reason and
 * printed, because silently dropping them is how a gate becomes a green light
 * for the cases it cannot see. They do not fail the run — an unverifiable case is
 * not a proven failure — but they are always listed so a human can look.
 *
 * Usage:  node scripts/audit/audit-contrast.mjs [baseUrl]
 * Exit 0 on pass, 1 on any proven failure.
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
  // The employee portal has its OWN auth shell (components/auth/employee-auth-shell.tsx),
  // which was a byte-for-byte copy of AuthShell's brand panel until both were
  // rebuilt. A copy is a second place for the bug to live, so it is swept here.
  "/employee/login",
  "/terms",
  "/privacy",
  "/app/dashboard",
];

// WCAG 2.2 SC 1.4.3 Contrast (Minimum), AA.
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

// WCAG defines large text as >= 24px, or >= 18.66px when bold.
const LARGE_PX = 24;
const LARGE_BOLD_PX = 18.66;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const results = [];

for (const route of ROUTES) {
  const pageErrors = [];
  const onErr = (e) => pageErrors.push(String(e).slice(0, 200));
  page.on("pageerror", onErr);

  const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  const status = resp ? resp.status() : 0;

  // Photographs on the page must be decoded before anything can be judged as
  // "text over an image", and lazy content must be on the page at all.
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => {
      i.loading = "eager";
    });
    await Promise.all(
      Array.from(document.images)
        .filter((i) => !i.complete)
        .map((i) => new Promise((r) => {
          i.addEventListener("load", r, { once: true });
          i.addEventListener("error", r, { once: true });
        })),
    );
    const h = document.body.scrollHeight;
    for (let y = 0; y < h; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
  await page.waitForLoadState("networkidle").catch(() => {});

  // Kill smooth scrolling for the rest of this route.
  //
  // The landing page sets `html:has(.beepaLanding) { scroll-behavior: smooth }`.
  // Playwright scrolls an element into view before clipping a screenshot, and
  // under smooth scrolling that scroll is still animating when the shutter
  // opens, so the shot is of the wrong part of the page. This produced a
  // confident, entirely fictional verdict: a white button with near-black text
  // was reported as near-black text on near-black at 1.02:1, because the region
  // that was actually photographed was somewhere else on the page entirely.
  await page.addStyleTag({ content: "html, body { scroll-behavior: auto !important; }" });

  const measured = await page.evaluate(
    ({ aaNormal, aaLarge, largePx, largeBoldPx }) => {
      /* ---------- colour maths, all in sRGB 0..1 ---------- */

      // Normalise ANY CSS colour syntax to sRGB by handing it to a canvas and
      // reading the pixel back. Chromium reports computed colours in whatever
      // space the token was authored in — the landing page's palette is
      // `oklch()`, so its computed values serialise as `lab(...)`, and
      // `color(display-p3 ...)` appears wherever a wide-gamut token is used.
      //
      // A regex parser handles only `rgb()`/`rgba()`, and the failure mode of
      // not handling the rest is silent: the element is skipped, the count goes
      // down, and the gate reports PASS while measuring almost nothing. That
      // is not hypothetical — a `lab()`-only parser reported "27 elements
      // measured" on the landing page and "1" once the real headings actually
      // adopted the reference palette, with no failure raised either time.
      // Anything the canvas cannot parse is recorded in `unparsedColours` and
      // fails the run.
      const normCanvas = document.createElement("canvas");
      normCanvas.width = normCanvas.height = 1;
      const nctx = normCanvas.getContext("2d", { willReadFrequently: true });
      const SENTINEL = "#010203";
      const colourCache = new Map();
      const unparsedColours = new Map();

      const parseColor = (str) => {
        if (!str) return null;
        if (colourCache.has(str)) return colourCache.get(str);
        nctx.clearRect(0, 0, 1, 1);
        nctx.fillStyle = SENTINEL;
        nctx.fillStyle = str; // an invalid value is ignored, leaving the sentinel
        const accepted = nctx.fillStyle;
        let out = null;
        if (accepted !== SENTINEL) {
          nctx.clearRect(0, 0, 1, 1);
          nctx.fillRect(0, 0, 1, 1);
          const d = nctx.getImageData(0, 0, 1, 1).data;
          out = { r: d[0] / 255, g: d[1] / 255, b: d[2] / 255, a: d[3] / 255 };
        } else {
          unparsedColours.set(str, (unparsedColours.get(str) || 0) + 1);
        }
        colourCache.set(str, out);
        return out;
      };

      const over = (fg, bg) => ({
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
        a: 1,
      });

      const lum = ({ r, g, b }) =>
        0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

      const ratio = (a, b) => {
        const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
        return (hi + 0.05) / (lo + 0.05);
      };

      const hex = ({ r, g, b }) =>
        "#" +
        [r, g, b]
          .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
          .join("");

      /* ---------- effective background ---------- */

      // Walk ancestors collecting background-colors until an opaque one is
      // found, then composite bottom-up. `background-image` on any ancestor is a
      // hard stop: a gradient cannot be sampled without knowing the box size and
      // the text offset within it.
      const effectiveBg = (el) => {
        const layers = [];
        let node = el;
        let imgAncestor = null;
        while (node && node.nodeType === 1) {
          const cs = getComputedStyle(node);
          if (cs.backgroundImage && cs.backgroundImage !== "none") {
            imgAncestor = "background-image";
            break;
          }
          const bc = parseColor(cs.backgroundColor);
          if (bc && bc.a > 0) {
            layers.push(bc);
            if (bc.a >= 0.999) break;
          }
          node = node.parentElement;
        }

        let bg = layers.length ? layers[layers.length - 1] : { r: 1, g: 1, b: 1, a: 1 };
        if (layers.length && layers[layers.length - 1].a < 0.999) {
          // Nothing opaque below it: fall back to the canvas, which is white
          // because `color-scheme: light` and `body { bg-background }`.
          bg = over(bg, { r: 1, g: 1, b: 1, a: 1 });
        }
        for (let i = layers.length - 2; i >= 0; i--) bg = over(layers[i], bg);
        return { bg, blockedBy: imgAncestor };
      };

      // A painted <img> or <video> underneath the text defeats the ancestor walk
      // entirely. Detect it geometrically — against the TEXT, not the element box.
      //
      // The distinction is not cosmetic. The landing page's "why Beepa" headline
      // sets a small portrait INLINE inside the h2, so the heading's bounding box
      // contains a photo while not one glyph of the heading is printed on it. A
      // box-level test sends that heading down the pixel-sampling path, where it
      // is judged against a photograph it never touched. Range.getClientRects()
      // returns the rectangles the glyphs actually occupy, which is the thing
      // whose legibility is in question.
      const photoBehind = (rects) => {
        const media = [...document.querySelectorAll("img, video, picture")];
        for (const r of rects) {
          for (const n of media) {
            const m = n.getBoundingClientRect();
            if (m.width < 2 || m.height < 2) continue;
            const inter =
              Math.min(r.right, m.right) - Math.max(r.left, m.left) > 2 &&
              Math.min(r.bottom, m.bottom) - Math.max(r.top, m.top) > 2;
            if (inter) return "over-photo";
          }
        }
        return null;
      };

      // Client rects of the element's own text runs, in viewport coordinates.
      const textRects = (el) => {
        const out = [];
        const range = document.createRange();
        for (const n of el.childNodes) {
          if (n.nodeType !== 3 || !n.textContent.trim()) continue;
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) {
            if (r.width > 1 && r.height > 1) out.push(r);
          }
        }
        return out;
      };

      // Group opacity: an ancestor with `opacity: .6` fades the glyph toward
      // whatever is behind the group, so it has to be folded in.
      const groupOpacity = (el) => {
        let o = 1;
        let node = el;
        while (node && node.nodeType === 1) {
          const cs = getComputedStyle(node);
          o *= parseFloat(cs.opacity);
          if (o <= 0.01) return 0;
          node = node.parentElement;
        }
        return o;
      };

      const pathOf = (el) => {
        const parts = [];
        let n = el;
        for (let i = 0; n && n.nodeType === 1 && i < 4; i++) {
          let s = n.tagName.toLowerCase();
          if (n.id) {
            s += "#" + n.id;
            parts.unshift(s);
            break;
          }
          const cls = (n.getAttribute("class") || "")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .join(".");
          if (cls) s += "." + cls;
          parts.unshift(s);
          n = n.parentElement;
        }
        return parts.join(" > ");
      };

      const directText = (el) =>
        Array.from(el.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim())
          .join(" ")
          .trim();

      const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "HEAD", "META", "LINK"]);
      // WCAG exempts these outright.
      const exempt = (el) =>
        el.closest('[disabled], [aria-disabled="true"], [data-contrast-exempt]') !== null;

      const failures = [];
      const unresolved = [];
      let checked = 0;
      let skippedTiny = 0;
      let skippedExempt = 0;

      for (const el of document.querySelectorAll("*")) {
        if (SKIP_TAGS.has(el.tagName)) continue;
        if (el.closest("[aria-hidden='true']")) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;

        const txt = directText(el);
        if (!txt) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) {
          skippedTiny++;
          continue;
        }
        if (exempt(el)) {
          skippedExempt++;
          continue;
        }

        const cs = getComputedStyle(el);
        const fg = parseColor(cs.color);
        if (!fg) continue;

        const opacity = groupOpacity(el);
        if (opacity <= 0.01) continue; // invisible mid-animation; nothing to read

        const { bg, blockedBy } = effectiveBg(el);
        const rects = textRects(el);
        const photo = rects.length ? photoBehind(rects) : null;

        const fontPx = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const isLarge =
          fontPx >= largePx || (weight >= 700 && fontPx >= largeBoldPx);
        const need = isLarge ? aaLarge : aaNormal;

        if (blockedBy || photo) {
          // Tag it so the Node side can scroll to it, screenshot exactly the
          // rectangles the glyphs occupy, and sample real pixels behind them.
          // A data attribute is the only handle that survives the evaluate()
          // boundary — element references do not. The rects are re-read after
          // scrolling, because the ones captured here are viewport-relative to
          // wherever the page happened to be sitting.
          el.setAttribute("data-contrast-probe", String(unresolved.length));
          unresolved.push({
            id: unresolved.length,
            path: pathOf(el),
            reason: blockedBy || photo,
            fg: hex(fg),
            fgRgb: [fg.r, fg.g, fg.b],
            sample: txt.slice(0, 60),
            fontPx: Math.round(fontPx * 10) / 10,
            weight,
            need,
            sizeClass: isLarge ? "large" : "normal",
            textRects: rects.length,
          });
          continue;
        }

        // Fold alpha and group opacity into the glyph before measuring.
        const effectiveFg =
          opacity < 1 ? over({ ...fg, a: fg.a * opacity }, bg) : over(fg, bg);

        const r = ratio(effectiveFg, bg);
        checked++;

        if (r < need) {
          failures.push({
            path: pathOf(el),
            tag: el.tagName.toLowerCase(),
            fg: hex(effectiveFg),
            bg: hex(bg),
            ratio: Math.round(r * 100) / 100,
            need,
            fontPx: Math.round(fontPx * 10) / 10,
            weight,
            opacity: Math.round(opacity * 100) / 100,
            sample: txt.slice(0, 60),
          });
        }
      }

      return {
        failures,
        unresolved,
        checked,
        skippedTiny,
        skippedExempt,
        unparsed: [...unparsedColours.entries()].map(([colour, n]) => ({ colour, n })),
        title: document.title,
      };
    },
    { aaNormal: AA_NORMAL, aaLarge: AA_LARGE, largePx: LARGE_PX, largeBoldPx: LARGE_BOLD_PX },
  );

  // ---- Text painted over photography / gradients -------------------------
  //
  // These cannot be resolved by walking the DOM, because what is behind the
  // glyph is pixels, not a background-colour. So measure the pixels — but take
  // the backdrop from a screenshot with the text made transparent, rather than
  // trying to recognise backdrop pixels inside a shot that still has the text
  // in it.
  //
  // The heuristic version of this (keep every pixel far from the foreground
  // colour, discard the rest) is wrong, and it was wrong in a way that produced
  // confident nonsense: antialiased glyph edges sit well away from the pure
  // foreground colour, so they survived the filter, were treated as backdrop,
  // and every case came back at 1.00:1 — a number no real text/backdrop pair
  // produces. Colour is not a layout property, so hiding the glyphs and
  // re-shooting gives the exact backdrop with no guesswork at all.
  //
  // The clip is the TEXT's rectangles, not the element's box. They differ on
  // any element that is wider than its text, which is most of them.
  const MAX_RECTS = 8;
  const sampled = [];
  for (const u of measured.unresolved) {
    const loc = page.locator(`[data-contrast-probe="${u.id}"]`);
    if ((await loc.count()) === 0) continue;

    try {
      await loc.scrollIntoViewIfNeeded({ timeout: 8000 });

      // Re-read the glyph rectangles at the current scroll position.
      const rects = await page.evaluate((id) => {
        const el = document.querySelector(`[data-contrast-probe="${id}"]`);
        if (!el) return [];
        const range = document.createRange();
        const out = [];
        for (const n of el.childNodes) {
          if (n.nodeType !== 3 || !n.textContent.trim()) continue;
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) {
            if (r.width > 1 && r.height > 1) {
              out.push({ x: r.x, y: r.y, width: r.width, height: r.height });
            }
          }
        }
        return out;
      }, u.id);

      if (!rects.length) {
        sampled.push({ ...u, sampled: false, note: "no glyph rectangles" });
        continue;
      }

      // Make every glyph in the element invisible — the element and all its
      // descendants, because inline children carry their own colour.
      await page.evaluate((id) => {
        const el = document.querySelector(`[data-contrast-probe="${id}"]`);
        if (!el) return;
        for (const n of [el, ...el.querySelectorAll("*")]) {
          n.style.setProperty("color", "transparent", "important");
          n.style.setProperty("text-shadow", "none", "important");
          n.style.setProperty("-webkit-text-fill-color", "transparent", "important");
        }
      }, u.id);

      let min = Infinity;
      let worst = null;
      let totalPixels = 0;
      let clipped = 0;

      for (const r of rects.slice(0, MAX_RECTS)) {
        // `page.screenshot` clips in CSS pixels; grow by a pixel each way so a
        // subpixel boundary cannot leave the glyph's own background outside.
        const clip = {
          x: Math.max(0, r.x - 1),
          y: Math.max(0, r.y - 1),
          width: r.width + 2,
          height: r.height + 2,
        };
        let shot;
        try {
          shot = await page.screenshot({ clip, scale: "css", animations: "disabled" });
        } catch {
          continue;
        }
        clipped++;

        // Decode inside the browser with a canvas, which keeps the gate
        // dependency-free rather than pulling a PNG decoder in for one number.
        const stats = await page.evaluate(
          async ({ b64, fg }) => {
            const img = new Image();
            img.src = "data:image/png;base64," + b64;
            await img.decode();
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const g = c.getContext("2d", { willReadFrequently: true });
            g.drawImage(img, 0, 0);
            const d = g.getImageData(0, 0, c.width, c.height).data;

            const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
            const L = (r2, g2, b2) => 0.2126 * lin(r2) + 0.7152 * lin(g2) + 0.0722 * lin(b2);
            const lf = L(fg[0], fg[1], fg[2]);
            const ratio = (l) => (Math.max(l, lf) + 0.05) / (Math.min(l, lf) + 0.05);

            // Every pixel here is backdrop, so the minimum is the real answer:
            // it is the worst thing the text could be printed on. A scrim that
            // only works for most crops of a photograph is not a guarantee, and
            // the photo can be swapped without anyone re-running a review.
            let lo = Infinity;
            let loPx = null;
            let n = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] < 250) continue;
              n++;
              const rr = ratio(L(d[i] / 255, d[1] / 255, d[2] / 255));
              if (rr < lo) {
                lo = rr;
                loPx = [d[i], d[1], d[2]];
              }
            }
            return { min: n ? Math.round(lo * 100) / 100 : null, worst: loPx, pixels: n };
          },
          { b64: shot.toString("base64"), fg: u.fgRgb },
        );

        totalPixels += stats.pixels;
        if (stats.min !== null && stats.min < min) {
          min = stats.min;
          worst = stats.worst;
        }
      }

      if (!clipped) {
        sampled.push({ ...u, sampled: false, note: "no clip succeeded" });
        continue;
      }

      sampled.push({
        ...u,
        sampled: true,
        ratio: min === Infinity ? null : min,
        need: u.need,
        pass: min !== Infinity && min >= u.need,
        worstPixel: worst,
        clips: clipped,
        rectsAvailable: rects.length,
        pixels: totalPixels,
      });
    } catch {
      sampled.push({ ...u, sampled: false, note: "probe failed" });
    } finally {
      await page
        .evaluate((id) => {
          const el = document.querySelector(`[data-contrast-probe="${id}"]`);
          if (!el) return;
          for (const n of [el, ...el.querySelectorAll("*")]) {
            n.style.removeProperty("color");
            n.style.removeProperty("text-shadow");
            n.style.removeProperty("-webkit-text-fill-color");
          }
        }, u.id)
        .catch(() => {});
    }
  }
  if (measured.unresolved.length) {
    await page
      .evaluate(() =>
        document
          .querySelectorAll("[data-contrast-probe]")
          .forEach((n) => n.removeAttribute("data-contrast-probe")),
      )
      .catch(() => {});
  }

  results.push({
    route,
    status,
    pageErrors,
    failures: sampled.filter((s) => s.sampled && !s.pass),
    unresolved: sampled.filter((s) => !s.sampled),
    checked: measured.checked,
    skippedExempt: measured.skippedExempt,
    overPhoto: sampled.filter((s) => s.sampled && s.pass),
    unparsed: measured.unparsed,
  });
  page.off("pageerror", onErr);
}

await browser.close();

/* ---------- collapse to actionable signatures ---------- */

// 400 offenders that are one token misused in 40 places is one bug, not 40.
// Group by (fg, bg, threshold, size class) and keep one representative element.
//
// DOM-resolved failures carry a composited `bg`. Photo-sampled failures carry
// `worstPixel` instead, so normalise here — otherwise every over-photo case
// collapses into one `undefined` group and the report names a colour that does
// not exist.
const bgOf = (f) =>
  f.bg ??
  (Array.isArray(f.worstPixel)
    ? "#" + f.worstPixel.map((v) => v.toString(16).padStart(2, "0")).join("")
    : "?");
const sourceOf = (f) => (f.bg ? "dom" : "pixels");

const bySignature = new Map();
for (const r of results) {
  for (const f of r.failures) {
    const key = `${f.fg}|${bgOf(f)}|${f.need}|${f.fontPx >= 24 || f.weight >= 700 ? "large" : "normal"}`;
    const e = bySignature.get(key);
    if (e) {
      e.count++;
      e.routes.add(r.route);
      if (e.count === 2) e.alsoSamples.push(f.sample);
    } else {
      bySignature.set(key, {
        fg: f.fg,
        bg: bgOf(f),
        source: sourceOf(f),
        need: f.need,
        ratio: f.ratio,
        fontPx: f.fontPx,
        weight: f.weight,
        sizeClass: f.fontPx >= 24 || f.weight >= 700 ? "large" : "normal",
        count: 1,
        routes: new Set([r.route]),
        path: f.path,
        sample: f.sample,
        alsoSamples: [],
      });
    }
  }
}

const signatures = [...bySignature.values()]
  .map((s) => ({ ...s, routes: [...s.routes] }))
  .sort((a, b) => a.ratio - b.ratio);

const totalChecked = results.reduce((a, r) => a + r.checked, 0);
const totalFailures = results.reduce((a, r) => a + r.failures.length, 0);
const totalUnresolved = results.reduce((a, r) => a + r.unresolved.length, 0);
const totalOverPhoto = results.reduce((a, r) => a + r.overPhoto.length, 0);
const non200 = results.filter((r) => r.status !== 200);
const unparsedTotal = results.reduce((a, r) => a + r.unparsed.length, 0);

// A gate that measured nothing is not a pass. This is the assertion that stops
// "0 failures" from ever meaning "0 elements found". The over-photo side needs
// its own version: a screenshot step that silently fails would report zero
// failures for text the gate never actually looked at.
//
// The third one is the same idea for the colour parser. An element whose colour
// the gate cannot read is not a pass — it is a blind spot, and the previous
// version of this file had exactly one: a regex that handled `rgb()` only,
// silently skipping the landing page's entire oklch palette.
const vacuous = totalChecked === 0;
const probes = results.reduce((a, r) => a + r.overPhoto.length + r.failures.length, 0);

const pass =
  !vacuous && unparsedTotal === 0 && totalFailures === 0 && totalUnresolved === 0 &&
  non200.length === 0 && results.every((r) => r.pageErrors.length === 0);

const report = {
  check: "contrast",
  generatedAt: new Date().toISOString(),
  base: BASE,
  standard: "WCAG 2.2 SC 1.4.3 (AA)",
  thresholds: { normal: AA_NORMAL, large: AA_LARGE },
  routes: results.map((r) => ({
    route: r.route,
    status: r.status,
    checked: r.checked,
    failures: r.failures.length,
    overPhotoSampled: r.overPhoto.length,
    unresolved: r.unresolved.length,
    skippedExempt: r.skippedExempt,
    pageErrors: r.pageErrors,
  })),
  signatures,
  totals: {
    routesChecked: results.length,
    elementsMeasured: totalChecked,
    overPhotoProbes: probes,
    overPhotoResolved: totalOverPhoto,
    failures: totalFailures,
    distinctSignatures: signatures.length,
    unresolved: totalUnresolved,
    unparsedColours: results.flatMap((r) => r.unparsed.map((u) => ({ route: r.route, ...u }))),
    non200: non200.map((r) => `${r.route}:${r.status}`),
  },
  status: pass ? "PASS" : "FAIL",
};

const outDir = join(ROOT, "docs", "evidence");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "contrast-check.json"),
  JSON.stringify(report, null, 2) + "\n",
  "utf8",
);

console.log(`TEXT CONTRAST  (${BASE})`);
console.log("=".repeat(78));
console.log(`Standard: WCAG 2.2 SC 1.4.3 AA — ${AA_NORMAL}:1 normal, ${AA_LARGE}:1 large (>=24px, or >=18.66px bold)\n`);

for (const r of results) {
  // The per-route flag must include the blind-spot count. When this was first
  // written it did not, and the mutated run printed `[ok]` on all fourteen
  // routes directly above `UNREADABLE COLOURS (37)` and `RESULT: FAIL` — a
  // report whose line and its verdict disagree is worse than no report, because
  // the eye reads the fourteen `ok`s and stops.
  const clean =
    r.failures.length === 0 && r.status === 200 && r.unparsed.length === 0;
  const flag = clean ? "ok   " : "FAIL ";
  console.log(
    `[${flag}] ${r.route.padEnd(18)} status=${r.status} dom=${String(r.checked).padStart(4)} photo=${String(r.overPhoto.length + r.failures.length).padStart(3)} fail=${String(r.failures.length).padStart(3)}${r.unparsed.length ? ` unreadable=${r.unparsed.length}` : ""}`,
  );
}

console.log("\n" + "-".repeat(78));
console.log(`DISTINCT FAILURES (${signatures.length} signatures, ${totalFailures} elements)\n`);
for (const s of signatures) {
  console.log(
    `  ${s.ratio.toFixed(2)}:1  (needs ${s.need})  ${s.fg} on ${s.bg}  ${s.sizeClass} ${s.fontPx}px/${s.weight}  x${s.count}  [${s.source}]`,
  );
  console.log(`      routes : ${s.routes.join(", ")}`);
  console.log(`      element: ${s.path}`);
  console.log(`      text   : "${s.sample}"`);
  if (s.alsoSamples.length) console.log(`      also   : ${s.alsoSamples.map((x) => `"${x}"`).join(", ")}`);
  console.log("");
}

if (totalUnresolved) {
  const reasons = {};
  for (const r of results) for (const u of r.unresolved) reasons[u.reason] = (reasons[u.reason] || 0) + 1;
  console.log(`UNRESOLVED — not counted as passes (${totalUnresolved}):`);
  for (const [k, v] of Object.entries(reasons)) console.log(`  ${k}: ${v}`);
  console.log("");
}

if (unparsedTotal) {
  console.log(`UNREADABLE COLOURS — the gate could not resolve these (${unparsedTotal}):`);
  for (const r of results) {
    for (const u of r.unparsed) console.log(`  ${r.route}: ${u.colour} (x${u.n})`);
  }
  console.log("");
}

console.log("=".repeat(78));
console.log(`elements measured (DOM)  : ${totalChecked}`);
console.log(`over-photo probes       : ${probes} (${totalOverPhoto} resolved and passing, ${totalUnresolved} unresolved)`);
console.log(`proven failures         : ${totalFailures}`);
console.log(`unreadable colours      : ${unparsedTotal}`);
console.log(`non-200                 : ${non200.length}`);
if (vacuous) console.log("VACUOUS           : no text elements were measured — gate is meaningless");
console.log(`\nRESULT: ${pass ? "PASS" : "FAIL"}`);
console.log(`wrote docs/evidence/contrast-check.json`);

process.exit(pass ? 0 : 1);