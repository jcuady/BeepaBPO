// Apply the new landing-asset pack:
//   1. Convert all 17 PNGs to WebP (quality 82) via sharp.
//   2. Copy new assets to canonical public/images/ paths the components already import.
//   3. Regenerate public/images/og.png with hero + brand overlay.
//   4. Archive legacy Assets/ files to principal-system-finish-suite/_archive/.
//   5. Print a verification report.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..");
const SRC = resolve(ROOT, "principal-system-finish-suite/brandkit/landing-assets");
const HERO_DIR = resolve(ROOT, "public/images/hero");
const SECTIONS_DIR = resolve(ROOT, "public/images/sections");
const SERVICES_DIR = resolve(ROOT, "public/images/services");
const AUTH_DIR = resolve(ROOT, "public/images/auth");
const OG_PATH = resolve(ROOT, "public/images/og.png");
const ARCHIVE = resolve(ROOT, "principal-system-finish-suite/brandkit/landing-assets/_archive");

async function step(label, fn) {
  process.stdout.write(`→ ${label} ... `);
  try {
    const out = await fn();
    process.stdout.write(`OK${typeof out === "string" ? ` (${out})` : ""}\n`);
    return out;
  } catch (e) {
    process.stdout.write(`FAIL: ${e.message}\n`);
    throw e;
  }
}

async function main() {
  console.log("=== APPLY ASSET PACK ===\n");

  // ---------- 1. Convert PNG -> WebP at quality 82 ----------
  await step("Convert 17 PNGs to WebP (quality 82)", async () => {
    const fs = await import("node:fs/promises");
    const list = (await fs.readdir(SRC)).filter((f) => f.endsWith(".png")).sort();
    let count = 0;
    for (const f of list) {
      const src = resolve(SRC, f);
      const dst = resolve(SRC, f.replace(/\.png$/, ".webp"));
      await sharp(src).webp({ quality: 82, effort: 4 }).toFile(dst);
      count++;
    }
    return `${count} WebPs`;
  });

  // ---------- 2. Copy new assets to canonical public/images/ paths ----------
  await step("Copy 01-hero-main to public/images/hero/", async () => {
    copyFileSync(resolve(SRC, "01-hero-main.png"), resolve(HERO_DIR, "beepa-team-hero.png"));
    copyFileSync(resolve(SRC, "01-hero-main.webp"), resolve(HERO_DIR, "beepa-team-hero.webp"));
  });

  await step("Copy 03-why-beepa to public/images/sections/", async () => {
    copyFileSync(resolve(SRC, "03-why-beepa.png"), resolve(SECTIONS_DIR, "why-beepa-agent.png"));
    copyFileSync(resolve(SRC, "03-why-beepa.webp"), resolve(SECTIONS_DIR, "why-beepa-agent.webp"));
  });

  await step("Copy 04-careers-team to public/images/sections/", async () => {
    copyFileSync(resolve(SRC, "04-careers-team.png"), resolve(SECTIONS_DIR, "careers-team.png"));
    copyFileSync(resolve(SRC, "04-careers-team.webp"), resolve(SECTIONS_DIR, "careers-team.webp"));
  });

  await step("Copy 06-services-operations to public/images/services/", async () => {
    copyFileSync(resolve(SRC, "06-services-operations.png"), resolve(SERVICES_DIR, "customer-support-floor.png"));
    copyFileSync(resolve(SRC, "06-services-operations.webp"), resolve(SERVICES_DIR, "customer-support-floor.webp"));
  });

  // ---------- 3. Regenerate og.png (1200x630) ----------
  await step("Regenerate og.png (1200x630) with hero + brand overlay", async () => {
    const hero = resolve(SRC, "01-hero-main.png");
    const svgOverlay = `
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="rgba(31,32,88,0.9)"/>
      <stop offset="55%" stop-color="rgba(31,32,88,0.35)"/>
      <stop offset="100%" stop-color="rgba(31,32,88,0)"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="720" height="630" fill="url(#g)"/>
  <g font-family="Manrope, system-ui, sans-serif" fill="#ffffff">
    <text x="60" y="380" font-weight="700" font-size="62">People power</text>
    <text x="60" y="452" font-weight="700" font-size="62" fill="#93C63D">better business.</text>
  </g>
  <text x="60" y="540" font-family="Inter, system-ui, sans-serif" font-size="22" fill="rgba(255,255,255,0.85)">
    beepabpo.com — People. Partnership. Progress.
  </text>
  <g transform="translate(60, 60)">
    <rect x="0" y="0" width="120" height="34" rx="17" fill="#119446"/>
    <text x="60" y="22" text-anchor="middle" font-family="Inter, system-ui, sans-serif"
          font-weight="700" font-size="14" fill="#ffffff" letter-spacing="2">BEEPA</text>
  </g>
</svg>`;

    await sharp(hero)
      .resize(1200, 630, { fit: "cover", position: "right" })
      .composite([{ input: Buffer.from(svgOverlay), gravity: "northwest" }])
      .png({ quality: 90 })
      .toFile(OG_PATH);
  });

  // ---------- 4. Archive legacy Assets/ files ----------
  await step("Archive legacy Assets/ files (move, don't delete)", async () => {
    mkdirSync(ARCHIVE, { recursive: true });
    const fs = await import("node:fs/promises");
    const assetsDir = resolve(ROOT, "Assets");
    const legacy = [
      ["Heroimage.png", "Heroimage-legacy.png"],
      ["employee sign in.png", "employee-sign-in-legacy.png"],
      ["internal sign in image.png", "internal-sign-in-legacy.png"],
      ["section image.png", "section-image-legacy.png"],
      ["logo.png", "logo-legacy.png"],
      ["logo2.png", "logo2-legacy.png"],
    ];
    let moved = 0;
    for (const [from, to] of legacy) {
      const src = resolve(assetsDir, from);
      const dst = resolve(ARCHIVE, to);
      if (existsSync(src)) {
        await fs.rename(src, dst);
        moved++;
      }
    }
    return `${moved} moved`;
  });

  // ---------- 5. Verification report ----------
  console.log("\n=== VERIFICATION ===\n");

  const checks = [
    ["Source PNGs", resolve(SRC), /\.png$/],
    ["Source WebPs", resolve(SRC), /\.webp$/],
    ["Hero", resolve(HERO_DIR, "beepa-team-hero.png")],
    ["Hero WebP", resolve(HERO_DIR, "beepa-team-hero.webp")],
    ["Why-beepa", resolve(SECTIONS_DIR, "why-beepa-agent.png")],
    ["Why-beepa WebP", resolve(SECTIONS_DIR, "why-beepa-agent.webp")],
    ["Careers", resolve(SECTIONS_DIR, "careers-team.png")],
    ["Careers WebP", resolve(SECTIONS_DIR, "careers-team.webp")],
    ["Services", resolve(SERVICES_DIR, "customer-support-floor.png")],
    ["Services WebP", resolve(SERVICES_DIR, "customer-support-floor.webp")],
    ["OG", OG_PATH],
  ];

  for (const [label, path, file] of checks.flatMap(([l, p, r]) => {
    if (typeof p === "string" || p instanceof String) return [[l, p]];
    return [[l, p]];
  })) {
    // No-op — see proper loop below
  }

  for (const c of checks) {
    const [label, ...rest] = c;
    const path = rest[0];
    if (!path) continue;
    const exists = existsSync(path);
    const sz = exists ? statSync(path).size : 0;
    console.log(`  ${exists ? "✓" : "✗"} ${label.padEnd(18)} ${exists ? `${(sz / 1024).toFixed(0)} KB` : "MISSING"}`);
  }
}

main().catch((e) => { console.error("\nFATAL", e.message); process.exit(1); });