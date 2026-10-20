// Generate the careers hero image: the AI artwork with the REAL Beepa logo
// embroidered onto the polo.
//
// Why this exists
// ---------------
// The careers hero needed a photograph in the same language as the landing
// hero: a Filipino BPO specialist in a Beepa uniform, headset on, bright
// office, direct gaze. That artwork was produced by the image generator, and
// the generator cannot draw a logo. Asked for a branded polo it produces
// marks that look like a logo and are not one -- and a brand mark is the one
// thing on this site that must never be an approximation.
//
// So the division of labour is deliberate:
//
//   * the GENERATOR paints the scene and the plain navy polo;
//   * this script prints the company's actual artwork onto that polo, cut from
//     `public/brand/beepa-logo-horizontal.png` -- the same file the header,
//     the footer and the OG card are built from.
//
// The result is a committed derivative with a `--check` mode, exactly like
// `scripts/generate-brand-icons.mjs`. If the brand file changes, the shipped
// hero is stale and the gate says so.
//
// Two details that are load-bearing, and were wrong in the first attempt:
//
//  1. The wordmark is RE-COLOURED TO WHITE, not to the master's navy. The
//     master is navy because it is printed on white paper. On navy fabric a
//     navy wordmark is invisible; the landing's own uniform photo carries the
//     wordmark in white, and that is what an embroidered chest logo is.
//     Only the RGB changes -- the alpha channel, and therefore the letterforms
//     and their antialiasing, are the master's own pixels.
//
//  2. The lockup is COMPACT. The master file is a signature: mark, a wide
//     gap, wordmark, tagline. A chest logo has no tagline and no room for a
//     wide gap, and the landing's uniform photo shows a tight lockup. The gap
//     is a layout constant of this script, not artwork -- the mark and the
//     wordmark are still the master's own pixels, scaled together.
//
// Usage:
//   node scripts/generate-careers-hero.mjs            # write the hero
//   node scripts/generate-careers-hero.mjs --check    # fail if it is stale

import sharp from "sharp";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** The generated artwork, before any branding. */
const SOURCE = join(
  ROOT,
  "principal-system-finish-suite/brandkit/landing-assets/18-careers-hero-specialist.webp",
);
/** The company's real lockup. */
const BRAND = join(ROOT, "public/brand/beepa-logo-horizontal.png");
/** The shipped hero. */
const OUT = join(ROOT, "public/images/landing/careers-hero.webp");

/**
 * The artwork is 3584x4800 (3:4). The shipped crop is 4:5, the same aspect as
 * the landing hero's own source (`beepa-specialist.jpg` is 928x1152), so both
 * heroes crop identically under the same `object-fit: cover` +
 * `object-position: 50% 45%` and cannot drift apart visually.
 *
 * `top` is art direction, not arithmetic: it sets how much ceiling is left
 * above the subject. Too high and the head is cropped by the short, wide
 * mobile hero; too low and the frame is mostly ceiling.
 */
const CROP = { left: 360, top: 300, width: 2864, height: 3580 };

/**
 * The round portrait used in the hero's foot strip.
 *
 * Cut from the same composed hero, so it is the same person in the same
 * photograph — the foot strip must not introduce a second face that appears
 * nowhere else on the page.
 */
const PORTRAIT = { left: 1196, top: 1010, size: 660, out: 320 };

/**
 * The master's own geometry, measured from `public/brand/beepa-logo-horizontal.png`
 * (1600x505) by alpha coverage -- not eyeballed:
 *
 *   mark     x 60-424    y 75-453   two overlapping rounded squares
 *   wordmark x 500-1535  y 71-314   "BEEPA" in navy
 *   tagline  y 404-439   EXCLUDED -- a chest logo has no tagline
 */
const MARK_BOX = { left: 60, top: 75, width: 365, height: 379 };
const WORD_BOX = { left: 500, top: 71, width: 1036, height: 244 };
/** The master's wordmark sits 4px lower than the mark's top edge. */
const WORD_TOP_OFFSET = 4;

/**
 * The embroidered lockup, in shipped-crop pixels.
 *
 * `width` is the whole lockup. It is set from the PHYSICAL size of the logo,
 * not from the frame: the landing's uniform photo puts its lockup at ~19% of
 * the subject's shoulder-to-shoulder span, so the same fraction of this
 * subject's span gives the same logo on a real chest. The subject is framed
 * ~20% tighter here than in the landing photograph, so the logo reads a
 * little smaller on screen than the landing's does -- which is what a camera
 * closer to the subject does.
 */
const LOCKUP = {
  width: 205,
  /** Gap between mark and wordmark, as a fraction of the mark's height. */
  gapRatio: 0.16,
  /** Top-left of the lockup, in shipped-crop pixels. */
  left: 1565,
  top: 2078,
};

/**
 * Fabric treatment. A printed mark is not a decal laid on top of the photo:
 * the weave shows through it, and the surrounding shadow takes a little of its
 * contrast. These are the three things that make it sit IN the shirt rather
 * than ON it.
 */
const FABRIC = {
  /** Overall opacity of the lockup. Below 1 so the navy reads through. */
  alpha: 0.92,
  /** Peak-to-peak deterministic noise on the alpha, as a fraction. */
  noise: 0.07,
  /** Blur radius applied to the alpha only -- this is the weave softness. */
  blur: 0.7,
  /** How much of the local fabric shading is transferred to the lockup. */
  shading: 0.35,
};

/** Deterministic PRNG. `Math.random` would make `--check` unsatisfiable. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Cut the master into its two pieces and rebuild them as one compact lockup.
 *
 * The wordmark is re-coloured to white; its alpha channel is untouched, so the
 * letterforms and their antialiasing are the master's own pixels.
 */
async function buildLockup(width) {
  const brand = await sharp(BRAND).ensureAlpha().metadata();
  if (brand.width !== 1600 || brand.height !== 505) {
    throw new Error(
      `${BRAND} is ${brand.width}x${brand.height}, expected 1600x505 -- the lockup geometry below is measured from that file`,
    );
  }

  // One scale for both pieces, so the mark and the wordmark keep the master's
  // relative proportions. The gap is added on top of that:
  //
  //   total = markW + gap + wordW = (365 + 1036) * s + gapRatio * 379 * s
  const s = width / (MARK_BOX.width + WORD_BOX.width + LOCKUP.gapRatio * MARK_BOX.height);
  const markW = Math.round(MARK_BOX.width * s);
  const markH = Math.round(MARK_BOX.height * s);
  const wordW = Math.round(WORD_BOX.width * s);
  const wordH = Math.round(WORD_BOX.height * s);
  const gapPx = Math.round(LOCKUP.gapRatio * markH);

  const canvasW = markW + gapPx + wordW;
  const canvasH = Math.max(markH, wordH);

  const mark = await sharp(BRAND)
    .extract(MARK_BOX)
    .resize(markW, markH, { fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const word = await sharp(BRAND)
    .extract(WORD_BOX)
    .resize(wordW, wordH, { fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.alloc(canvasW * canvasH * 4, 0);

  // The mark keeps the master's two-tone colours (green behind, lime in front).
  for (let y = 0; y < markH; y++) {
    for (let x = 0; x < markW; x++) {
      const si = (y * markW + x) * 4;
      const di = (y * canvasW + x) * 4;
      out[di] = mark.data[si];
      out[di + 1] = mark.data[si + 1];
      out[di + 2] = mark.data[si + 2];
      out[di + 3] = mark.data[si + 3];
    }
  }

  // The wordmark becomes white. Only the colour changes.
  const wordTop = Math.min(canvasH - wordH, Math.round(WORD_TOP_OFFSET * s));
  for (let y = 0; y < wordH; y++) {
    for (let x = 0; x < wordW; x++) {
      const si = (y * wordW + x) * 4;
      const di = ((y + wordTop) * canvasW + (x + markW + gapPx)) * 4;
      out[di] = 255;
      out[di + 1] = 255;
      out[di + 2] = 255;
      out[di + 3] = word.data[si + 3];
    }
  }

  return { raw: out, width: canvasW, height: canvasH };
}

/**
 * Fabric treatment: the weave shows through, the fabric's own shading is
 * transferred onto the logo, and the edge is softened.
 *
 * The shading step reads the LUMINANCE of the shirt actually under the lockup
 * and scales the logo's opacity with it, so the logo sinks into the folds
 * instead of floating over them.
 */
async function applyFabric(lockup, fabric) {
  const { data, info } = await sharp(fabric.data, {
    raw: { width: fabric.info.width, height: fabric.info.height, channels: fabric.info.channels },
  })
    .greyscale()
    .blur(12)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const lum = data;
  const lw = info.width;
  const lh = info.height;

  const rand = lcg(0x5eed);
  for (let y = 0; y < lockup.height; y++) {
    for (let x = 0; x < lockup.width; x++) {
      const i = y * lockup.width + x;
      const n = (rand() - 0.5) * FABRIC.noise * 2;
      const l = lum[Math.min(lh - 1, y) * lw + Math.min(lw - 1, x)] / 255;
      // Darker fabric => slightly less opaque ink, because the fold is in shadow.
      const shade = 1 - FABRIC.shading * (1 - l);
      lockup.raw[i * 4 + 3] = Math.max(
        0,
        Math.min(255, lockup.raw[i * 4 + 3] * FABRIC.alpha * shade * (1 + n)),
      );
    }
  }

  // The weave softens the edge. Applied to the alpha only, so the artwork's
  // own antialiasing is not thrown away -- it is widened, which is what a
  // thread sitting in a weave looks like.
  const soft = await sharp(
    lockup.raw,
    { raw: { width: lockup.width, height: lockup.height, channels: 4 } },
  )
    .extractChannel(3)
    .blur(FABRIC.blur)
    .raw()
    .toBuffer();

  for (let i = 0; i < soft.length; i++) lockup.raw[i * 4 + 3] = soft[i];

  return sharp(lockup.raw, { raw: { width: lockup.width, height: lockup.height, channels: 4 } }).png().toBuffer();
}

if (!existsSync(SOURCE)) {
  console.error(`\nMISSING SOURCE: ${SOURCE}\n  The careers hero artwork is not in the repo.`);
  process.exit(1);
}

const sourceMeta = await sharp(SOURCE).metadata();
if (sourceMeta.width !== 3584 || sourceMeta.height !== 4800) {
  console.error(
    `\nSOURCE IS ${sourceMeta.width}x${sourceMeta.height}, expected 3584x4800.\n` +
      `  CROP below is measured against 3584x4800 and would land somewhere else.`,
  );
  process.exit(1);
}

const lockup = await buildLockup(LOCKUP.width);

/** The shirt pixels the lockup will cover -- the source of its shading. */
const fabricPatch = await sharp(SOURCE)
  .extract({
    left: CROP.left + LOCKUP.left,
    top: CROP.top + LOCKUP.top,
    width: lockup.width,
    height: lockup.height,
  })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const lockupPng = await applyFabric(lockup, fabricPatch);

/**
 * The composed hero, held once and encoded twice.
 *
 * Both outputs are cut from THIS buffer rather than from the encoded WebP, so
 * the portrait is not a crop of a lossy re-encode of the hero.
 */
const composed = await sharp(SOURCE)
  .extract(CROP)
  .composite([{ input: lockupPng, left: LOCKUP.left, top: LOCKUP.top }])
  .png()
  .toBuffer();

const built = await sharp(composed).webp({ quality: 86, effort: 6 }).toBuffer();
const portrait = await sharp(composed)
  .extract({
    left: PORTRAIT.left,
    top: PORTRAIT.top,
    width: PORTRAIT.size,
    height: PORTRAIT.size,
  })
  .resize(PORTRAIT.out, PORTRAIT.out, { fit: "fill", kernel: "lanczos3" })
  .jpeg({ quality: 88, mozjpeg: true })
  .toBuffer();

const outMeta = await sharp(built).metadata();
if (outMeta.width !== CROP.width || outMeta.height !== CROP.height) {
  console.error(`\nREFUSING TO WRITE — hero is ${outMeta.width}x${outMeta.height}, expected ${CROP.width}x${CROP.height}`);
  process.exit(1);
}

/**
 * Assert that the brand actually landed on the fabric.
 *
 * A composite that silently fails -- a mis-sized canvas, an extract box off the
 * artwork, a colour that was dropped -- produces a file that looks like a
 * finished photograph. The shipped bytes are not evidence that the logo is
 * there, so it is measured on the pixels of the region the lockup claims.
 */
const check = await sharp(built)
  .extract({
    left: LOCKUP.left,
    top: LOCKUP.top,
    width: lockup.width,
    height: lockup.height,
  })
  .raw()
  .toBuffer({ resolveWithObject: true });

let greenish = 0;
let whitish = 0;
let ink = 0;
for (let i = 0; i < check.data.length; i += 3) {
  const r = check.data[i];
  const g = check.data[i + 1];
  const b = check.data[i + 2];
  // The navy shirt is blue-dominant and dark; neither of these is.
  if (g > r + 18 && g > b + 18) greenish++;
  if (r > 120 && g > 120 && b > 120 && Math.max(r, g, b) - Math.min(r, g, b) < 60) whitish++;
  if (Math.max(r, g, b) > 100) ink++;
}
const area = lockup.width * lockup.height;
if (greenish < area * 0.01) {
  console.error(
    `\nREFUSING TO WRITE — only ${greenish} green px in the lockup region (expected >${Math.round(area * 0.01)}).\n` +
      `  The mark's two-tone squares did not land on the shirt.`,
  );
  process.exit(1);
}
if (whitish < area * 0.01) {
  console.error(
    `\nREFUSING TO WRITE — only ${whitish} white px in the lockup region (expected >${Math.round(area * 0.01)}).\n` +
      `  The white wordmark did not land on the shirt.`,
  );
  process.exit(1);
}

const outputs = [
  { rel: "public/images/landing/careers-hero.webp", bytes: built },
  { rel: "public/images/landing/careers-portrait.jpg", bytes: portrait },
];

const stale = [];
for (const o of outputs) {
  const abs = join(ROOT, o.rel);
  const current = existsSync(abs) ? readFileSync(abs) : null;
  if (current && current.equals(o.bytes)) {
    console.log(`  ok    ${o.rel} (${o.bytes.length} bytes)`);
    continue;
  }
  if (CHECK) {
    stale.push(o.rel);
    continue;
  }
  writeFileSync(abs, o.bytes);
  console.log(`  wrote ${o.rel} (${o.bytes.length} bytes)`);
}

if (CHECK && stale.length) {
  console.error(`\nSTALE (run without --check): ${stale.join(", ")}`);
  process.exitCode = 1;
} else if (!CHECK) {
  console.log(
    `\nartwork ${SOURCE}\n` +
      `hero    ${outMeta.width}x${outMeta.height}\n` +
      `lockup  ${lockup.width}x${lockup.height} at (${LOCKUP.left}, ${LOCKUP.top})\n` +
      `brand   ${BRAND}\n` +
      `ink     ${greenish} green px, ${whitish} white px`,
  );
}
