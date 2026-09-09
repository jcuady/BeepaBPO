/* Deep animation QA — live samples, install check, reduced-motion, conflicts */
const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const OUT = "e2e-evidence/anim-qa";
const BASE = "http://localhost:3000";

function pkgOk() {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const lockHas = fs.readFileSync("pnpm-lock.yaml", "utf8").includes("gsap@");
  const mod = fs.existsSync("node_modules/gsap/package.json");
  const gsapPkg = mod
    ? JSON.parse(fs.readFileSync("node_modules/gsap/package.json", "utf8"))
    : null;
  const hasScrollTrigger = fs.existsSync(
    "node_modules/gsap/ScrollTrigger.js",
  );
  return {
    dep: pkg.dependencies?.gsap || null,
    lockHas,
    mod,
    version: gsapPkg?.version || null,
    hasScrollTrigger,
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const install = pkgOk();

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    // Explicitly allow motion so we don't false-fail on OS preference
    reducedMotion: "no-preference",
  });

  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("[data-hero='title']", { timeout: 20000 });

  // ---- HERO: sample mid-entrance (reload + sample early) ----
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-hero='title']");
  // Sample at ~100ms and ~400ms and ~2000ms after hydration
  const heroSamples = [];
  for (const wait of [80, 250, 600, 1800]) {
    await page.waitForTimeout(wait === 80 ? 80 : wait - (heroSamples.length ? [80, 250, 600, 1800][heroSamples.length - 1] : 0));
    const sample = await page.evaluate(() => {
      const els = [...document.querySelectorAll("[data-hero]")];
      return {
        t: performance.now(),
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        gsapLoaded: typeof window.gsap !== "undefined", // won't be global
        items: els.map((el) => {
          const s = getComputedStyle(el);
          const m = new DOMMatrixReadOnly(s.transform);
          return {
            key: el.getAttribute("data-hero"),
            opacity: Number(s.opacity),
            ty: Math.round(m.m42),
            hasInline: !!el.getAttribute("style"),
            style: el.getAttribute("style") || "",
          };
        }),
      };
    });
    heroSamples.push(sample);
  }

  // Detect whether ANY mid-sample showed opacity < 1 (proves from() ran)
  const heroAnimated =
    heroSamples.some((s) => s.items.some((i) => i.opacity < 0.99 || i.ty !== 0)) &&
    heroSamples[heroSamples.length - 1].items.every((i) => i.opacity > 0.99);

  // ---- MARQUEE ----
  const marquee = await page.evaluate(() => {
    const track = document.querySelector(".trust-marquee-track");
    if (!track) return { found: false };
    const s = getComputedStyle(track);
    const m1 = new DOMMatrixReadOnly(s.transform).m41;
    return {
      found: true,
      animationName: s.animationName,
      duration: s.animationDuration,
      playState: s.animationPlayState,
      transform1: m1,
    };
  });
  await page.waitForTimeout(900);
  const marquee2 = await page.evaluate(() => {
    const track = document.querySelector(".trust-marquee-track");
    const s = getComputedStyle(track);
    return {
      transform2: new DOMMatrixReadOnly(s.transform).m41,
      playState: s.animationPlayState,
    };
  });
  // Hover must NOT pause (button-only pause)
  await page.locator(".trust-marquee-mask").hover();
  await page.waitForTimeout(250);
  const hoverPlayState = await page.evaluate(
    () => getComputedStyle(document.querySelector(".trust-marquee-track")).animationPlayState,
  );
  const marquee3 = await page.evaluate(() => {
    const track = document.querySelector(".trust-marquee-track");
    return new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
  });
  await page.waitForTimeout(700);
  const marquee4 = await page.evaluate(() => {
    const track = document.querySelector(".trust-marquee-track");
    return new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
  });

  const marqueeMoving =
    marquee.found &&
    marquee.animationName.includes("trust-marquee") &&
    Math.abs(marquee2.transform2 - marquee.transform1) > 5;
  const marqueeIgnoresHover =
    hoverPlayState === "running" && Math.abs(marquee4 - marquee3) > 5;

  // ---- REVEAL ----
  // Scroll to services; check .reveal get is-visible and leave opacity 0 traps
  await page.evaluate(() => {
    document.querySelector("#services")?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(1200);
  const reveal = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".reveal")];
    return {
      count: nodes.length,
      visible: nodes.filter((n) => n.classList.contains("is-visible")).length,
      stuckInvisible: nodes
        .filter((n) => {
          const s = getComputedStyle(n);
          return (
            !n.classList.contains("is-visible") && Number(s.opacity) < 0.05
          );
        })
        .map((n) => ({
          text: (n.textContent || "").slice(0, 40),
          top: Math.round(n.getBoundingClientRect().top),
          height: Math.round(n.getBoundingClientRect().height),
        })),
      inViewNotVisible: nodes
        .filter((n) => {
          const r = n.getBoundingClientRect();
          const inView = r.top < innerHeight * 0.85 && r.bottom > 0;
          return inView && !n.classList.contains("is-visible");
        })
        .map((n) => (n.textContent || "").slice(0, 40)),
    };
  });

  // ---- PROCESS / SCROLLTRIGGER ----
  const processDiag = await page.evaluate(() => {
    const section = [...document.querySelectorAll("section")].find((s) =>
      s.textContent?.includes("A clear path"),
    );
    if (!section) return { found: false };
    const track = section.querySelector(".flex");
    // find the track ref: first flex child of mt-12 container
    const viewport = section.querySelector(".mt-12, .md\\:mt-14") || section.querySelector("[class*='mt-12']");
    const trackEl = viewport?.firstElementChild;
    const cs = trackEl ? getComputedStyle(trackEl) : null;
    return {
      found: true,
      flexWrap: cs?.flexWrap,
      flexDirection: cs?.flexDirection,
      className: trackEl?.className || null,
      scrollWidth: trackEl?.scrollWidth,
      clientWidth: trackEl?.clientWidth,
      distance: trackEl ? trackEl.scrollWidth - trackEl.clientWidth : null,
      hasNowrap: trackEl?.classList.contains("flex-nowrap") || false,
      hasWrapUtility: trackEl?.className.includes("flex-wrap") || false,
      pinSpacer: !!section.closest(".pin-spacer"),
      ScrollTriggerCount:
        window.ScrollTrigger?.getAll?.()?.length ?? "no-global",
    };
  });

  // Scroll into process and sample pin
  await page.evaluate(() => {
    [...document.querySelectorAll("section")]
      .find((s) => s.textContent?.includes("A clear path"))
      ?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(500);

  const pinSamples = [];
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 450);
    await page.waitForTimeout(500);
    pinSamples.push(
      await page.evaluate(() => {
        const section = [...document.querySelectorAll("section")].find((s) =>
          s.textContent?.includes("A clear path"),
        );
        const viewport = section?.querySelector(".mt-12");
        const track = viewport?.firstElementChild;
        const x = track
          ? new DOMMatrixReadOnly(getComputedStyle(track).transform).m41
          : 0;
        return {
          top: Math.round(section.getBoundingClientRect().top),
          x: Math.round(x),
          pinned: !!section.closest(".pin-spacer"),
          flexWrap: track ? getComputedStyle(track).flexWrap : null,
          nowrapClass: track?.classList.contains("flex-nowrap"),
          distance: track ? track.scrollWidth - track.clientWidth : null,
        };
      }),
    );
  }

  const flexWrapOk = pinSamples.every(
    (s) => !s.flexWrap || s.flexWrap === "nowrap",
  );
  const pinWorks =
    pinSamples.some((s) => s.pinned) &&
    pinSamples.some((s) => s.x < -80) &&
    pinSamples.filter((s) => Math.abs(s.top) < 6).length >= 2 &&
    flexWrapOk;

  // ---- Reduced motion pass ----
  const rm = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await rm.goto(BASE, { waitUntil: "domcontentloaded" });
  await rm.waitForSelector("[data-hero='title']");
  await rm.waitForTimeout(500);
  const reduced = await rm.evaluate(() => {
    const heroOk = [...document.querySelectorAll("[data-hero]")].every(
      (el) => Number(getComputedStyle(el).opacity) > 0.99,
    );
    const track = document.querySelector(".trust-marquee-track");
    const anim = track ? getComputedStyle(track).animationName : null;
    const reveals = [...document.querySelectorAll(".reveal")];
    // Under reduce, .reveal should NOT force opacity 0 (media query gated)
    const revealOpacityOk = reveals.every(
      (n) => Number(getComputedStyle(n).opacity) > 0.99,
    );
    return { heroOk, marqueeAnim: anim, revealOpacityOk, revealCount: reveals.length };
  });
  await rm.close();

  // Bundle check: can the page import gsap? (via evaluating module graph from hero timeline presence)
  const gsapRuntime = await page.evaluate(() => {
    // Look for GSAP-applied inline transforms shortly after load is done
    const media = document.querySelector("[data-hero='media']");
    return {
      mediaOpacity: media ? Number(getComputedStyle(media).opacity) : null,
      // GSAP leaves nothing after complete usually; check _gsap
      hasGsapCache: !!(media && media._gsap),
    };
  });

  await page.screenshot({ path: path.join(OUT, "process.png") });

  const result = {
    install,
    consoleErrors,
    hero: {
      animated: heroAnimated,
      samples: heroSamples.map((s) => ({
        items: s.items.map((i) => ({
          key: i.key,
          opacity: i.opacity,
          ty: i.ty,
          hasInline: i.hasInline,
        })),
      })),
    },
    marquee: {
      ...marquee,
      ...marquee2,
      hoverPlayState,
      moving: marqueeMoving,
      ignoresHover: marqueeIgnoresHover,
    },
    reveal,
    process: { initial: processDiag, pinSamples, pinWorks },
    reduced,
    gsapRuntime,
    verdict: {
      installOk:
        !!install.dep && install.mod && install.hasScrollTrigger && !!install.version,
      heroOk: heroAnimated,
      marqueeOk: marqueeMoving && marqueeIgnoresHover,
      revealOk: reveal.inViewNotVisible.length === 0,
      processOk: pinWorks,
      reducedOk: reduced.heroOk && reduced.revealOpacityOk,
      consoleClean: consoleErrors.length === 0,
    },
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();

  const v = result.verdict;
  const pass =
    v.installOk &&
    v.heroOk &&
    v.marqueeOk &&
    v.revealOk &&
    v.processOk &&
    v.reducedOk &&
    v.consoleClean;
  process.exit(pass ? 0 : 2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
