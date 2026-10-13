// Regenerate every shipped favicon/app-icon from ONE canonical SVG source.
//
// Why this was rewritten
// ----------------------
// The previous version read `Assets/logo.png` — a raster that no longer exists
// in the repo, so the script could not run and the icon set had silently frozen
// in whatever state it was left. It also hardcoded `#1F2058` for the plate,
// which was the Beepa Navy *before* the palette was rebased onto the reference
// brand, and cropped the mark out of the raster by scanning for "greenish"
// pixels — so the colour was whatever the source raster happened to contain.
//
// The shipped icons were verified to be painted in that dead palette:
// `#1f2058` plate, `#119446` green. Both superseded. The mark geometry was still
// correct, which is why this rewrites the *pipeline*, not the shape — the
// geometry below is the one already in `public/brand/icon-192.svg`, copied
// verbatim so the mark cannot drift again.
//
// Source of truth: `public/brand/icon-192.svg` — which is itself a shipped
// asset (the PWA manifest precaches it), so there is exactly one copy of the
// geometry in the repo. Change the brand, change that file, re-run this.
//
// Usage: node scripts/generate-favicons-from-logo.cjs

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Source of truth: `public/brand/icon-192.svg` — which is itself a shipped
// asset (the PWA manifest precaches it), so there is exactly one copy of the
// geometry in the repo. Change the brand, change that file, re-run this.
const SRC = "public/brand/icon-192.svg";

// The icon sizes Next.js and the browsers actually ask for.
const FAVICON_SIZES = [16, 32, 48, 96];

async function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`missing icon source: ${SRC}`);
  }
  const svg = fs.readFileSync(SRC);

  const write = (size, outPath) =>
    sharp(svg, { density: 384 }).resize(size, size).png().toFile(outPath);

  for (const s of FAVICON_SIZES) {
    await write(s, `public/favicon-${s}.png`);
    console.log("wrote public/favicon-%d.png", s);
  }

  await write(180, "app/apple-icon.png");
  await write(192, "app/icon.png");
  await write(192, "public/brand/icon-192.png");
  await write(512, "public/brand/icon-512.png");
  console.log("wrote app/apple-icon.png, app/icon.png, public/brand/icon-192.png, public/brand/icon-512.png");

  // Mark-only, transparent plate — used where the icon sits on its own colour.
  const plate = /fill="#1F1C4F"/i;
  if (!plate.test(svg.toString())) {
    throw new Error("icon source no longer has the navy plate; the mark-only crop needs updating by hand");
  }
  const markSvg = Buffer.from(
    svg
      .toString()
      .replace(/<rect[^>]*fill="#1F1C4F"[^>]*\/>/i, "")
      // The plate was 192 wide; the mark occupies 54..138, so re-centre it in a
      // 192 box rather than inverting the geometry.
      .replace('viewBox="0 0 192 192"', 'viewBox="34 34 124 124"'),
  );
  await sharp(markSvg, { density: 384 })
    .resize(192, 192)
    .png()
    .toFile("public/brand/logo-mark.png");
  console.log("wrote public/brand/logo-mark.png");

  // ICO container: 16/32/48 are what legacy browsers read out of it.
  const images = [];
  for (const s of [16, 32, 48]) {
    images.push({ size: s, buf: fs.readFileSync(`public/favicon-${s}.png`) });
  }
  const headerSize = 6 + 16 * images.length;
  let offset = headerSize;
  const ico = Buffer.alloc(headerSize + images.reduce((a, i) => a + i.buf.length, 0));
  ico.writeUInt16LE(0, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(images.length, 4);
  let entryAt = 6;
  for (const img of images) {
    ico.writeUInt8(img.size, entryAt);
    ico.writeUInt8(img.size, entryAt + 1);
    ico.writeUInt8(0, entryAt + 2);
    ico.writeUInt8(0, entryAt + 3);
    ico.writeUInt16LE(1, entryAt + 4);
    ico.writeUInt16LE(32, entryAt + 6);
    ico.writeUInt32LE(img.buf.length, entryAt + 8);
    ico.writeUInt32LE(offset, entryAt + 12);
    img.buf.copy(ico, offset);
    offset += img.buf.length;
    entryAt += 16;
  }
  fs.writeFileSync("public/favicon.ico", ico);
  fs.writeFileSync("app/favicon.ico", ico);
  console.log("wrote public/favicon.ico, app/favicon.ico (%d bytes)", ico.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});