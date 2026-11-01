/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
/* Train smoke check at 390x844: walks a whole 10-minute workout (?minutes=10: rest, reload on rest, Undo,
   Hurts, pause, a held move, the finish screen), then the other Train screens and the taster's ?next=.
   On every state: no horizontal scroll, no text under 15px, no tap target under 48px. Also 200% text.
   Screenshots go to docs/build-shots/train/.
   Run against a production server: npm run build && PORT=3103 npm start; BASE=http://localhost:3103 node scripts/check-train.cjs */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3103";
const shots = path.resolve(__dirname, "..", "docs", "build-shots", "train");

/** An invented, set-up test profile (no real person). Today is the first plan day. */
function seed() {
  const d = new Date(Date.now() - 4 * 3600_000); // the app day rolls over 3 h before a 07:00 day start
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const c = { creatorId: "8020jacked" };
  return {
    today,
    value: JSON.stringify({
      version: 1,
      state: {
        schemaVersion: 1,
        creatorId: "8020jacked",
        createdOn: today,
        planStart: today,
        profile: { ...c, firstName: "Test", age: 41, heightCm: 168, setupWeightKg: 72, noWeigh: false, goal: "stronger", termsAcceptedOn: today, safetySeenOn: today },
        training: { ...c, daysPerWeek: 3, minutes: 20, equipment: ["floor"] },
        food: { ...c, mealsPerDay: 3, cookOrBuy: "cook", fasting: false, allergies: [], cookingFor: 1 },
        foodChanges: [{ ...c, from: "0000-01-01", mealsPerDay: 3, cookOrBuy: "cook", fasting: false }],
        blocks: [{ ...c, id: "b1", goal: "stronger", start: today }],
        // One earlier Hurts on wall push-up, so today's Hurts sets it aside (W11).
        hurts: [{ ...c, date: "2026-10-01", exerciseId: "EX-031", bodyPart: "chest" }],
        // Third move is a held move today (knee plank), so the walk covers W3d.
        todaySwaps: [{ ...c, date: today, fromId: "EX-051", toId: "EX-074" }],
      },
    }),
  };
}

async function audit(page) {
  return page.evaluate(() => {
    const problems = [];
    const visible = (el) => {
      if (el.closest("dialog:not([open])") || el.closest("[hidden]")) return false;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return false;
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
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 15 * base - 0.01) problems.push(`text ${fs}px: "${n.textContent.trim().slice(0, 40)}"`);
    }
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="switch"], [role="radio"], [tabindex]:not([tabindex="-1"])';
    document.querySelectorAll(sel).forEach((el) => {
      if (!visible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5)
        problems.push(`target ${Math.round(r.width)}x${Math.round(r.height)}: "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`);
    });
    return problems;
  });
}

let failed = 0;
const results = [];
async function check(page, name, { text200 = true } = {}) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const step = await page.evaluate(() => new URL(location.href).searchParams.get("step"));
  const p1 = await audit(page);
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
  let p2 = [];
  if (text200) {
    await page.addStyleTag({ content: "html{font-size:200% !important}" });
    await page.waitForTimeout(100);
    p2 = (await audit(page)).map((x) => `200%: ${x}`);
    await page.screenshot({ path: path.join(shots, `${name}-text200.png`), fullPage: true });
    await page.evaluate(() => document.querySelectorAll("style").forEach((s) => s.textContent.includes("200%") && s.remove()));
  }
  const problems = [...p1, ...p2];
  results.push({ name, step, problems });
  console.log(`${problems.length ? "FAIL" : "ok  "} ${name}${step ? ` (step=${step})` : ""}`);
  for (const x of problems) console.log("     " + x);
  if (problems.length) failed++;
}

const expectText = async (page, text) => {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout: 8000 });
};
const tap = (page, name, opts = {}) => page.getByRole("button", { name, exact: opts.exact ?? false }).first().click();

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const { today, value } = seed();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(
    ([k, v]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(k, v);
        sessionStorage.setItem("seeded", "1");
      }
    },
    ["8020jacked:v1", value],
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    console.log("PAGE ERROR", e.message);
    failed++;
  });

  // W1
  await page.goto(BASE + "/train", { waitUntil: "networkidle" });
  await expectText(page, "Next: Legs and push · 20 min");
  await expectText(page, "This week: 0 of 1 done.");
  await check(page, "W1-train");
  await tap(page, "Pick another workout");
  await check(page, "W1-pick-another", { text200: false });
  await page.keyboard.press("Escape");

  // W2: the 10-minute version, as Today's "10 min" opens it
  await page.goto(BASE + "/train/workout?minutes=10", { waitUntil: "networkidle" });
  await expectText(page, "Before you start");
  await expectText(page, "3 moves × 2 sets = 6 sets · 10 min · no kit needed");
  await check(page, "W2-ready");
  await tap(page, "Bodyweight squat"); // a floor user starts on the bodyweight squat, not the chair (QA A)
  await expectText(page, "How to do it");
  await check(page, "W6-how-in-workout");
  await page.getByRole("button", { name: "Back" }).click();

  // W3 lift
  await tap(page, "Start", { exact: true });
  await expectText(page, "Move 1 of 3");
  await expectText(page, "iPhone: turn your ringer on");
  await check(page, "W3-lift-first-with-tip");
  await tap(page, "Got it");
  await tap(page, "One rep more");
  await tap(page, "Done set", { exact: true });

  // W3b rest + Undo
  await expectText(page, "Set 1 saved: 11 reps");
  await check(page, "W3b-rest");
  await tap(page, "Undo (5 sec)");
  await expectText(page, "Set 1 of 2");
  await page.waitForTimeout(1100);
  await tap(page, "Done set", { exact: true });
  await expectText(page, "Set 1 saved: 10 reps");
  await page.getByRole("button", { name: "Just right" }).click();
  // reload resumes the same rest clock
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: "networkidle" });
  await expectText(page, "Set 1 saved: 10 reps");
  const clock = await page.getByRole("timer").textContent();
  if (!/^0:4[0-3]$/.test(clock.trim())) {
    console.log(`FAIL rest clock after reload: ${clock}`);
    failed++;
  }
  await check(page, "W3b-rest-after-reload", { text200: false });
  await tap(page, "Skip", { exact: true });

  await expectText(page, "Set 2 of 2");
  await tap(page, "Done set", { exact: true });
  await tap(page, "Skip", { exact: true });

  // W5 Hurts (move 2, wall push-up, already hurt once → set aside), away from Done set
  const hurtsBox = await page.getByRole("button", { name: "Hurts? Swap this move" }).boundingBox();
  const doneBox = await page.getByRole("button", { name: "Done set", exact: true }).boundingBox();
  if (doneBox.y - (hurtsBox.y + hurtsBox.height) < 200) {
    console.log("FAIL Hurts sits too close to Done set");
    failed++;
  }
  await expectText(page, "Wall push-up");
  await tap(page, "Hurts? Swap this move");
  await expectText(page, "Hurts saved");
  await expectText(page, "set aside");
  await check(page, "W5-hurts", { text200: false });
  const option = page.locator("dialog[open] button").filter({ hasText: /\w/ }).filter({ hasNotText: /Cancel|Undo|Hurts/ }).nth(0);
  const optName = (await option.textContent()).trim();
  await option.click();
  await expectText(page, optName);
  await check(page, "W3-lift-after-swap");

  // W4 pause
  await tap(page, "Pause the workout");
  await expectText(page, "Paused");
  await check(page, "W4-pause", { text200: false });
  await tap(page, "Keep going", { exact: true });
  await page.waitForTimeout(300);
  await tap(page, "Done set", { exact: true });
  await tap(page, "Skip", { exact: true });
  await tap(page, "Done set", { exact: true });
  await tap(page, "Skip", { exact: true });

  // W3d held move
  await expectText(page, "Knee plank");
  await check(page, "W3d-hold");
  await tap(page, "Start", { exact: true });
  await expectText(page, "Get into position");
  await check(page, "W3d-hold-position", { text200: false });
  await page.getByText("Hold", { exact: true }).waitFor({ timeout: 13000 });
  await check(page, "W3d-hold-running", { text200: false });
  await page.getByText("Set 1 saved: 10 sec").waitFor({ timeout: 15000 }); // the hold ends by itself
  await check(page, "W3b-rest-after-hold", { text200: false });
  await tap(page, "Skip", { exact: true });
  await tap(page, "Start", { exact: true });
  await page.getByText("Hold", { exact: true }).waitFor({ timeout: 13000 });
  await page.waitForTimeout(2000);
  await tap(page, "Stop", { exact: true });

  // W7
  await expectText(page, "Well done");
  await check(page, "W7-done");
  await tap(page, "Fix a set's reps or seconds");
  await check(page, "W7-fix", { text200: false });
  await page.getByRole("button", { name: "One rep more" }).first().click();
  await page.getByRole("button", { name: "Just right" }).click();
  await tap(page, "Done for today");
  await page.waitForURL(/\/today/);

  // W1 after, W11, W6 route
  await page.goto(BASE + "/train", { waitUntil: "networkidle" });
  await expectText(page, "Done for today");
  await check(page, "W1-train-done");
  await page.goto(BASE + "/train/set-aside", { waitUntil: "networkidle" });
  await expectText(page, "Wall push-up");
  await check(page, "W11-set-aside");
  await tap(page, "Bring it back");
  await expectText(page, "Nothing set aside.");
  await page.goto(BASE + "/train/move/EX-075", { waitUntil: "networkidle" });
  await expectText(page, "Plank");
  await check(page, "W6-how");

  // The workout flow has no tab bar; Train does
  await page.goto(BASE + "/train/workout", { waitUntil: "networkidle" });
  if (await page.locator('nav[aria-label="Main"]').count()) {
    console.log("FAIL tab bar on the workout flow");
    failed++;
  }

  // Taster: stopping goes to the decoded ?next=
  await page.evaluate(() => {
    const k = "8020jacked:v1";
    const s = JSON.parse(localStorage.getItem(k));
    s.state.workouts = [];
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.goto(BASE + "/train/workout?taster=1&next=" + encodeURIComponent("/start/save?from=taster"), { waitUntil: "networkidle" });
  await expectText(page, "Legs and push");
  await tap(page, "Start", { exact: true });
  await tap(page, "Pause the workout");
  await tap(page, "Stop here, keep what I did");
  await page.waitForURL(/\/start\/save\?from=taster/);

  await browser.close();
  fs.writeFileSync(path.join(shots, "results.json"), JSON.stringify({ today, results }, null, 2));
  console.log(failed ? `\n${failed} problem(s)` : "\nAll Train checks pass.");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
