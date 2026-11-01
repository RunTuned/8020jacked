/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script */
/* QA train fixes check at 390x844: a dumbbell user's 20-minute workout (dumbbell moves, "you need dumbbells",
   "About 20 min left"), Hurts -> Cancel changes nothing, Hurts twice on the same move (set aside, Cancel takes
   it back, swaps stay in the same body area, a hurt after a swap counts on the new move), pause during rest
   then reload (the clock keeps its time), then the rest of the workout to Well done.
   Run against a production server: npm run build && npx next start -p 3302; BASE=http://localhost:3302 node scripts/check-train-fixes.cjs */
const { chromium } = require("playwright");
const path = require("path");
const BASE = process.env.BASE || "http://localhost:3302";
const SHOTS = process.env.SHOTS || path.join(require("os").tmpdir(), "check-train-fixes");

/** An invented, set-up test profile (no real person): dumbbells and floor, 20 min, today is the first plan day. */
function storageState() {
  const d = new Date(Date.now() - 4 * 3600_000); // the app day rolls over 3 h before a 07:00 day start
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const c = { creatorId: "8020jacked" };
  const value = JSON.stringify({
    version: 1,
    state: {
      schemaVersion: 1,
      creatorId: "8020jacked",
      createdOn: today,
      planStart: today,
      profile: { ...c, firstName: "Test", age: 41, heightCm: 168, setupWeightKg: 72, noWeigh: false, goal: "stronger", termsAcceptedOn: today, safetySeenOn: today },
      training: { ...c, daysPerWeek: 3, minutes: 20, equipment: ["floor", "dumbbells"] },
      food: { ...c, mealsPerDay: 3, cookOrBuy: "cook", fasting: false, allergies: [], cookingFor: 1 },
      foodChanges: [{ ...c, from: "0000-01-01", mealsPerDay: 3, cookOrBuy: "cook", fasting: false }],
      blocks: [{ ...c, id: "b1", goal: "stronger", start: today }],
      settings: { ...c, checkInDay: 6, dayStart: "07:00", reminder: "morning", quietOnAwayDays: true, emailReminders: false, units: { weight: "kg", height: "cm" }, theme: "system", showWeightNumbers: true, sharedPhone: false, bigScreen: false, stillPictures: false, photosOn: false, installShown: true, ringerTipShown: true },
    },
  });
  return { cookies: [], origins: [{ origin: new URL(BASE).origin, localStorage: [{ name: "8020jacked:v1", value }] }] };
}
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const txt = (p) => p.evaluate(() => document.body.innerText);
const st = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('8020jacked:v1')).state);
const shot = (p, n) => p.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: true });
const clock = async (p) => { const m = (await txt(p)).match(/(\d):(\d\d)/); return m ? +m[1] * 60 + +m[2] : null; };
const title = (p) => p.locator('h1').first().innerText();
(async () => {
  require('fs').mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, storageState: storageState(), serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.log('PAGE ERR', String(e)); fails++; });
  const s0 = await st(await (async () => { await page.goto(BASE + '/today'); return page; })());
  ok(JSON.stringify(s0.training.equipment) === '["floor","dumbbells"]' && s0.training.minutes === 20, 'seed is a dumbbells + floor user, 20 min');

  // ---- dumbbell user's workout: Ready
  await page.goto(BASE + '/train/workout'); await page.waitForTimeout(1200);
  let t = await txt(page); await shot(page, 'c1-ready');
  ok(/Goblet squat/i.test(t), 'Ready lists the goblet squat');
  ok(/Dumbbell/i.test(t), 'Ready lists dumbbell moves');
  ok(!/Sit-to-stand/i.test(t), 'no sit-to-stand for a dumbbell floor user');
  ok(/20 min · you need dumbbells/.test(t), 'Ready line: "20 min · you need dumbbells" (not "no kit needed")');
  console.log('  Ready:', t.split('\n').filter(Boolean).slice(2, 14).join(' | '));
  await page.getByRole('button', { name: 'Start', exact: true }).tap(); await page.waitForTimeout(800);
  t = await txt(page); await shot(page, 'c2-set1');
  ok(/About 20 min left/.test(t), '"About 20 min left" at the start');
  const move1 = (await title(page)).trim();
  ok(/goblet/i.test(move1), 'first move is the goblet squat: ' + move1);

  // ---- Hurts -> Cancel changes nothing
  const before = await st(page);
  await page.getByRole('button', { name: /Hurts\? Swap this move/ }).tap(); await page.waitForTimeout(600);
  await shot(page, 'c3-hurts-open');
  const optsText = await page.locator('dialog[open] button').allInnerTexts();
  console.log('  Swap options:', optsText.filter((x) => !/Cancel|Undo/.test(x)).join(' | '));
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().tap(); await page.waitForTimeout(500);
  let s = await st(page);
  ok(JSON.stringify(s.hurts) === JSON.stringify(before.hurts) && JSON.stringify(s.setAside) === JSON.stringify(before.setAside), 'Cancel: no hurt saved, nothing set aside');
  ok((await title(page)).trim() === move1, 'Cancel: same move stays');
  // close button (X) also cancels
  await page.getByRole('button', { name: /Hurts\? Swap this move/ }).tap(); await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Cancel', exact: true }).first().tap(); await page.waitForTimeout(500);
  s = await st(page); ok(s.hurts.length === before.hurts.length, 'the sheet close button also changes nothing');

  // ---- Hurts twice on the same move (an earlier hurt on it from another day)
  const cur = (await st(page)).workouts.find((w) => w.status === 'in_progress');
  const id1 = 'EX-005';
  await page.evaluate((id) => {
    const k = '8020jacked:v1'; const v = JSON.parse(localStorage.getItem(k));
    v.state.hurts.push({ creatorId: '8020jacked', date: '2026-10-01', exerciseId: id, bodyPart: 'quads' });
    localStorage.setItem(k, JSON.stringify(v));
  }, id1);
  await page.reload(); await page.waitForTimeout(1200);
  ok((await title(page)).trim() === move1, 'reload mid-set resumes on the same move');
  await page.getByRole('button', { name: /Hurts\? Swap this move/ }).tap(); await page.waitForTimeout(600);
  t = await txt(page); await shot(page, 'c4-hurts-twice');
  ok(/That's twice, so it's set aside/.test(t), 'second hurt on the same move: "That\'s twice, so it\'s set aside"');
  s = await st(page);
  ok(s.hurts.filter((h) => h.exerciseId === id1).length === 2 && s.setAside.some((x) => x.exerciseId === id1), 'both hurts on ' + id1 + ', set aside');
  // Cancel takes the second hurt back
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().tap(); await page.waitForTimeout(500);
  s = await st(page);
  ok(s.hurts.filter((h) => h.exerciseId === id1).length === 1 && !s.setAside.some((x) => x.exerciseId === id1), 'Cancel on the twice sheet: back to one hurt, not set aside');
  ok((await title(page)).trim() === move1, '...and the goblet squat is back');
  // now really: twice and pick a swap
  await page.getByRole('button', { name: /Hurts\? Swap this move/ }).tap(); await page.waitForTimeout(600);
  const opts = (await page.locator('dialog[open] button').allInnerTexts()).filter((x) => !/Cancel|Undo/.test(x) && x.trim());
  ok(opts.length > 0, 'swap options: ' + opts.join(' | '));
  ok(opts.every((o) => !/press|row|carry|plank|push|pull/i.test(o)), 'swap options are legs moves only');
  const pickName = opts.find((o) => /Dumbbell/.test(o)) ?? opts[0];
  await page.locator('dialog[open]').getByRole('button', { name: pickName, exact: true }).tap(); await page.waitForTimeout(700);
  const move1b = (await title(page)).trim();
  s = await st(page);
  ok(move1b === pickName && s.setAside.some((x) => x.exerciseId === id1), 'swapped to ' + move1b + ', goblet squat set aside');
  await shot(page, 'c5-swapped');
  // hurt on the swapped move counts on it, not on the old move
  const nBefore = s.hurts.length;
  await page.getByRole('button', { name: /Hurts\? Swap this move/ }).tap(); await page.waitForTimeout(600);
  t = await txt(page);
  s = await st(page);
  const last = s.hurts[s.hurts.length - 1];
  ok(s.hurts.length === nBefore + 1 && last.exerciseId !== id1, 'a hurt on the swapped move is counted on it (' + last.exerciseId + ')');
  ok(!/That's twice/.test(t), 'no "twice" for a first hurt on the swapped move');
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().tap(); await page.waitForTimeout(500);
  ok((await st(page)).hurts.length === nBefore, 'Cancel takes it back');

  // ---- pause during rest, then reload
  await page.getByRole('button', { name: 'Done set' }).tap(); await page.waitForTimeout(700);
  ok(/step=rest/.test(page.url()), 'rest after a set');
  await page.getByRole('button', { name: 'Pause the workout' }).tap(); await page.waitForTimeout(400);
  const atPause = await clock(page);
  await shot(page, 'c6-paused');
  await page.waitForTimeout(5000);
  await page.reload(); await page.waitForTimeout(1500);
  t = await txt(page); await shot(page, 'c7-paused-after-reload');
  const afterReload = await clock(page);
  ok(/Paused/.test(t) && /step=pause/.test(page.url()), 'reload while paused: still paused, in rest');
  ok(afterReload !== null && Math.abs(afterReload - atPause) <= 1, `rest clock kept while paused: ${atPause}s at pause, ${afterReload}s after 5 s + reload`);
  await page.getByRole('button', { name: 'Keep going' }).first().tap(); await page.waitForTimeout(2200);
  const running = await clock(page);
  ok(running !== null && running <= atPause - 1 && running >= atPause - 4, `resumed from where it paused: ${running}s`);
  await page.reload(); await page.waitForTimeout(1500);
  const afterReload2 = await clock(page);
  ok(/step=rest/.test(page.url()) && afterReload2 !== null && Math.abs(afterReload2 - (running - 1.5)) <= 2, `reload after the pause is right: ${afterReload2}s`);
  await shot(page, 'c8-rest-after-reload');

  // ---- walk the rest of the dumbbell workout
  const seen = new Set([move1b]);
  for (let i = 0; i < 60; i++) {
    const step = new URL(page.url()).searchParams.get('step');
    if (step === 'done') break;
    if (step === 'rest') { await page.getByRole('button', { name: 'Skip' }).tap(); await page.waitForTimeout(400); continue; }
    if (step === 'lift' || step === 'hold') {
      seen.add((await title(page)).trim());
      const done = page.getByRole('button', { name: 'Done set' });
      if (await done.count()) { await done.tap(); }
      else {
        await page.getByRole('button', { name: 'Start', exact: true }).tap();
        await page.getByRole('button', { name: 'Stop', exact: true }).tap({ timeout: 15000 });
      }
      await page.waitForTimeout(400);
      continue;
    }
    await page.waitForTimeout(400);
  }
  t = await txt(page); await shot(page, 'c9-done');
  console.log('  Moves done:', [...seen].join(' | '));
  ok(/Well done/.test(t), 'reached Well done');
  ok([...seen].filter((n) => /Dumbbell|Goblet/i.test(n)).length >= 3, 'dumbbell main lifts in the workout');
  await page.getByRole('button', { name: 'Just right' }).tap().catch(() => {});
  await page.getByRole('button', { name: 'Done for today' }).tap(); await page.waitForTimeout(1200);
  const w = (await st(page)).workouts.find((x) => x.id === cur.id);
  ok(w && w.status === 'done' && w.sets.length === 15, `saved: ${w && w.status}, ${w && w.sets.length} sets`);
  await browser.close();
  console.log(fails ? `RESULT: ${fails} FAIL` : 'RESULT: PASS');
  process.exit(fails ? 1 : 0);
})();
