/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
/* QA fix round checks for start, PWA, progress and settings, at 390x844:
   1. Offline: load online, go offline, then tap through Today, Food, Train, Progress and You. Every one loads.
   2. An en-US phone can enter 165 cm on A2.
   3. iPhone Safari shows install-first on A1; a standalone display mode skips it.
   4. No 404 links anywhere on Progress (every view).
   5. At 200% text the tab bar is one row.
   6. The save screen has one "Test version" line; the in-app browser screen doesn't repeat itself.
   Run against a production server:
     npm run build && npx next start -p 3303 &
     BASE=http://localhost:3303 node scripts/check-qa-start.cjs */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3303";
const UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  whatsappIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24.1",
};

let failed = 0;
function ok(cond, msg) {
  if (cond) console.log("PASS " + msg);
  else {
    failed++;
    console.log("FAIL " + msg);
  }
}

async function newPage(browser, { ua = UA.android, locale = "en-ZA", sw = "block", standalone = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale,
    userAgent: ua,
    serviceWorkers: sw,
  });
  if (standalone) {
    await ctx.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q) =>
        /display-mode:\s*standalone/.test(q)
          ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }
          : real(q);
    });
  }
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("page error: " + e.message));
  return { ctx, page };
}

const button = (page, name) => page.getByRole("button", { name, exact: true }).first();
const text = (page) => page.evaluate(() => document.body.innerText);

/** Quick setup through the real screens (Android, so no install-first). Ends on Today. */
async function setUp(page) {
  await page.goto(BASE + "/start/setup?step=about");
  await page.getByLabel("Age").fill("44");
  await page.locator("#body-height").fill("165");
  await page.locator("#body-weight").fill("72");
  await button(page, "Next").click();
  await page.waitForURL("**step=goal");
  await page.getByRole("radio", { name: "Keep steady" }).click();
  await page.getByRole("checkbox", { name: /I agree/ }).click();
  await button(page, "Next").click();
  await page.waitForURL("**step=ready");
  await button(page, "I'm good to go").click();
  for (const step of ["home", "food", "plan"]) {
    await button(page, "Next").click();
    await page.waitForURL(`**step=${step}`);
  }
  await button(page, "Do it later").click();
  await page.waitForURL("**/start/save**");
  const save = await text(page);
  ok((save.match(/Test version/g) || []).length === 1, `20: save screen has one "Test version" line`);
  await button(page, "Next").click();
  await page.waitForURL(/\/start\/(install|shared-phone)/);
  await page.goto(BASE + "/start/free-week");
  await button(page, "Go to Today").click();
  await page.waitForURL("**/today");
}

async function offline(browser) {
  const { ctx, page } = await newPage(browser, { sw: "allow" });
  await setUp(page);
  await page.goto(BASE + "/today");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Wait for the install-time precache to hold every tab's page.
  let ready = false;
  for (let i = 0; i < 120 && !ready; i++) {
    ready = await page.evaluate(async () => {
      const need = ["/today", "/food", "/train", "/progress", "/you"];
      for (const u of need) if (!(await caches.match(u, { ignoreSearch: true }))) return false;
      return !!navigator.serviceWorker.controller;
    });
    if (!ready) await page.waitForTimeout(250);
  }
  ok(ready, "2: service worker controls the page and has precached every tab");
  await ctx.setOffline(true);
  const tabs = [
    ["Food", /Food|meal/i],
    ["Train", /Train|workout/i],
    ["Progress", /Progress|wins/i],
    ["Today", /Today|meal|Rest day|workout/i],
  ];
  for (const [name, expect] of tabs) {
    let loaded = false;
    try {
      await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click({ timeout: 5000 });
      await page.waitForTimeout(2500);
      const t = await text(page);
      loaded = expect.test(t) && !/offline|can't be reached|ERR_/i.test(t);
      if (!loaded) console.log("   got: " + t.slice(0, 160).replace(/\n+/g, " / "));
    } catch (e) {
      console.log("   " + e.message.split("\n")[0]);
    }
    ok(loaded, `2: offline tap to ${name} loads`);
  }
  // You: the person circle on Progress.
  let youOk = false;
  try {
    await page.goto(BASE + "/progress").catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: "You" }).first().click({ timeout: 5000 });
    await page.waitForTimeout(2500);
    const t = await text(page);
    youOk = /My data|Body and units|Goal/i.test(t);
    if (!youOk) console.log("   got: " + t.slice(0, 160).replace(/\n+/g, " / "));
  } catch (e) {
    console.log("   " + e.message.split("\n")[0]);
  }
  ok(youOk, "2: offline tap to You loads");
  await ctx.close();
}

async function enUsHeight(browser) {
  const { ctx, page } = await newPage(browser, { locale: "en-US" });
  await page.goto(BASE + "/start/setup?step=about");
  await page.waitForTimeout(800);
  const cm = page.getByRole("radio", { name: "cm", exact: true });
  ok((await cm.count()) > 0, "6: A2 has a cm / ft-in switch");
  if (await cm.count()) await cm.click();
  await page.getByLabel("Age").fill("41");
  await page.locator("#body-height").fill("165");
  await page.locator("#body-weight").fill("165");
  await button(page, "Next").click();
  await page.waitForTimeout(1000);
  ok(page.url().includes("step=goal"), "6: en-US phone enters 165 cm and goes on");
  const kg = await page.evaluate(() => JSON.parse(localStorage.getItem("8020jacked:v1") || "{}").state?.profile?.heightCm);
  ok(kg === 165, `6: stored height is 165 cm (got ${kg})`);
  await ctx.close();
}

async function bmiNote(browser) {
  const { ctx, page } = await newPage(browser);
  await page.goto(BASE + "/start/setup?step=about");
  await page.getByLabel("Age").fill("41");
  await page.locator("#body-height").fill("170");
  await page.locator("#body-weight").fill("55");
  await button(page, "Next").click();
  await page.waitForURL("**step=goal");
  const t = await text(page);
  ok(/Lose some weight isn't offered at your current weight\. Keep steady or get stronger instead\./.test(t), "BMI under 20: goal screen explains");
  await ctx.close();
}

async function installFirst(browser) {
  const a = await newPage(browser, { ua: UA.ios });
  await a.page.goto(BASE + "/start");
  await a.page.waitForTimeout(1200);
  let t = await text(a.page);
  ok(/Add 8020jacked to your Home Screen first/.test(t), "iPhone Safari: A1 shows install-first");
  ok(!/download your progress|pick the file/i.test(t), "iPhone Safari: install-first has no download step");
  const safari = a.page.getByRole("link", { name: "Use it in Safari instead" }).or(a.page.getByRole("button", { name: "Use it in Safari instead" }));
  ok((await safari.count()) > 0, 'iPhone Safari: "Use it in Safari instead" is there');
  if (await safari.count()) {
    await safari.first().click();
    await a.page.waitForTimeout(800);
    t = await text(a.page);
    ok(/New here/.test(t), "iPhone Safari: Use it in Safari shows the normal A1");
  }
  await a.ctx.close();

  const b = await newPage(browser, { ua: UA.ios, standalone: true });
  await b.page.goto(BASE + "/start");
  await b.page.waitForTimeout(1200);
  t = await text(b.page);
  ok(!/Home Screen first/.test(t) && /New here/.test(t), "iPhone standalone: A1 skips install-first");
  await b.ctx.close();

  const c = await newPage(browser, { ua: UA.android });
  await c.page.goto(BASE + "/start");
  await c.page.waitForTimeout(1200);
  t = await text(c.page);
  ok(!/Home Screen first/.test(t) && /New here/.test(t), "Android: A1 keeps the current order");
  await c.ctx.close();

  const d = await newPage(browser, { ua: UA.whatsappIos });
  await d.page.goto(BASE + "/start/browser");
  await d.page.waitForTimeout(1200);
  t = await text(d.page);
  ok(/Safari/.test(t) && !/Chrome/.test(t), "18: iPhone in-app browser screen says Safari only");
  ok((t.match(/open (it )?in safari/gi) || []).length === 1, "18: no repeated Safari line");
  await d.ctx.close();
}

async function progressLinks(browser) {
  const { ctx, page } = await newPage(browser);
  await setUp(page);
  const seen = new Set();
  for (const view of ["wins", "weight", "strength", "photos"]) {
    await page.goto(BASE + "/progress?view=" + view);
    await page.waitForTimeout(1000);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    hrefs.filter((h) => h && h.startsWith("/")).forEach((h) => seen.add(h));
  }
  const bad = [];
  for (const h of seen) {
    const r = await page.request.get(BASE + h);
    if (r.status() === 404) bad.push(h);
  }
  ok(bad.length === 0, `9: no 404 links on Progress (${seen.size} checked)${bad.length ? ": " + bad.join(", ") : ""}`);
  const t = await (async () => {
    await page.goto(BASE + "/progress?view=wins");
    await page.waitForTimeout(800);
    return text(page);
  })();
  ok(!/\b0 good weeks?\b/.test(t), "15: Wins on day 1 has no 0 good weeks");
  ok(!/Your average weight, and how far/.test(t), "15: weight subtitle not on Wins");

  // 200% text: the tab bar is one row.
  for (const route of ["/progress", "/today"]) {
    await page.goto(BASE + route);
    await page.waitForTimeout(800);
    await page.addStyleTag({ content: "html{font-size:200% !important}" });
    await page.waitForTimeout(400);
    const rows = await page.evaluate(() => {
      const items = [...document.querySelectorAll('nav[aria-label="Main"] li')];
      const tops = new Set(items.map((li) => Math.round(li.getBoundingClientRect().top)));
      const named = [...document.querySelectorAll('nav[aria-label="Main"] a')].every(
        (a) => (a.getAttribute("aria-label") || a.textContent || "").trim().length > 0,
      );
      const doc = document.documentElement;
      return { rows: tops.size, named, hscroll: doc.scrollWidth > doc.clientWidth };
    });
    ok(rows.rows === 1 && rows.named && !rows.hscroll, `22: 200% text tab bar is one row on ${route} (rows ${rows.rows})`);
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await installFirst(browser);
    await enUsHeight(browser);
    await bmiNote(browser);
    await progressLinks(browser);
    await offline(browser);
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
  process.exit(failed ? 1 : 0);
})();
