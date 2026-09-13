/**
 * Regenerate Google Search–ready brand assets from the vector mark.
 * - Favicons (16/32/48 + ICO) for GSC property icon & SERP favicon
 * - App icons (192/512) on brand navy
 * - Organization logo on white (Google Knowledge Panel guideline)
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const NAVY = "#1F2058";
const GREEN = "#119446";
const LIME = "#93C63D";

function markSvg(size, { bg = null, pad = 0.19 } = {}) {
  const inset = Math.round(size * pad);
  const inner = size - inset * 2;
  const stroke = Math.max(2, Math.round(inner * 0.094));
  const rx = Math.round(size * 0.1875);
  const bgRect = bg
    ? `<rect width="${size}" height="${size}" rx="${rx}" fill="${bg}"/>`
    : "";
  // Map original 512 viewBox mark into the padded inner box.
  const scale = inner / 512;
  const tx = inset;
  const ty = inset;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none">
  ${bgRect}
  <g transform="translate(${tx} ${ty}) scale(${scale})">
    <path d="M144 342V192c0-38 30-68 68-68h138" stroke="${GREEN}" stroke-width="48" stroke-linecap="round" fill="none"/>
    <path d="M368 170v150c0 38-30 68-68 68H162" stroke="${LIME}" stroke-width="48" stroke-linecap="round" fill="none"/>
  </g>
</svg>`);
}

async function writePng(svg, outPath) {
  await sharp(svg).png().toFile(outPath);
  console.log("wrote", outPath);
}

async function buildIco(pngPaths, outPaths) {
  const images = [];
  for (const p of pngPaths) {
    const buf = fs.readFileSync(p);
    const size = path.basename(p).includes("48")
      ? 48
      : path.basename(p).includes("32")
        ? 32
        : 16;
    images.push({ size, buf });
  }
  const headerSize = 6 + 16 * images.length;
  let offset = headerSize;
  const entries = [];
  for (const img of images) {
    entries.push({ size: img.size, buf: img.buf, offset });
    offset += img.buf.length;
  }
  const ico = Buffer.alloc(offset);
  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(images.length, 4);
  let entryAt = 6;
  for (const e of entries) {
    ico.writeUInt8(e.size === 256 ? 0 : e.size, entryAt);
    ico.writeUInt8(e.size === 256 ? 0 : e.size, entryAt + 1);
    ico.writeUInt8(0, entryAt + 2);
    ico.writeUInt8(0, entryAt + 3);
    ico.writeUInt16LE(1, entryAt + 4);
    ico.writeUInt16LE(32, entryAt + 6);
    ico.writeUInt32LE(e.buf.length, entryAt + 8);
    ico.writeUInt32LE(e.offset, entryAt + 12);
    e.buf.copy(ico, e.offset);
    entryAt += 16;
  }
  for (const out of outPaths) {
    fs.writeFileSync(out, ico);
    console.log("wrote", out, ico.length, "bytes");
  }
}

async function main() {
  // Favicons / app icons — navy rounded square (GSC + tabs)
  await writePng(markSvg(16, { bg: NAVY, pad: 0.2 }), "public/favicon-16.png");
  await writePng(markSvg(32, { bg: NAVY, pad: 0.2 }), "public/favicon-32.png");
  await writePng(markSvg(48, { bg: NAVY, pad: 0.2 }), "public/favicon-48.png");
  await writePng(markSvg(96, { bg: NAVY, pad: 0.19 }), "public/favicon-96.png");
  await writePng(markSvg(180, { bg: NAVY, pad: 0.19 }), "app/apple-icon.png");
  await writePng(markSvg(192, { bg: NAVY, pad: 0.19 }), "app/icon.png");
  await writePng(markSvg(192, { bg: NAVY, pad: 0.19 }), "public/brand/icon-192.png");
  await writePng(markSvg(512, { bg: NAVY, pad: 0.19 }), "public/brand/icon-512.png");

  // Transparent mark for flexible compositing
  await writePng(markSvg(192, { bg: null, pad: 0.08 }), "public/brand/logo-mark.png");

  // Google Organization.logo — must read on a white background (Search guideline)
  await writePng(
    markSvg(512, { bg: "#FFFFFF", pad: 0.18 }),
    "public/brand/google-organization-logo.png",
  );
  // Also ship 112px minimum-safe variant
  await writePng(
    markSvg(112, { bg: "#FFFFFF", pad: 0.18 }),
    "public/brand/google-organization-logo-112.png",
  );

  await buildIco(
    ["public/favicon-16.png", "public/favicon-32.png", "public/favicon-48.png"],
    ["public/favicon.ico", "app/favicon.ico"],
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
