// Build the social share card from the real brand assets.
//
// Why this exists
// ---------------
// The shipped `public/images/og.png` had three defects, none of which any
// check was looking for:
//
//   1. Its aspect ratio did not match what the metadata declared. The file is
//      1200x630 (1.905) and `app/layout.tsx` announced 1672x941 (1.778).
//      Facebook, LinkedIn and X lay the card out from the DECLARED size, so
//      every share of every page was rendered against the wrong ratio.
//   2. The wordmark was a green pill with "BEEPA" typed into it — a hand-drawn
//      stand-in, not the company's logo. It is the single largest brand element
//      on every shared link.
//   3. The footer read "People. Partnership. Progress." while BRAND.tagline is
//      "People. Process. Progress." Two spellings of the same slogan, one of
//      them baked into a raster that no code path could correct.
//
// The card is generated so those three cannot drift apart again: the logo is
// composited from `public/brand/`, the tagline is read from `lib/site.ts`, and
// `--check` re-renders and compares bytes.
//
// Usage:
//   node scripts/generate-og-image.mjs            # write public/images/og.png
//   node scripts/generate-og-image.mjs --check    # fail if it is stale

import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** The card is exactly the size the metadata promises. One source of truth. */
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Read the tagline and display name out of `lib/site.ts` rather than repeating
 * them. A slogan is exactly the string that drifts, because it is edited in one
 * place and baked into an image in another.
 */
function readBrand() {
  const src = readFileSync(join(ROOT, "lib/site.ts"), "utf8");
  const pick = (key) => {
    const m = new RegExp(`${key}:\\s*\\n?\\s*"([^"]+)"`).exec(src);
    if (!m) throw new Error(`generate-og-image: could not read ${key} from lib/site.ts`);
    return m[1];
  };
  return { tagline: pick("tagline"), displayName: pick("displayName") };
}

const { tagline, displayName } = readBrand();

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Left-hand scrim + typography. Rendered as an SVG and composited so the type
 * stays real text at output resolution instead of being pasted in from another
 * screenshot.
 */
function overlaySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#1f1c4f" stop-opacity="0.94"/>
      <stop offset="46%" stop-color="#1f1c4f" stop-opacity="0.72"/>
      <stop offset="72%" stop-color="#1f1c4f" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#1f1c4f" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#scrim)"/>

  <text x="72" y="286" font-family="Georgia, 'Times New Roman', serif" font-size="62"
        font-weight="700" fill="#ffffff" letter-spacing="-1">People power</text>
  <text x="72" y="356" font-family="Georgia, 'Times New Roman', serif" font-size="62"
        font-weight="700" fill="#93c63d" letter-spacing="-1">better business.</text>

  <rect x="72" y="404" width="64" height="4" fill="#93c63d"/>

  <text x="72" y="470" font-family="Georgia, 'Times New Roman', serif" font-size="27"
        fill="#ffffff" fill-opacity="0.86">${esc(tagline)}</text>

  <text x="72" y="524" font-family="Helvetica, Arial, sans-serif" font-size="21"
        fill="#ffffff" fill-opacity="0.62" letter-spacing="1.2">beepabpo.com</text>
</svg>`;
}

async function build() {
  const photo = join(ROOT, "public/images/hero/beepa-team-hero.png");
  const logoSrc = join(ROOT, "public/brand/beepa-logo-horizontal.png");

  // Crop the left 74% of the source before fitting.
  //
  // The photo is 5504x3072 with the team in the left two-thirds and a
  // blown-out window filling the right third. Cover-fitting the whole frame
  // into a 1.905 card left a third of the share image as empty white window
  // with nothing in it. Taking the left 74% first puts the people across the
  // whole card, and the scrim still owns the type area.
  const src = await sharp(photo).metadata();
  const cropped = Math.round(src.width * 0.74);

  const base = await sharp(photo)
    .extract({ left: 0, top: 0, width: cropped, height: src.height })
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  const scrim = await sharp(Buffer.from(overlaySvg())).png().toBuffer();

  // The real wordmark, white-backed so the navy type stays legible over the
  // dark scrim. Scaled to 300px wide, which keeps the tagline under it legible
  // at the size a share card is actually rendered.
  const logo = await sharp(logoSrc)
    .resize({ width: 300 })
    .png()
    .toBuffer();
  const logoMeta = await sharp(logo).metadata();

  const chip = await sharp({
    create: {
      width: logoMeta.width + 48,
      height: logoMeta.height + 40,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  }).png().toBuffer();

  const paddedLogo = await sharp(chip)
    .composite([{ input: logo, left: 24, top: 20 }])
    .png()
    .toBuffer();
  const chipMeta = await sharp(paddedLogo).metadata();

  return sharp(base)
    .composite([
      { input: scrim, left: 0, top: 0 },
      { input: paddedLogo, left: 72, top: 64 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const built = await build();
const out = join(ROOT, "public/images/og.png");

// Assert the rendered card is the size the metadata claims, so this script and
// app/layout.tsx cannot disagree again.
const meta = await sharp(built).metadata();
if (meta.width !== WIDTH || meta.height !== HEIGHT) {
  console.error(`og image rendered ${meta.width}x${meta.height}, expected ${WIDTH}x${HEIGHT}`);
  process.exit(1);
}

// Comments are stripped before matching. The first version of this check used a
// 80-character window between `url:` and `width:`, and the explanatory comment
// added to layout.tsx pushed `width:` past it — so the guard silently stopped
// checking and reported "nothing to cross-check" while a real mismatch existed.
// A guard that quietly degrades to a no-op is worse than no guard.
const layoutRaw = readFileSync(join(ROOT, "app/layout.tsx"), "utf8");
const layout = layoutRaw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split(/\r?\n/)
  .map((line) => {
    const i = line.indexOf("//");
    return i === -1 || line.slice(0, i).includes(":") ? line : line.slice(0, i);
  })
  .join("\n");

const declared = /url:\s*BRAND\.ogImageUrl,[\s\S]{0,120}?width:\s*(\d+),[\s\S]{0,60}?height:\s*(\d+)/.exec(layout);
if (declared) {
  const [dw, dh] = [Number(declared[1]), Number(declared[2])];
  if (dw !== meta.width || dh !== meta.height) {
    console.error(
      `\nREFUSING TO WRITE — app/layout.tsx declares ${dw}x${dh} but the card is ` +
        `${meta.width}x${meta.height}.\nSocial platforms lay the card out from the ` +
        `DECLARED size, so a mismatch crops every share. Fix the metadata or WIDTH/HEIGHT here.`,
    );
    process.exit(1);
  }
  console.log(`metadata agrees with the rendered card: ${dw}x${dh}`);
} else {
  console.error(
    "\nCANNOT CROSS-CHECK — no width/height found next to BRAND.ogImageUrl in " +
      "app/layout.tsx.\nThis script can no longer prove the declared size matches the card, " +
      "which is the whole point of the check. Fix the metadata shape or this script.",
  );
  process.exitCode = 1;
}

if (CHECK) {
  let current = null;
  try { current = readFileSync(out); } catch { /* missing */ }
  if (current && current.equals(built)) {
    console.log(`og image matches the brand assets (${built.length} bytes)`);
  } else {
    console.error("STALE (run without --check): public/images/og.png does not match the brand assets");
    process.exitCode = 1;
  }
} else {
  writeFileSync(out, built);
  console.log(
    `wrote public/images/og.png — ${meta.width}x${meta.height}, ${built.length} bytes\n` +
      `  photo      public/images/hero/beepa-team-hero.png\n` +
      `  wordmark   public/brand/beepa-logo-horizontal.png\n` +
      `  tagline    "${tagline}" (read from lib/site.ts)\n` +
      `  brand      ${displayName}`,
  );
}