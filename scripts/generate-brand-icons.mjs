// Generate every favicon / PWA icon from the real brand mark.
//
// Why this exists
// ---------------
// The shipped icon family was a hand-drawn approximation of the logo: a navy
// rounded tile with two stroke paths (`icon-32.svg`, `icon-192.svg`, and the
// rasters derived from them). It was not the company's artwork. Meanwhile the
// real mark already sat unused at `public/brand/logo-mark-raw.png`.
//
// The failure this script prevents is the one that produced that state: the
// icons were generated once, by hand, and nothing tied them to the source. Six
// files drifted independently and nothing flagged it. So the icons are now
// DERIVED, and `--check` re-derives them into memory and compares bytes, which
// is what `tests/brand-icons.test.ts` calls.
//
// Two details that are easy to get wrong and are load-bearing here:
//
//  1. `logo-mark-raw.png` is 381x395 -- NOT square -- and still painted in the
//     RETIRED green `#119446`, because `scripts/recolor-brand-assets.mjs`
//     deliberately left it out of its file list. Shipping it verbatim would put
//     a colour the header logo no longer uses into every browser tab. It is
//     recoloured here with the same map and tolerance as that script, so the
//     favicon and the header wordmark agree.
//  2. `.ico` is a container format and sharp cannot write one. Browsers accept
//     PNG-compressed ICO entries, so the container is assembled by hand below.
//
// Usage:
//   node scripts/generate-brand-icons.mjs            # write the icons
//   node scripts/generate-brand-icons.mjs --check    # fail if any is stale

import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const SOURCE = join(ROOT, "public/brand/logo-mark-raw.png");

/** Retired -> current, identical to scripts/recolor-brand-assets.mjs. */
const MAP = [
  [0x11, 0x94, 0x46, 0x00, 0x83, 0x38], // Beepa Green -> primary green
];
const TOLERANCE = 26;

/**
 * Fraction of the icon edge left empty. The browser already gives a favicon
 * some breathing room, so this stays small; a larger pad reads as a shrunken
 * logo. It scales down for small sizes because the mark's strokes are ~15px
 * wide in a 381px-wide source: at 16px they land at roughly 0.6px and any
 * padding on top of that renders the icon as a faint wash rather than a mark.
 */
const padFor = (size) => (size <= 16 ? 0 : size <= 32 ? 0.05 : 0.09);

/** Recolour the mark onto the current palette, in place, as raw RGBA. */
async function loadRecoloured() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  let moved = 0;
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    let best = null;
    let bestD = Infinity;
    for (const [fr, fg, fb, tr, tg, tb] of MAP) {
      const d = Math.hypot(out[i] - fr, out[i + 1] - fg, out[i + 2] - fb);
      if (d < bestD) { bestD = d; best = [fr, fg, fb, tr, tg, tb]; }
    }
    if (!best || bestD > TOLERANCE) continue;
    // Partial move, proportional to closeness, so antialiased edges keep coverage.
    const t = 1 - bestD / TOLERANCE;
    const [fr, fg, fb, tr, tg, tb] = best;
    out[i] = Math.round(fr + (tr - fr) * t);
    out[i + 1] = Math.round(fg + (tg - fg) * t);
    out[i + 2] = Math.round(fb + (tb - fb) * t);
    moved++;
  }
  return { data: out, info, moved };
}

const { data: SRC, info: SRC_INFO, moved } = await loadRecoloured();

/** The mark, recoloured, centred on a transparent square of `size`. */
async function renderIcon(size, { background = null, padFrac = null } = {}) {
  const pad = Math.round(size * (padFrac ?? padFor(size)));
  const inner = size - pad * 2;
  const scale = inner / Math.max(SRC_INFO.width, SRC_INFO.height);
  const w = Math.max(1, Math.round(SRC_INFO.width * scale));
  const h = Math.max(1, Math.round(SRC_INFO.height * scale));
  // Lanczos dissolves a stroke that lands below about one pixel: at 16px the
  // mark's ~15px strokes in a 381px source become ~0.6px, and a smooth
  // resample spreads that energy into a faint wash with no opaque pixel left
  // anywhere -- the first version of this script shipped exactly that. Point
  // sampling keeps every stroke on a real pixel instead. This changes the
  // SAMPLING, not the artwork: the same two shapes, no redraw.
  const kernel = size <= 16 ? "nearest" : "lanczos3";
  const body = await sharp(SRC, { raw: { width: SRC_INFO.width, height: SRC_INFO.height, channels: 4 } })
    .resize(w, h, { fit: "fill", kernel })
    .png()
    .toBuffer();

  // The source is not square (381x395), so `size - w` can be ODD. Rounding both
  // sides the same way overshoots by one and emits a 49x48 icon, which is what
  // the first run did. The remainder goes on the right instead.
  const slack = size - w;
  const left = Math.floor(slack / 2);
  const right = slack - left;

  if (!background) {
    // Transparent icon: extend the transparent border. Unchanged, byte for byte.
    return sharp(body)
      .extend({ top: pad, bottom: pad, left, right, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  }

  // Opaque plate: create a white canvas and COMPOSITE the mark onto it.
  //
  // The obvious alternative -- extend with a transparent border, then
  // `flatten({background: white})` -- produces a plate whose "white" is actually
  // black. `flatten` did not composite over the white: 83% of the plate's
  // non-white pixels came back as (0,0,0), which is the transparent border's own
  // RGB showing through. A colour guard that counts non-white pixels then reads
  // the void as ink and reports the mark at 17% green-dominant while the render
  // looks correct in isolation. Composite onto an opaque canvas is the recipe
  // that actually works, and `removeAlpha` keeps the result 3-channel so the
  // guard measures pixels rather than coverage.
  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: { ...background, alpha: 1 } },
  });
  return canvas
    .composite([{ input: body, left, top: pad }])
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * ICO container with PNG-compressed entries. Layout: 6-byte header, then a
 * 16-byte directory entry per image, then the image bytes.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, png }, i) => {
    const at = i * 16;
    dir[at] = size >= 256 ? 0 : size; // 0 means 256
    dir[at + 1] = size >= 256 ? 0 : size;
    dir[at + 2] = 0;                  // palette
    dir[at + 3] = 0;                  // reserved
    dir.writeUInt16LE(1, at + 4);     // colour planes
    dir.writeUInt16LE(32, at + 6);    // bits per pixel
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.png)]);
}

// [path, size, padFrac?]. Explicit sizes rather than parsing them out of the
// filename, because `app/icon.png` has no number in its name. `padFrac` overrides
// the size-derived padding.
const PNG_TARGETS = [
  ["public/favicon-16.png", 16],
  ["public/favicon-32.png", 32],
  ["public/favicon-48.png", 48],
  ["public/favicon-96.png", 96],
  ["public/apple-icon.png", 180],
  ["public/brand/icon-192.png", 192],
  ["public/brand/icon-512.png", 512],
  // The mark on transparent at near-zero padding, for compositing onto
  // arbitrary backgrounds. Previously written by a second, superseded generator
  // that drew the mark as an SVG path -- so this one file was the only brand
  // asset in the repo that did not come from the real artwork.
  ["public/brand/logo-mark.png", 192, 0.08],
  // Next.js serves this at /icon.png and injects its own <link rel="icon">.
  // Being the file-convention icon it takes precedence over the `icons` array in
  // app/layout.tsx for anything that takes the first icon — which is how the
  // navy tile survived a full regeneration of every public/ favicon. It was
  // still the old artwork, so Chrome and Google were served that.
  ["app/icon.png", 512],
];
const ICO_SIZES = [16, 32, 48];

/**
 * The Google Organization logo: the mark on an opaque white plate.
 *
 * Google's Search Central guideline asks for an organization logo that reads on
 * white, and `lib/site.ts` points at it. It used to be produced by a second
 * generator that drew the mark as an inline SVG path in the RETIRED green and
 * then relied on `scripts/recolor-brand-assets.mjs` to fix up the output
 * afterwards. That is two scripts, one ordering dependency, and one generator
 * that would happily repaint the logo the old colour if anyone ran it after the
 * recolour. Deriving it here instead means the palette cannot drift, because
 * there is only one place the colour is decided.
 *
 * These are checked by COLOUR rather than by coverage: on a white plate every
 * pixel is opaque, so the "did the mark survive downscaling" guard would pass
 * on a blank square. What can go wrong here is the wrong hue, which is exactly
 * what this asserts against.
 */
const WHITE_PLATE = { r: 255, g: 255, b: 255 };
const WHITE_TARGETS = [
  ["public/brand/google-organization-logo.png", 512],
  ["public/brand/google-organization-logo-112.png", 112],
];

const written = new Map();
const shapeProblems = [];
for (const [rel, size, padFrac] of PNG_TARGETS) {
  const png = await renderIcon(size, { padFrac: padFrac ?? null });

  // Assert on the rendered result rather than trusting the arithmetic. A
  // favicon that is off by a pixel, or that has been downscaled until every
  // stroke is sub-pixel and nothing is opaque any more, still looks like a
  // file that was written -- which is exactly how the 49x48 / all-transparent
  // 16px pair shipped in the first version of this script.
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== size || info.height !== size) {
    shapeProblems.push(`${rel}: ${info.width}x${info.height}, expected ${size}x${size}`);
  }
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] >= 250) opaque++;
  const coverage = opaque / (size * size);
  if (coverage < 0.04) {
    shapeProblems.push(`${rel}: only ${(coverage * 100).toFixed(1)}% opaque pixels -- the mark is too thin to read at this size`);
  }
  written.set(rel, png);
}

const icoParts = [];
for (const size of ICO_SIZES) icoParts.push({ size, png: await renderIcon(size) });
const ico = buildIco(icoParts);
written.set("public/favicon.ico", ico);
// `tests/seo-payslip.test.ts` asserts app/favicon.ico exists, which used to be
// true only because a THIRD generator wrote it. Written here so the assertion
// now points at the real source instead of at whatever ran last.
written.set("app/favicon.ico", ico);

// Colour guard for the white plates. A dimension check passes on a blank white
// square, so what is actually asserted is that the mark is there AND it is the
// current green.
//
// EXACT equality, not a tolerance radius. The recolour moves each pixel only
// PART way to the new hue (`t = 1 - d/TOLERANCE`), so an antialiased edge pixel
// that started 20 away from the retired green ends up still ~15 away from it --
// a radius-based "is anything near #119446" test therefore fires on a perfectly
// good render, every time, and would be silenced rather than fixed. Exact
// equality asks the question that actually matters: is there a pixel that is
// still PRECISELY the old brand colour, i.e. an interior pixel the recolour
// never reached? That is the same convention tests/brand-icons.test.ts uses.
for (const [rel, size] of WHITE_TARGETS) {
  const png = await renderIcon(size, { background: WHITE_PLATE, padFrac: 0.18 });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  if (info.width !== size || info.height !== size) {
    shapeProblems.push(`${rel}: ${info.width}x${info.height}, expected ${size}x${size}`);
  }
  let current = 0;
  let retired = 0;
  let ink = 0;
  let greenDominant = 0;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r === 0x11 && g === 0x94 && b === 0x46) retired++;
    if (r === 0x00 && g === 0x83 && b === 0x38) current++;
    // "Ink" = anything visibly darker than the white plate. This is the presence
    // test, because Lanczos blends: at 112px essentially no pixel is EXACTLY
    // #008338, so counting exact matches would fail a perfectly good render.
    if (Math.min(r, g, b) < 250) {
      ink++;
      if (g > r && g > b) greenDominant++;
    }
  }
  const inkShare = ink / (size * size);
  if (inkShare < 0.01) {
    shapeProblems.push(`${rel}: only ${(inkShare * 100).toFixed(2)}% non-white px -- the mark did not render onto the white plate`);
  }
  // Presence alone would accept a grey smudge. Requiring the ink to be
  // green-dominant is what distinguishes "the logo" from "something was
  // drawn here", and it survives blending because a blend of #008338 with white
  // is still green-dominant, while grey is not.
  const dominance = ink ? greenDominant / ink : 0;
  if (dominance < 0.9) {
    shapeProblems.push(`${rel}: only ${(dominance * 100).toFixed(1)}% of the ink is green-dominant -- that is not the brand mark`);
  }
  if (retired > 0) {
    shapeProblems.push(`${rel}: ${retired} px still exactly the retired green #119446`);
  }
  written.set(rel, png);
}

if (shapeProblems.length) {
  console.error(`\nREFUSING TO WRITE — ${shapeProblems.length} icon(s) did not render correctly:`);
  for (const p of shapeProblems) console.error(`  ${p}`);
  process.exit(1);
}

const stale = [];
for (const [rel, bytes] of written) {
  const abs = join(ROOT, rel);
  let current = null;
  try { current = readFileSync(abs); } catch { /* new file */ }
  const same = current && current.equals(bytes);
  if (same) { console.log(`  ok    ${rel}`); continue; }
  if (current) stale.push(rel);
  if (CHECK) continue;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, bytes);
  console.log(`  wrote ${rel} (${bytes.length} bytes)`);
}

console.log(
  `\nsource ${SRC_INFO.width}x${SRC_INFO.height}, ${moved} px recoloured from the retired green` +
    `\n${written.size} brand assets from the real mark (${PNG_TARGETS.length} square icons, ` +
    `${WHITE_TARGETS.length} Google white plates, 2 .ico containers with ${ICO_SIZES.join("/")})`,
);

if (CHECK && stale.length) {
  console.error(`\nSTALE (run without --check): ${stale.join(", ")}`);
  process.exitCode = 1;
} else if (CHECK) {
  console.log("all icons match the source mark");
}