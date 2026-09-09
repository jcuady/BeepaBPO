const sharp = require("sharp");
const fs = require("fs");

const SRC = "Assets/logo.png";

async function main() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  const xLimit = Math.floor(w * 0.42);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < xLimit; x++) {
      const i = (y * w + x) * ch;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      // Icon strokes are green/lime — ignore navy wordmark and black bg
      const isGreen = g > 90 && g > r + 25 && g > b + 25;
      if (a > 20 && isGreen) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log({
    w,
    h,
    minX,
    minY,
    maxX,
    maxY,
    iconW: maxX - minX + 1,
    iconH: maxY - minY + 1,
  });

  const pad = 8;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const width = Math.min(w - left, maxX - minX + 1 + pad * 2);
  const height = Math.min(h - top, maxY - minY + 1 + pad * 2);

  const iconBuf = await sharp(SRC)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(iconBuf.data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const isGreen = g > 70 && g > r + 15 && g > b + 15;
    if (!isGreen) out[i + 3] = 0;
  }

  const iconPng = await sharp(out, {
    raw: {
      width: iconBuf.info.width,
      height: iconBuf.info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  fs.writeFileSync("public/brand/logo-mark-raw.png", iconPng);

  async function makeAppIcon(size, outPath) {
    const radius = Math.round(size * 0.1875);
    const bgSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#1F2058"/></svg>`,
    );
    const markSize = Math.round(size * 0.62);
    const mark = await sharp(iconPng)
      .resize(markSize, markSize, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const inset = Math.round((size - markSize) / 2);
    await sharp(bgSvg)
      .composite([{ input: mark, left: inset, top: inset }])
      .png()
      .toFile(outPath);
    console.log("wrote", outPath);
  }

  await makeAppIcon(16, "public/favicon-16.png");
  await makeAppIcon(32, "public/favicon-32.png");
  await makeAppIcon(48, "public/favicon-48.png");
  await makeAppIcon(180, "app/apple-icon.png");
  await makeAppIcon(192, "app/icon.png");
  await makeAppIcon(192, "public/brand/icon-192.png");
  await makeAppIcon(512, "public/brand/icon-512.png");

  await sharp(iconPng)
    .resize(192, 192, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile("public/brand/logo-mark.png");

  const sizes = [16, 32, 48];
  const images = [];
  for (const s of sizes) {
    const buf = fs.readFileSync(`public/favicon-${s}.png`);
    images.push({ size: s, buf });
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
  fs.writeFileSync("public/favicon.ico", ico);
  fs.writeFileSync("app/favicon.ico", ico);
  console.log("ico bytes", ico.length);

  fs.copyFileSync(SRC, "public/brand/logo-source.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
