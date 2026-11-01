/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
/* Browser walk of the start, setup, install, account (test), free-week and You screens at 390x844.
   On every screen: no horizontal scroll, no text under 15px, no tap target under 48px, at 100% and 200% text.
   Saves screenshots to docs/build-shots/start/.
   Run against a running production server:
     npm run build && npx next start -p 3101 &
     BASE=http://localhost:3101 node scripts/check-start.cjs */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3101";
const shots = path.resolve(__dirname, "..", "docs", "build-shots", "start");

const UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  whatsapp:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24.1",
  instagram:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 300.0.0",
};

async function audit(page) {
  return page.evaluate(() => {
    const problems = [];
    const visible = (el) => {
      if (el.closest("dialog:not([open])") || el.closest("[hidden]")) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return false;
      if (el.closest(".sr-only") || el.getAttribute("aria-hidden") === "true" && el.tagName === "INPUT") return false;
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth) problems.push(`horizontal scroll: ${doc.scrollWidth} > ${doc.clientWidth}`);
    const base = parseFloat(getComputedStyle(doc).fontSize) / 16;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || seen.has(el) || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName) || !visible(el)) continue;
      seen.add(el);
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 15 * base - 0.01) problems.push(`text ${size}px: "${n.textContent.trim().slice(0, 40)}"`);
    }
    const sel =
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="switch"], [role="radio"], [role="checkbox"], [tabindex]:not([tabindex="-1"])';
    document.querySelectorAll(sel).forEach((el) => {
      if (!visible(el)) return;
      let r = el.getBoundingClientRect();
      if (el.tagName === "INPUT" && el.parentElement && el.parentElement.getBoundingClientRect().height >= 48)
        r = el.parentElement.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5)
        problems.push(
          `target ${Math.round(r.width)}x${Math.round(r.height)}: ${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`,
        );
    });
    return problems;
  });
}

let failed = 0;
let checked = 0;
async function check(page, name) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  if (await page.locator('main[aria-busy="true"]').count()) await page.waitForTimeout(500);
  for (const text of [1, 2]) {
    const tag = await page.evaluate((t) => {
      document.getElementById("__text200")?.remove();
      if (t === 2) {
        const s = document.createElement("style");
        s.id = "__text200";
        s.textContent = "html{font-size:200% !important}";
        document.head.appendChild(s);
      }
      return t === 2 ? "text200" : "light";
    }, text);
    await page.waitForTimeout(100);
    const problems = await audit(page);
    checked++;
    if (problems.length) {
      failed++;
      console.log(`FAIL ${name} @ ${tag}`);
      problems.slice(0, 20).forEach((x) => console.log("   - " + x));
    } else console.log(`PASS ${name} @ ${tag}`);
    await page.screenshot({ path: path.join(shots, `${name}-${tag}.png`), fullPage: true });
  }
  await page.evaluate(() => document.getElementById("__text200")?.remove());
}

async function newPage(browser, ua, scheme = "light") {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: scheme,
    isMobile: true,
    hasTouch: true,
    locale: "en-ZA",
    userAgent: ua,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    failed++;
    console.log("FAIL page error: " + e.message);
  });
  return { ctx, page };
}

const click = (page, name) => page.getByRole("button", { name, exact: true }).first().click();
const link = (page, name) => page.getByRole("link", { name, exact: true }).first().click();

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();

  // ---------- New here on an iPhone: A1 → A2…A8 → A10 → A14 → A14b → A12 → A13 → A15 ----------
  const { ctx, page } = await newPage(browser, UA.ios);
  await page.goto(BASE + "/");
  await page.waitForURL("**/start");
  // iPhone Safari, not installed: A1 asks to add it to the Home Screen first.
  await page.getByRole("heading", { name: "Add 8020jacked to your Home Screen first" }).waitFor();
  await check(page, "A1-install-first-ios");
  await click(page, "Use it in Safari instead");
  await check(page, "A1-start");
  await link(page, "New here");
  await page.waitForURL("**/start/setup?step=about");
  await click(page, "Next");
  await check(page, "A2-about-errors");
  await page.getByLabel("Age").fill("44");
  await page.locator("#body-height").fill("165");
  await page.locator("#body-weight").fill("72");
  await check(page, "A2-about");
  await click(page, "Next");
  await page.waitForURL("**step=goal");
  await check(page, "A3-goal");
  await page.getByRole("radio", { name: "Get stronger" }).click();
  await page.getByRole("checkbox", { name: /I agree/ }).click();
  await click(page, "Read the terms");
  await check(page, "A3-terms-sheet");
  await page.keyboard.press("Escape");
  await click(page, "Next");
  await page.waitForURL("**step=ready");
  // A reload resumes the step.
  await page.reload();
  await page.waitForURL("**step=ready");
  await check(page, "A4-ready");
  await click(page, "I'm good to go");
  await page.waitForURL("**step=time");
  await check(page, "A5-time");
  await click(page, "Next");
  await page.waitForURL("**step=home");
  await check(page, "A6-home");
  await click(page, "Next");
  await page.waitForURL("**step=food");
  await check(page, "A7-food");
  // "/" resumes setup where she left it.
  await page.goto(BASE + "/");
  await page.waitForURL("**step=food");
  await page.getByRole("checkbox", { name: "Peanuts" }).click();
  await click(page, "Next");
  await page.waitForURL("**step=plan");
  await check(page, "A8-plan");
  await click(page, "Do it later");
  await page.waitForURL("**/start/save?from=later");
  await check(page, "A10-save");
  await page.getByLabel("First name").fill("Sam");
  await click(page, "Next");
  // In Safari by choice: no install step on iPhone (the home-screen app would start empty).
  await page.waitForURL("**/start/shared-phone?from=save");
  await page.goto(BASE + "/start/install");
  await check(page, "A14-install-ios");
  await click(page, "Done, it's added");
  await page.waitForURL("**step=open");
  await check(page, "A14b-open-ios");
  await link(page, "Opened from the home screen");
  await page.waitForURL("**/start/shared-phone");
  await check(page, "A12-shared-phone");
  await click(page, "Next");
  await page.waitForURL("**/start/reminders");
  await check(page, "A13-reminders");
  await click(page, "Next");
  await page.waitForURL("**/start/free-week");
  await check(page, "A15-free-week");
  await click(page, "Go to Today");
  await page.waitForURL("**/today");
  await page.goto(BASE + "/");
  await page.waitForURL("**/today");
  console.log("PASS / → /today once set up");

  // ---------- You ----------
  await page.goto(BASE + "/you");
  await check(page, "S1-you");
  for (const s of ["goal", "body", "home", "food", "reminders", "display", "subscription", "data"]) {
    await page.goto(BASE + "/you/" + s);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await check(page, `S-${s}`);
  }
  await page.goto(BASE + "/you/food");
  await page.getByRole("button", { name: /^Allergies/ }).click();
  await check(page, "S5-food-allergies-open");
  await page.goto(BASE + "/you/body");
  await page.getByRole("radio", { name: "ft and in" }).click();
  await check(page, "S3-body-ftin");
  await page.goto(BASE + "/you/data");
  await click(page, "Delete everything on this phone");
  await check(page, "S9-delete-sheet");
  await page.keyboard.press("Escape");
  // S2 goal change → A9 with Undo
  await page.goto(BASE + "/you/goal");
  await page.getByRole("radio", { name: "Keep steady" }).click();
  await check(page, "S2-goal-changed");
  await click(page, "Save");
  await page.waitForURL("**/plan-updated");
  await check(page, "A9-plan-updated");
  await click(page, "Why this change");
  await check(page, "A9-why-sheet");
  await page.keyboard.press("Escape");
  await click(page, "Undo, keep my old goal");
  await page.waitForURL("**/you/goal");
  // Edit mode from S2: A2 → A3 (no terms) → A5
  await link(page, "Redo my setup answers");
  await page.waitForURL("**step=about&edit=1");
  await click(page, "Next");
  await page.waitForURL("**step=goal&edit=1");
  await check(page, "A3-goal-edit");
  // Export, then delete everything → Start
  await page.goto(BASE + "/you/data");
  const [download] = await Promise.all([page.waitForEvent("download"), click(page, "Download my data")]);
  const file = path.join(require("os").tmpdir(), "8020jacked-export-check.json");
  await download.saveAs(file);
  await click(page, "Delete everything on this phone");
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await page.waitForURL("**/start");
  // I've used it before: import the file → back where she was (Today)
  await link(page, "I've used it before");
  await page.waitForURL("**/start/back");
  await check(page, "A11-back");
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.waitForURL("**/today");
  fs.rmSync(file);
  console.log("PASS import brings the plan back");
  await ctx.close();

  // ---------- Under 18 ----------
  {
    const { ctx, page } = await newPage(browser, UA.ios);
    await page.goto(BASE + "/start/setup");
    await page.getByLabel("Age").fill("16");
    await page.locator("#body-height").fill("160");
    await page.locator("#body-weight").fill("50");
    await click(page, "Next");
    await page.waitForURL("**/start/under-18");
    await check(page, "A3b-under-18");
    await ctx.close();
  }

  // ---------- Android install, in-app browsers, dark ----------
  {
    const { ctx, page } = await newPage(browser, UA.android);
    await page.goto(BASE + "/start/install");
    await check(page, "A14-install-android");
    await click(page, "Done, it's added");
    await page.waitForURL("**step=open");
    await check(page, "A14b-open-android");
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, UA.whatsapp);
    await page.goto(BASE + "/start");
    await page.waitForURL("**/start/browser");
    await check(page, "A14w-whatsapp-ios");
    await click(page, "I'm in Safari now");
    await page.waitForURL("**/start");
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, UA.instagram, "dark");
    await page.goto(BASE + "/start");
    await page.waitForURL("**/start/browser");
    await check(page, "A14w-instagram-android-dark");
    await page.goto(BASE + "/start/setup");
    await check(page, "A2-about-dark");
    await ctx.close();
  }

  await browser.close();
  console.log(`${checked} screen checks`);
  console.log(failed ? `RESULT: FAIL (${failed})` : "RESULT: PASS");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
