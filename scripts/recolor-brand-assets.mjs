// Recut the raster brand assets onto the current palette.
//
// Why this exists
// ---------------
// The palette was rebased onto the reference brand (`c18535f`), but the raster
// assets were never touched. Verified by sampling the shipped PNGs rather than
// reading the script that made them: the header wordmark is 46.8% `#1f2058`
// and 11.4% `#119446` — Beepa Navy and Beepa Green *before* the rebase. So the
// logo on every page of the site, the mark in the app sidebar, the Google
// Knowledge Panel logo and the social card were all still painting retired
// colours, in the same way the favicon was.
//
// This is a colour substitution, not a redraw. The artwork is unchanged: only
// pixels near a retired brand colour are moved toward its replacement, and
// pixels far from every brand colour (the photography, the antialiased
// greys) are left exactly as they were. Lime did not change between palettes
// and is deliberately not in the map.
//
// It is not idempotent-safe by accident: running it twice is a no-op, because
// the source colours are no longer present after the first pass.
//
// Usage:
//   node scripts/recolor-brand-assets.mjs            # rewrite in place
//   node scripts/recolor-brand-assets.mjs --preview  # write to .shots/brand-preview

import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEW = process.argv.includes("--preview");

// [from, to] — retired brand colour first, current token second.
const MAP = [
  [0x1f, 0x20, 0x58, 0x1f, 0x1c, 0x4f], // Beepa Navy   -> navy
  [0x11, 0x94, 0x46, 0x00, 0x83, 0x38], // Beepa Green  -> primary green
];

const FILES = [
  "public/brand/beepa-logo-horizontal.png",
  "public/brand/beepa-logo-alt.png",
  "public/brand/google-organization-logo.png",
  "public/brand/google-organization-logo-112.png",
];

// Pixels further than this from every retired colour are left untouched. The
// retired navy/green differ from their replacements by only ~4-20 per channel,
// so the tolerance has to sit above antialiasing jitter (~6) and well below
// the distance to any genuinely different colour in the artwork (~40+).
const TOLERANCE = 26;

const dist = (r, g, b, R, G, B) => Math.sqrt((r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2);

async function recolour(file) {
  const src = join(ROOT, file);
  if (!existsSync(src)) {
    console.log(`  skip (missing) ${file}`);
    return;
  }
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  let moved = 0;
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];

    let best = null;
    let bestD = Infinity;
    for (const [fr, fg, fb, tr, tg, tb] of MAP) {
      const d = dist(r, g, b, fr, fg, fb);
      if (d < bestD) {
        bestD = d;
        best = [fr, fg, fb, tr, tg, tb];
      }
    }
    if (!best || bestD > TOLERANCE) continue;

    // Partial move, proportional to how close the pixel is to the retired
    // colour, so antialiased edges keep their coverage instead of banding.
    const t = 1 - bestD / TOLERANCE;
    const [fr, fg, fb, tr, tg, tb] = best;
    out[i] = Math.round(fr + (tr - fr) * t);
    out[i + 1] = Math.round(fg + (tg - fg) * t);
    out[i + 2] = Math.round(fb + (tb - fb) * t);
    moved++;
  }

  const target = PREVIEW
    ? join(ROOT, ".shots", "brand-preview", file.replace(/[\\/]/g, "__"))
    : src;
  if (PREVIEW) mkdirSync(dirname(target), { recursive: true });

  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(target);

  console.log(`  ${file}: ${moved} px moved -> ${PREVIEW ? target.replace(ROOT + "\\", "") : "in place"}`);
}

console.log(PREVIEW ? "brand asset recolour — PREVIEW" : "brand asset recolour — IN PLACE");
for (const f of FILES) await recolour(f);