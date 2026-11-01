/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
/* Browser check for Today and Food (390x844): every screen, light + 200% text (dark on the main two).
   No horizontal scroll, no text under 15px, no tap target under 48px. Seeds the store by writing
   localStorage "8020jacked:v1" (missing fields are filled by the store's own migrate()).
   Run against a production server: npm run build && npx next start -p 3102, then
   BASE=http://localhost:3102 node scripts/check-today.cjs */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3102";
const shots = path.resolve(__dirname, "..", "docs", "build-shots", "today");

const C = "8020jacked";
const MON = "2026-11-02";
const at = (date, h = 10) => new Date(`${date}T${String(h).padStart(2, "0")}:00:00`);

/** An invented test profile (no real person's data). */
function state(o = {}) {
  const cook = o.cook ?? "cook";
  const planStart = o.planStart ?? "2026-10-26";
  return {
    planStart,
    createdOn: planStart,
    profile: { creatorId: C, firstName: "Sam", age: 41, heightCm: 166, setupWeightKg: 78, noWeigh: false, goal: "lose", termsAcceptedOn: planStart, safetySeenOn: planStart },
    training: { creatorId: C, daysPerWeek: 3, minutes: 20, equipment: ["floor"] },
    food: { creatorId: C, mealsPerDay: 3, cookOrBuy: cook, fasting: false, allergies: o.allergies ?? [], cookingFor: 2 },
    foodChanges: [{ creatorId: C, from: "0000-01-01", mealsPerDay: 3, cookOrBuy: cook, fasting: false }],
    blocks: [{ creatorId: C, id: "b1", goal: "lose", start: planStart }],
    lastOpened: (o.lastOpened ?? at(o.today ?? MON, 8)).getTime(),
    workouts: o.workouts ?? [],
    awayDays: o.awayDays ?? [],
    mealLogs: o.mealLogs ?? [],
    walks: o.walks ?? [],
    adjustments: { creatorId: C, kcalDelta: 0, sideDelta: 0, extraSets: { legs: 0, push: 0, pull: 0, core: 0 }, speedBrakeOn: o.speedBrakeOn ?? null },
    allergyNotices: o.allergyNotices ?? [],
  };
}

const done = (date) => ({
  creatorId: C, id: "w1", date, letter: "A", minutes: 20, status: "done", sets: [], moveEffort: {}, effort: "just_right",
  bigScreen: false, taster: false, startedAt: at(date, 9).getTime(), endedAt: at(date, 9).getTime() + 1200000,
});

const scenarios = [
  {
    name: "cook",
    today: MON,
    st: state({ mealLogs: [{ creatorId: C, date: MON, slot: 0, kind: "plan", at: at(MON, 8).getTime() }] }),
    pages: [
      { name: "T1-today", url: "/today", modes: ["light", "dark", "text200"] },
      { name: "T1-meal-saved-undo", url: "/today", act: async (p) => p.getByRole("button", { name: "Ate the plan" }).click() },
      { name: "T1-meal3-instead", url: "/today", act: async (p) => p.getByRole("button", { name: /instead$/ }).click() },
      { name: "T2-week-not-today", url: "/today", act: async (p) => { await p.getByRole("button", { name: "Not today" }).click(); await p.waitForURL("**/today/week"); } },
      { name: "T2-week", url: "/today/week", modes: ["light", "text200"] },
      { name: "T2-move-sheet", url: "/today/week", act: async (p) => p.getByRole("button", { name: "Move to another day" }).first().click() },
      { name: "T6-away", url: "/today/away", modes: ["light", "text200"] },
      { name: "T3-weigh-in", url: "/today/weigh-in?from=/progress", modes: ["light", "text200"] },
      { name: "F1-food", url: "/food", modes: ["light", "dark", "text200"] },
      { name: "F1-eating-out", url: "/food", act: async (p) => p.getByRole("button", { name: "Eating out tips" }).click() },
      { name: "F2-meal", url: `/food/meal/${MON}/1?from=/food`, modes: ["light", "text200"] },
      { name: "F2-meal-grams", url: `/food/meal/${MON}/1?from=/food`, act: async (p) => p.getByRole("switch", { name: /Show grams/ }).click() },
      { name: "F3-swap", url: `/food/swap/${MON}/1?from=/food`, modes: ["light", "text200"] },
      { name: "F4-list", url: "/food/list", modes: ["light", "text200"] },
      { name: "F5-cook", url: "/food/cook", modes: ["light", "text200"] },
      { name: "F6-other", url: `/food/other?date=${MON}&slot=1&back=/today`, modes: ["light", "text200"] },
      { name: "F7-size", url: `/food/other?date=${MON}&slot=1&back=/today&step=size&where=home`, modes: ["light", "text200"] },
      {
        name: "F7-done-back-on-today",
        url: `/food/other?date=${MON}&slot=1&back=/today&step=size&where=home`,
        act: async (p) => { await p.getByRole("radio", { name: "Big" }).click(); await p.getByRole("button", { name: "Done" }).click(); await p.waitForURL("**/today"); },
      },
      { name: "T1b-payment-preview", url: "/today?preview=payment" },
      { name: "T8-locked-preview", url: "/today?preview=locked", modes: ["light", "text200"] },
    ],
  },
  { name: "done", today: MON, st: state({ workouts: [done(MON)], walks: [{ creatorId: C, date: MON }] }), pages: [{ name: "T5-done", url: "/today", modes: ["light", "text200"] }] },
  { name: "rest", today: "2026-11-03", st: state({ today: "2026-11-03" }), pages: [{ name: "T7-rest", url: "/today", modes: ["light", "text200"] }] },
  {
    name: "away",
    today: MON,
    st: state({ awayDays: [MON, "2026-11-03", "2026-11-04"] }),
    pages: [
      { name: "T7-away", url: "/today" },
      { name: "F1-away", url: "/food" },
    ],
  },
  {
    name: "buyer",
    today: MON,
    st: state({ cook: "buy", allergies: ["nuts"] }),
    pages: [
      { name: "T1-buyer", url: "/today" },
      { name: "F2b-meal", url: `/food/meal/${MON}/1?from=/food`, modes: ["light", "text200"] },
      { name: "F3-swap-buyer", url: `/food/swap/${MON}/1?from=/food` },
      { name: "F8-pickup", url: "/food/pickup", modes: ["light", "text200"] },
      { name: "F1-buyer", url: "/food" },
    ],
  },
  {
    name: "welcome",
    today: MON,
    st: state({ lastOpened: at("2026-10-26", 9) }),
    pages: [{ name: "T4-welcome-back", url: "/today", expectUrl: "/today/welcome-back", modes: ["light", "text200"] }],
  },
  {
    name: "banners",
    today: "2026-11-08",
    st: state({ today: "2026-11-08" }),
    pages: [{ name: "T1-check-in-banner", url: "/today" }],
  },
  {
    name: "brake",
    today: MON,
    st: state({ speedBrakeOn: MON }),
    pages: [{ name: "T1-speed-brake-banner", url: "/today" }],
  },
  {
    name: "allergy",
    today: MON,
    st: state({ allergies: ["nuts"], allergyNotices: [{ creatorId: C, date: MON, allergens: ["nuts"], flagged: ["cashews"] }] }),
    pages: [{ name: "T1-allergy-banner", url: "/today" }],
  },
];

const MODES = {
  light: { scheme: "light", text: 1 },
  dark: { scheme: "dark", text: 1 },
  text200: { scheme: "light", text: 2 },
};

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
    const base = parseFloat(getComputedStyle(doc).fontSize) / 16;
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
      if (fs < 15 * base - 0.01) problems.push(`text ${fs}px: "${n.textContent.trim().slice(0, 40)}"`);
    }
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="switch"], [role="radio"], [role="checkbox"], [role="tab"], [tabindex]:not([tabindex="-1"])';
    document.querySelectorAll(sel).forEach((el) => {
      if (!visible(el)) return;
      if (el.tagName === "INPUT" && el.parentElement && el.parentElement.getBoundingClientRect().height >= 48) {
        const r = el.parentElement.getBoundingClientRect();
        if (r.width < 48 || r.height < 48) problems.push(`field ${Math.round(r.width)}x${Math.round(r.height)}`);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 47.5 || r.height < 47.5)
        problems.push(`target ${Math.round(r.width)}x${Math.round(r.height)}: ${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`);
    });
    // Copy rule: never calories on screen.
    if (/\b(kcal|calorie)/i.test(document.body.innerText)) problems.push("calories on screen");
    return { problems };
  });
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch();
  let failed = 0;
  let checked = 0;
  for (const sc of scenarios) {
    for (const p of sc.pages) {
      for (const m of p.modes ?? ["light"]) {
        const mode = MODES[m];
        const ctx = await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          colorScheme: mode.scheme,
          isMobile: true,
          hasTouch: true,
        });
        const page = await ctx.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.clock.setFixedTime(at(sc.today, 10));
        await page.addInitScript(
          ([key, value, text]) => {
            if (!sessionStorage.getItem("seeded")) {
              localStorage.setItem(key, value);
              sessionStorage.setItem("seeded", "1");
            }
            if (text !== 1) {
              const add = () => {
                const s = document.createElement("style");
                s.textContent = `html{font-size:${text * 100}% !important}`;
                document.head.appendChild(s);
              };
              if (document.head) add();
              else document.addEventListener("DOMContentLoaded", add);
            }
          },
          ["8020jacked:v1", JSON.stringify({ state: sc.st, version: 1 }), mode.text],
        );
        await page.goto(BASE + p.url, { waitUntil: "networkidle" });
        if (p.expectUrl) await page.waitForURL("**" + p.expectUrl);
        await page.waitForSelector('[aria-busy="true"]', { state: "detached", timeout: 5000 }).catch(() => {});
        if (p.act) await p.act(page);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);
        const res = await audit(page);
        if (errors.length) res.problems.push(...errors.map((e) => "page error: " + e));
        if (p.expectUrl && !page.url().includes(p.expectUrl)) res.problems.push(`expected ${p.expectUrl}, at ${page.url()}`);
        const tag = `${p.name} @ ${m}`;
        checked++;
        if (res.problems.length) {
          failed++;
          console.log(`FAIL ${tag}`);
          res.problems.slice(0, 20).forEach((x) => console.log("   - " + x));
        } else console.log(`PASS ${tag}`);
        await page.screenshot({ path: path.join(shots, `${p.name}-${m}.png`), fullPage: true });
        await ctx.close();
      }
    }
  }
  await browser.close();
  console.log(failed ? `RESULT: FAIL (${failed} of ${checked})` : `RESULT: PASS (${checked} checks)`);
  process.exit(failed ? 1 : 0);
})();
