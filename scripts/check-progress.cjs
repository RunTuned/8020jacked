/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
/* Browser walk of Progress (P1–P5) and the weekly check-in (C1–C8) at 390x844, seeded through
   localStorage "8020jacked:v1" with invented test profiles (no real data). Checks: no horizontal scroll,
   no text under 15px, no tap target under 48px, hidden-numbers mode shows no weight, 200% text.
   Saves screenshots to docs/build-shots/progress/.
   Run against `npm run build && npm start -p 3104`: BASE=http://localhost:3104 node scripts/check-progress.cjs */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const sharp = require("sharp");

const BASE = process.env.BASE || "http://localhost:3104";
const shots = path.resolve(__dirname, "..", "docs", "build-shots", "progress");
const NOW = new Date(2026, 10, 1, 10, 0); // Sunday 1 Nov 2026, check-in day
const C = "8020jacked";

// ---------- invented seed ----------
const day = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd, 12).getTime();
};
const add = (d, n) => new Date(Date.UTC(...d.split("-").map((x, i) => (i === 1 ? x - 1 : +x))) + n * 864e5).toISOString().slice(0, 10);

function seed({ noWeigh = false, numbers = true, goal = "lose", weighIns = true, history = [], logs = true, photosOn = false } = {}) {
  const start = "2026-10-12";
  const workouts = [];
  const mealLogs = [];
  const walks = [];
  const w = [];
  if (logs) {
    for (let wk = 0; wk < 3; wk++) {
      const mon = add(start, wk * 7);
      ["A", "B", "A"].forEach((letter, i) => {
        const date = add(mon, i * 2);
        const sets = [
          ...[0, 1, 2].map((k) => ({ creatorId: C, exerciseId: "EX-001", setIndex: k, value: 8 + wk * 2, unit: "reps", planned: false, at: day(date) })),
          ...[0, 1, 2].map((k) => ({ creatorId: C, exerciseId: "EX-031", setIndex: k, value: 5 + wk, unit: "reps", planned: false, at: day(date) })),
        ];
        workouts.push({
          creatorId: C, id: `w${wk}${i}`, date, letter, minutes: 20, status: "done", sets,
          moveEffort: { "EX-001": "just_right", "EX-031": "just_right" }, effort: "just_right",
          bigScreen: false, taster: false, startedAt: day(date), endedAt: day(date) + 1200000,
        });
      });
      for (let d = 0; d < 7; d++) {
        const date = add(mon, d);
        for (let slot = 0; slot < 3; slot++) if ((d + slot) % 4 !== 3) mealLogs.push({ creatorId: C, date, slot, kind: "plan", at: day(date) });
      }
      walks.push({ creatorId: C, date: add(mon, 1) }, { creatorId: C, date: add(mon, 3) });
      if (weighIns && !noWeigh) {
        const days = wk === 2 ? [0, 3] : [0, 2, 4];
        days.forEach((d, k) => w.push({ creatorId: C, date: add(mon, d), kg: +(74.6 - wk * 0.7 - k * 0.2).toFixed(1), at: day(add(mon, d)) }));
      }
    }
  }
  return {
    state: {
      schemaVersion: 1, creatorId: C, createdOn: start, planStart: start,
      profile: { creatorId: C, firstName: "Test", age: 40, heightCm: 165, setupWeightKg: 75, noWeigh, goal, termsAcceptedOn: start, safetySeenOn: start },
      training: { creatorId: C, daysPerWeek: 3, minutes: 20, equipment: ["floor"] },
      food: { creatorId: C, mealsPerDay: 3, cookOrBuy: "cook", fasting: false, allergies: [], cookingFor: 1 },
      foodChanges: [{ creatorId: C, from: "0000-01-01", mealsPerDay: 3, cookOrBuy: "cook", fasting: false }],
      settings: { creatorId: C, checkInDay: 6, dayStart: "07:00", showWeightNumbers: numbers, photosOn, units: { weight: "kg", height: "cm" } },
      blocks: [{ creatorId: C, id: "b1", goal, start }],
      workouts, mealLogs, walks, weighIns: w, checkIns: history,
      ladderSteps: { push_up: 2 },
    },
    version: 1,
  };
}

const busyHistory = ["2026-10-18", "2026-10-25"].map((date) => ({
  creatorId: C, date, answers: ["busy"], accepted: true, at: day(date),
  result: { date, change: { kind: "same" }, copy: "Same plan. It's working, so keep going.", why: ["You did 3 of 3 workouts and logged 15 of 21 meals."], counts: true, askNormalNow: null,
    facts: { workoutsDone: 3, workoutsPlanned: 3, mealsLogged: 15, mealsPlanned: 21, walks: 2, weighIns: 3, averageKg: 74, changeSinceStartKg: -0.6, rule: "same" } },
}));

// ---------- audit (same rules as check-ui.cjs) ----------
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
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      if (["SCRIPT", "STYLE", "NOSCRIPT", "OPTION"].includes(el.tagName)) continue;
      if (!visible(el)) continue;
      const f = parseFloat(getComputedStyle(el).fontSize);
      const base = parseFloat(getComputedStyle(doc).fontSize) / 16;
      if (f < 15 * base - 0.01) problems.push(`text ${f}px: "${n.textContent.trim().slice(0, 40)}"`);
    }
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="switch"], [role="radio"], [role="checkbox"], [role="tab"], [tabindex]:not([tabindex="-1"])';
    document.querySelectorAll(sel).forEach((el) => {
      if (!visible(el) || el.closest('[aria-hidden="true"]')) return;
      if (el.tagName === "INPUT" && el.parentElement && el.parentElement.getBoundingClientRect().height >= 48) return;
      const r = el.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5)
        problems.push(`target ${Math.round(r.width)}x${Math.round(r.height)}: ${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`);
    });
    return problems;
  });
}

let failed = 0;
const results = [];
async function check(page, name, { shot = true, full = true, extra } = {}) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const problems = await audit(page);
  if (extra) problems.push(...(await extra(page)));
  if (problems.length) {
    failed++;
    results.push(`FAIL ${name}`);
    problems.slice(0, 20).forEach((x) => results.push("   - " + x));
  } else results.push(`PASS ${name}`);
  if (shot) await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: full });
}

const noWeight = async (page) => {
  const t = await page.evaluate(() => document.body.innerText + " " + [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")).join(" "));
  return /\d\s?(kg|lb)\b/.test(t) ? ["weight number shown in hidden mode"] : [];
};
const expectText = (text) => async (page) => ((await page.getByText(text, { exact: false }).count()) ? [] : [`missing "${text}"`]);

async function open(browser, s, { scheme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true });
  await ctx.addInitScript((v) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("8020jacked:v1", v);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(s));
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  return { ctx, page };
}
const go = (page, url) => page.goto(BASE + url, { waitUntil: "networkidle" });
const heading = (page, text) => page.getByRole("heading", { level: 1, name: text }).waitFor();

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const img = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r: 246, g: 195, b: 223 } } }).jpeg().toBuffer();
  const browser = await chromium.launch();

  // ---- A: weighs, numbers on ----
  {
    const { ctx, page } = await open(browser, seed());
    await go(page, "/progress");
    await heading(page, "Progress");
    await check(page, "p1-weight", { extra: async (p) => [
      ...((await p.getByRole("tab", { name: "Weight", selected: true }).count()) ? [] : ["did not open on Weight"]),
      ...((await p.locator('nav[aria-label="Main"] [aria-current="page"]').innerText()).includes("Progress") ? [] : ["Progress tab not active"]),
      ...((await p.getByRole("link", { name: /^You/ }).count()) ? [] : ["no You circle"]),
    ] });
    for (const v of ["Wins", "Strength", "Photos"]) {
      await page.getByRole("tab", { name: v }).click();
      await page.getByRole("tab", { name: v, selected: true }).waitFor();
      await check(page, `p1-${v.toLowerCase()}`);
    }
    await go(page, "/progress/weight");
    await heading(page, "Weight history");
    await check(page, "p2-weight-history");
    await page.getByRole("button", { name: /Edit or delete/ }).first().click();
    await check(page, "p2-edit-sheet", { full: false });
    await page.getByRole("button", { name: "Delete this weigh-in" }).click();
    await check(page, "p2-delete-confirm", { full: false });
    await page.getByRole("button", { name: "Keep it" }).click();
    await page.getByRole("button", { name: "Close" }).click();

    await go(page, "/progress/photos");
    await heading(page, "Photos");
    await check(page, "p3-photos-off");
    await page.getByRole("switch", { name: /Progress photos/ }).click();
    for (let i = 0; i < 2; i++) {
      await page.locator('input[type="file"]').setInputFiles({ name: "p.jpg", mimeType: "image/jpeg", buffer: img });
      await page.getByRole("button", { name: "Take or choose a photo" }).waitFor();
    }
    await page.getByText("Compare").first().waitFor();
    const dims = await page.evaluate(async () => {
      const i = document.querySelector("img");
      if (!i) return null;
      await i.decode();
      return [i.naturalWidth, i.naturalHeight];
    });
    await check(page, "p3-photos-compare", { extra: async () => (dims && dims[0] === 1280 && dims[1] === 960 ? [] : [`photo not compressed to 1280: ${dims}`]) });
    await page.getByRole("switch", { name: /Progress photos/ }).click();
    await check(page, "p3-turn-off-ask", { full: false, extra: expectText("Turn off and delete") });
    await page.getByRole("button", { name: "Keep them" }).click();

    await go(page, "/progress/wins");
    await heading(page, "Wins");
    await check(page, "p5-wins");

    // check-in 1: she weighs
    await go(page, "/check-in");
    await heading(page, "Your week");
    await check(page, "c1-your-week", { extra: expectText("that's fine") });
    await page.getByRole("button", { name: "Something wrong? Edit a number" }).click();
    await check(page, "c1-edit-sheet", { full: false });
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await heading(page, "Weight this week");
    await check(page, "c2-weight", { extra: expectText("How do your clothes feel?") });
    await page.getByRole("button", { name: "Same" }).click();
    await page.reload({ waitUntil: "networkidle" });
    await heading(page, "Weight this week"); // ?step= resumes after reload
    const kept = await page.getByRole("button", { name: "Same", pressed: true }).count();
    await page.getByRole("button", { name: "Next" }).click();
    await heading(page, "Anything get in the way?");
    await page.getByRole("checkbox", { name: "Busy week" }).click();
    await check(page, "c3-in-the-way", { extra: async () => (kept ? [] : ["draft not kept after reload"]) });
    await page.getByRole("button", { name: "See my result" }).click();
    await page.getByText("Next week").first().waitFor();
    await check(page, "c4-result", { full: false });
    await page.getByRole("button", { name: "Why this change?" }).click();
    await check(page, "c5-why-sheet", { full: false });
    await page.getByRole("button", { name: "Close" }).first().click();
    await page.getByRole("button", { name: "Sounds good" }).click();
    await page.waitForURL(/\/(today|check-in\/done|plan-updated)/);
    await go(page, "/progress/check-ins");
    await heading(page, "Check-in history");
    await check(page, "p4-check-in-history", { extra: expectText("1 check-in") });
    await page.getByRole("link", { name: /Sunday 1 November/ }).click();
    await heading(page, "Why this change");
    await check(page, "c5-past-week");

    // 200% text on the busiest screens
    for (const [url, name] of [["/progress", "p1-weight-text200"], ["/progress/check-ins", "p4-text200"]]) {
      await go(page, url);
      await page.addStyleTag({ content: "html{font-size:200% !important}" });
      await check(page, name);
    }
    await ctx.close();
  }

  // ---- dark ----
  {
    const { ctx, page } = await open(browser, seed(), { scheme: "dark" });
    await go(page, "/progress");
    await heading(page, "Progress");
    await check(page, "p1-weight-dark", { full: false });
    await go(page, "/check-in?step=result");
    await page.getByText("Next week").first().waitFor();
    await check(page, "c4-result-dark", { full: false });
    await ctx.close();
  }

  // ---- hidden numbers ----
  {
    const { ctx, page } = await open(browser, seed({ numbers: false }));
    await go(page, "/progress");
    await heading(page, "Progress");
    await check(page, "p1-weight-numbers-off", { extra: noWeight });
    await go(page, "/progress/weight");
    await heading(page, "Weight history");
    await check(page, "p2-numbers-off", { extra: noWeight });
    await go(page, "/check-in?step=weight");
    await heading(page, "Weight this week");
    await check(page, "c2-numbers-off", { extra: noWeight });
    await ctx.close();
  }

  // ---- B: doesn't weigh herself; check-in 2 ----
  {
    const { ctx, page } = await open(browser, seed({ noWeigh: true, goal: "steady" }));
    await go(page, "/progress");
    await heading(page, "Your wins and strength");
    await check(page, "p1-no-weigh", { extra: async (p) => [
      ...((await p.getByRole("tab", { name: "Weight" }).count()) ? ["Weight view shown"] : []),
      ...((await p.getByRole("tab", { name: "Wins", selected: true }).count()) ? [] : ["did not open on Wins"]),
      ...(await noWeight(p)),
    ] });
    await go(page, "/check-in");
    await heading(page, "Your week");
    await page.getByRole("button", { name: "Next" }).click();
    await heading(page, "How do your clothes feel?");
    await page.getByRole("radio", { name: "Looser" }).click();
    await check(page, "c2b-clothes", { extra: noWeight });
    await page.getByRole("button", { name: "Next" }).click();
    await heading(page, "Anything get in the way?");
    await page.getByRole("checkbox", { name: "Nothing" }).click();
    await page.getByRole("button", { name: "See my result" }).click();
    await page.getByText("Next week").first().waitFor();
    await check(page, "c4-result-no-weigh", { full: false, extra: noWeight });
    await page.getByRole("button", { name: "Sounds good" }).click();
    await page.waitForURL(/\/(today|check-in\/done|plan-updated)/);
    await go(page, "/check-in/done");
    await check(page, "c6-twelve-weeks");
    await page.getByRole("button", { name: "What's next" }).click();
    await heading(page, "Your next 12 weeks");
    await page.getByRole("radio", { name: "Lose some weight" }).click();
    await check(page, "c7-next-12-weeks", { extra: expectText("Roughly what do you weigh now?") });
    await ctx.close();
  }

  // ---- C8 and C1b ----
  {
    const { ctx, page } = await open(browser, seed({ history: busyHistory }));
    await go(page, "/check-in?step=way");
    await heading(page, "Anything get in the way?");
    await page.getByRole("checkbox", { name: "Busy week" }).click();
    await page.getByRole("button", { name: "See my result" }).click();
    await heading(page, "Is this your normal now?");
    await check(page, "c8-normal-now");
    await page.getByRole("button", { name: "Yes, plan around it" }).click();
    await page.getByText("Next week").first().waitFor();
    await check(page, "c4-plan-around-it", { full: false, extra: expectText("Workouts get shorter") });
    await ctx.close();
  }
  {
    const { ctx, page } = await open(browser, seed({ logs: false }));
    await go(page, "/check-in");
    await heading(page, "Your week");
    await check(page, "c1b-nothing-logged", { extra: expectText("Nothing logged this week. Same plan, fresh start.") });
    await ctx.close();
  }

  await browser.close();
  console.log(results.join("\n"));
  console.log(failed ? `RESULT: FAIL (${failed})` : "RESULT: PASS");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log(results.join("\n"));
  console.error(e);
  process.exit(1);
});
