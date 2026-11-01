# Open questions and decisions

The build decided each item below and wrote it down here. Jennifer can change any of them; each one is a single constant or function in `src/lib/engine`.

## Engine, store and services (plan-engine builder, 1 Nov 2026)

### Content shape
1. **`cues` is a list.** `src/content/exercises.json` gives `cues` as a list of strings, but the brief said one string. `Exercise.cues` is typed `string[]`, and the parser accepts either form.
2. **Rows that can't be checked are dropped.** A recipe or bought item with no `allergens` field never gets served.
3. **Content gap for buyers.** With gluten and dairy allergies, `bought.json` has no safe ready meal and no safe grab-and-go main. The engine falls back from ready meal, to grab-and-go main, to a hand-portion line. The content builder could add one or two gluten-free, dairy-free ready meals.

### Workouts
4. **Equipment.** Chair, wall and no-kit moves are always allowed. Bands and dumbbells are allowed only when ticked. `bar` (pull-up bar) is never offered, because A6 has no bar option. If "No floor" is ticked, it wins over "Floor space": no floor-position moves.
5. **Session make-up.** Each session takes the first N patterns from its list:
   - A "Legs and push": squat, horizontal push, horizontal pull, lunge, vertical push, core, hinge.
   - B "Hips and pull": hinge, horizontal pull, horizontal push, lunge, vertical pull, core, squat.
   - C "Legs and core": squat, core, horizontal push, lunge, hinge, horizontal pull, core.

   If a pattern has no usable move, the next pattern fills the slot. Within a pattern, the longest usable ladder wins (the skill ladders), and it starts on its lowest usable rung. A session never repeats a move or a ladder.
6. **Session rotation.** 2 or 3 days: A/B alternate and carry on across weeks (A B A, then B A B). 4 days: A B C cycle.
7. **Days.** The engine picks the fewest back-to-back pairs, then the widest gap (counting Sunday to Monday). That gives Mon+Thu, Mon/Wed/Fri, and Mon/Wed/Fri/Sun. Sun→Mon is back to back across weeks; with 4 days that can't be avoided.
8. **Not today and Move stay inside the current Mon–Sun week.** If there's no free home day before Sunday, the workout is dropped.
9. **Progression between steps.** When every set reaches the target, the next target is one more rep (or 5 more seconds), up to rep_max. A step up always needs a Just right or Too easy rating. In big screen mode, any increase needs that rating, because the numbers saved are the planned ones. "Too hard" holds the move where it is. The step back after two Too hard sessions (rules summary §7) is not in SPEC, so it isn't built.
10. **Check-in training step.** One extra set on the first move of an area in each session. Areas go in order: legs, push, pull, core. Each area can go up by one set. "Sore" blocks a step up that week.
11. **Easy week (T4).** One set fewer per move (at least 1), with no progression.
12. **Taster.** Session A, 10 minutes. It never counts toward the week or the 12 weeks, and it never moves the plan up.

### Food
13. **Meal types per slot.**
    - 2 meals a day: two mains.
    - 3 meals: breakfast and two mains.
    - 4 meals: breakfast, two mains and a snack (the 4th meal).
    - Fasting: two mains.
14. **Serving size.** The serving multiplier is kept between ½ and 3. Recipes whose multiplier would fall in that range are preferred.
15. **Batch cooking.** There are two cooks a week, covering Mon–Thu and Fri–Sun. Each cook has 3 main recipes (2 if the block has fewer than 6 main meals). Breakfasts and snacks rotate between 2 recipes, preferring ones that take 10 minutes or less.
16. **Away days.** Cooks see a hand-portion line with no recipe ("Meals stay simple"). Buyers keep their items. Both lists leave away days out.
17. **"Cooking for N".** The list scales to her serving multiplier plus 1 serving for each other person. Grams and ml round up to 10, spoons to ½, and counts up to whole. "To taste" items show no amount.
18. **Meals a day, cook/buy and fasting start tomorrow (S5).** The shopping and pick-up lists use the settings in place on Monday, so they change next week. Allergies apply at once.
19. **New allergy.** The meals that held the allergen are replaced, and only those (stable picks). Flagged items are the ingredients (or bought items) of removed meals that no remaining meal uses. Logged meals keep what was logged.
20. **Daily total and its limits.** Every kcal total is rounded to a whole number. The speed brake can't take the daily total above maintenance. Check-in cuts stop at maintenance − 500 and at the 1,500 floor. A cut that would change nothing counts as "no cut".

### Check-in
21. **The speed brake runs only on "Lose some weight".** A loss under 0.5 kg is ignored. That rule comes from C5's "under 0.5 kg ignored", applied here rather than to the stall rule, where it would clash with 0.25% a week. The brake fires at most once for each set of weigh-ins after the last brake. The banner shows for 7 days. If a brake fired during the check-in week, that is the week's one change.
22. **Stall rule.** The engine compares weekly averages over three weeks running. Each of those weeks, and the week before each, needs 3 or more weigh-ins. A new cut also needs 3 weeks since the last accepted food change.
23. **BMI 20 switch.** It uses the 7-day average weight (else the latest weigh-in, else the setup weight). It triggers at BMI 20 or lower. "Lose" is hidden below 20.
24. **"Little logging" means fewer than half of the planned meals were logged.** An "away week" means 4 or more away days. Either one means no food change.
25. **C3 answers.** Sore, bad sleep, busy or fasting blocks a food change, and C4 says why in plain words.
26. **C8 "Yes, plan around it".** For busy, bad sleep or sore, workouts get one step shorter. For fasting, fasting mode turns on. "Nothing" never triggers C8.
27. **Cap of 3 food changes per 12 weeks.** It counts only accepted changes in the current block.
28. **"Lose" is hidden after 2 Lose blocks in the last 365 days.** This uses a rolling year, not the calendar year.
29. **Food-change copy for cooks** is "Meals get a little smaller." The wireframes forbid "smaller" only for buyers. Jennifer may want softer words.

### 12 weeks, logging, data
30. **Which weeks count.** A Mon–Sun week counts toward the 12 if it has any meal log, finished workout, weigh-in or walk tick.
31. **Day start.** The app's day rolls over 3 hours before her day start (6:30 → 3:30), so a late snack logs to the right day.
32. **"Change since start"** is the 7-day average minus the first real weigh-in.
33. **Repeat taps.** A repeat within 1 s of the last *accepted* tap of the same action is ignored.
34. **"Download my data"** is one JSON file without photos. Photos stay in IndexedDB on the phone.
35. **Walk ticks.** At most 3 a week, home days only.

## Progress and check-in (Builder 4, 1 Nov 2026)
36. **C1 "Edit a number"** opens a sheet that sends her to Today › This week to fix the log; the counts are always read from her logs, so there is no separate override number to drift.
37. **C4 "Not this week, keep things the same"** shows only when there is a change to decline. For "Same plan" results, Sounds good is the only button.
38. **Wins (P5)** have no dates for milestones such as "First full push-up · 12 Oct", because the store doesn't record when a ladder step was reached. Wins show the current skill level, the next skill, stronger moves (first → best) and "Clothes looser". "2 workouts away" isn't known, so it isn't shown.
39. **Words-only weight** (numbers off): under 0.5 kg reads "About the same as when you started", a loss reads "Going down, slowly" and a gain reads "A little higher than when you started". With numbers off, the chart has no dots.
40. **C6 "Decide later"** leaves the plan as it is. No store action yet puts "Keep steady" in place without starting a new 12 weeks. Today (T8/C6 on open) owns that.
41. **P3 copy** says "on this phone only", not "on this account only", because v0.1 has no accounts.
