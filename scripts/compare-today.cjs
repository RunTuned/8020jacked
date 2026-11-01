/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
/* Shoots /dev/today at the board size (390x956) and writes a side-by-side + diff with docs/design/shots/Main.png.
   Run against a running server: BASE=http://localhost:3100 node scripts/compare-today.cjs */
const path = require("path");
const { chromium } = require("playwright");
const sharp = require("sharp");

const BASE = process.env.BASE || "http://localhost:3100";
const root = path.resolve(__dirname, "..");
const ref = path.join(root, "docs/design/shots/Main.png");
const outDir = path.join(root, "docs/build-shots");

(async () => {
  const meta = await sharp(ref).metadata();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: meta.width, height: meta.height }, colorScheme: "light" });
  await page.goto(BASE + "/dev/today", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const shot = path.join(outDir, "today-mock-vs-board-ours.png");
  await page.screenshot({ path: shot });
  await browser.close();

  const a = await sharp(ref).removeAlpha().raw().toBuffer();
  const b = await sharp(shot).removeAlpha().raw().toBuffer();
  const diff = Buffer.alloc(a.length);
  let changed = 0;
  for (let i = 0; i < a.length; i += 3) {
    const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    const on = d > 60;
    if (on) changed++;
    diff[i] = on ? 230 : a[i] * 0.25 + 190;
    diff[i + 1] = on ? 0 : a[i + 1] * 0.25 + 190;
    diff[i + 2] = on ? 60 : a[i + 2] * 0.25 + 190;
  }
  const { width: w, height: h } = meta;
  const diffPng = await sharp(diff, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  await sharp({ create: { width: w * 3 + 40, height: h, channels: 3, background: "#888" } })
    .composite([
      { input: ref, left: 0, top: 0 },
      { input: shot, left: w + 20, top: 0 },
      { input: diffPng, left: 2 * w + 40, top: 0 },
    ])
    .png()
    .toFile(path.join(outDir, "today-mock-vs-board.png"));
  console.log(`changed pixels: ${((changed / (w * h)) * 100).toFixed(2)}%`);
})();
