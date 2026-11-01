/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
/* Browser check for the design foundation (390x844):
   no horizontal scroll, no text under 15px, no tap target under 48px; light, dark and 200% text.
   Saves screenshots to docs/build-shots/.
   Run against a running server: BASE=http://localhost:3100 node scripts/check-ui.cjs */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3100";
const shots = path.resolve(__dirname, "..", "docs", "build-shots");
const pages = [
  { name: "today-mock", url: "/dev/today" },
  { name: "dev-gallery", url: "/dev" },
];
const modes = [
  { name: "light", scheme: "light", text: 1 },
  { name: "dark", scheme: "dark", text: 1 },
  { name: "text200", scheme: "light", text: 2 },
];

async function audit(page) {
  return page.evaluate(() => {
    const problems = [];
    const visible = (el) => {
      if (el.closest("dialog:not([open])") || el.closest("[hidden]")) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth) problems.push(`horizontal scroll: ${doc.scrollWidth} > ${doc.clientWidth}`);

    // text: every element with its own visible text node
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      if (!visible(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      const base = parseFloat(getComputedStyle(doc).fontSize) / 16;
      if (fs < 15 * base - 0.01) problems.push(`text ${fs}px: "${n.textContent.trim().slice(0, 40)}"`);
    }

    // tap targets
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="switch"], [role="radio"], [role="checkbox"], [tabindex]:not([tabindex="-1"])';
    document.querySelectorAll(sel).forEach((el) => {
      if (!visible(el)) return;
      if (el.tagName === "INPUT" && el.parentElement && el.parentElement.getBoundingClientRect().height >= 48) {
        // inputs sit inside a 56px field box; the box is the target
        const r = el.parentElement.getBoundingClientRect();
        if (r.width < 48 || r.height < 48) problems.push(`field ${Math.round(r.width)}x${Math.round(r.height)}`);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5)
        problems.push(`target ${Math.round(r.width)}x${Math.round(r.height)}: ${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`);
    });
    const current = document.querySelectorAll('nav[aria-label="Main"]:not([hidden]) [aria-current="page"]').length;
    return { problems, current, font: document.fonts.check('16px "Plus Jakarta Sans"') };
  });
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  let failed = 0;
  for (const mode of modes) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      colorScheme: mode.scheme,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    for (const p of pages) {
      await page.goto(BASE + p.url, { waitUntil: "networkidle" });
      if (mode.text !== 1) {
        await page.addStyleTag({ content: `html{font-size:${mode.text * 100}% !important}` });
      }
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const res = await audit(page);
      const tag = `${p.name} @ ${mode.name}`;
      if (res.problems.length) {
        failed++;
        console.log(`FAIL ${tag}`);
        res.problems.slice(0, 30).forEach((x) => console.log("   - " + x));
      } else {
        console.log(`PASS ${tag} (aria-current tabs on screen: ${res.current}, font loaded: ${res.font})`);
      }
      await page.screenshot({ path: path.join(shots, `${p.name}-${mode.name}.png`), fullPage: p.name === "dev-gallery" });
      if (p.name === "today-mock")
        await page.screenshot({ path: path.join(shots, `${p.name}-${mode.name}-full.png`), fullPage: true });
    }
    await ctx.close();
  }
  await browser.close();
  console.log(failed ? `RESULT: FAIL (${failed})` : "RESULT: PASS");
  process.exit(failed ? 1 : 0);
})();
