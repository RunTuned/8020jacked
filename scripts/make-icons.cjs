/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
/* Generates the PWA icons in public/icons by screenshotting an HTML tile with Playwright.
   Run: node scripts/make-icons.cjs   (needs Chromium, which Playwright brings) */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "public", "icons");
const font = fs.readFileSync(path.join(root, "public", "fonts", "PlusJakartaSans-Variable.ttf")).toString("base64");

const LIME = "#E8F8C4";
const INK = "#111111";

// safe = fraction of the tile the wordmark may fill (maskable icons need it inside the centre 80% circle).
const icons = [
  { file: "icon-192.png", size: 192, radius: 0, safe: 0.78 },
  { file: "icon-512.png", size: 512, radius: 0, safe: 0.78 },
  { file: "icon-maskable-512.png", size: 512, radius: 0, safe: 0.56 },
  { file: "apple-touch-icon.png", size: 180, radius: 0, safe: 0.74 },
  { file: "favicon-48.png", size: 48, radius: 0, safe: 0.9 },
];

function html(size) {
  return `<!doctype html><html><head><style>
@font-face{font-family:J;src:url(data:font/ttf;base64,${font}) format("truetype");font-weight:200 800}
html,body{margin:0;width:${size}px;height:${size}px;background:${LIME}}
.t{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${LIME}}
.w{font-family:J;font-weight:800;color:${INK};letter-spacing:-0.04em;line-height:1;white-space:nowrap;display:flex;align-items:baseline}
.s{font-weight:700;opacity:1;margin:0 -0.02em}
</style></head><body><div class="t"><div class="w" id="w">80<span class="s">/</span>20</div></div></body></html>`;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const ic of icons) {
    await page.setViewportSize({ width: ic.size, height: ic.size });
    await page.setContent(html(ic.size));
    await page.evaluate(() => document.fonts.ready);
    // Fit the wordmark to the safe width.
    await page.evaluate(
      ({ size, safe }) => {
        const w = document.getElementById("w");
        let fs = size;
        w.style.fontSize = fs + "px";
        const target = size * safe;
        fs = (fs * target) / w.getBoundingClientRect().width;
        w.style.fontSize = fs + "px";
      },
      { size: ic.size, safe: ic.safe },
    );
    await page.screenshot({ path: path.join(out, ic.file), omitBackground: false });
    console.log("wrote", path.join("public/icons", ic.file));
  }
  await browser.close();
})();
