# 8020jacked: build spec for the phone test version (v0.1)

Owner: Jennifer. Signed off 1 Nov 2026. If this file and the wireframes disagree, **the wireframes win**, and you note the mismatch in `docs/QUESTIONS.md`.

## 0. What this build is
- **What it is:** a real, installable phone web app (PWA) for a closed test round with about 10–30 non-techy women.
- **Data:** stays on the phone in localStorage. There is no server, no real accounts and no payments in v0.1.
- **What replaces accounts and payments in v0.1:**
  - Account screens show "Test version: your progress stays on this phone. Download it in You → My data."
  - The free-week and subscription screens show "Test version, free". The real price copy stays visible as a preview, with no pay button.
- **Built so v0.2 can add these without a rewrite:** Supabase logins and data, Dodo Payments and Resend email.
  - All reads and writes go through `src/lib/store`.
  - Everything that will later need the server sits behind small interfaces in `src/lib/services` (auth, billing, email). Each has a "test" implementation for now.
- Every record carries `creatorId: "8020jacked"` (needed later for creators).

## 1. Sources of truth
- **Wireframes and hi-fi boards:** `docs/design/screens/*.dc.html`. Open them in a browser.
  - Each wireframe phone is a `div.ph` with an id: A1…A15c, T1…T8, W1…W11, F1…F8, P1…P5, C1…C8 and S1…S9.
  - `.b` = a button. `.to` = where it goes. `.sv` = what it saves. `.nt` = rules and notes.
- **Hi-fi look:** `docs/design/screens/{OnboardingYou,Onboarding,Main,Workout,BigScreen,WorkoutRest,CheckIn,Progress,WelcomeBack}.dc.html`, with screenshots in `docs/design/shots/`.
  - Brand spec: `docs/design/DesignSystem-PastelBento.md` (look only; ignore its Coach OS tab names).
- **Flow and data:** `docs/design/screens/Flow.dc.html` and `DataMap.dc.html`.

## 2. Look (Soft Pastel Bento)
- **Base:** white canvas, ink `#111111`, muted `#555555`, neutral `#F1F1F1`.
- **Pastels:** training blue `#BFD5FB`, food lime `#E8F8C4`, check-in and weigh-in aqua `#C0F6F4`, progress pink `#F6C3DF`.
- **Shapes:** card radius 30. Pills are fully round. No borders, shadows or gradients.
- **Font:** Plus Jakarta Sans, from `public/fonts/PlusJakartaSans-Variable.ttf` (OFL), with `font-display: swap`.
- **Type:** hero 2rem/800; title 1.25rem/700; body 17px/400; label 15px/600.
  - Nothing is ever under 15px. Inputs are 16px or more. Tap targets are 48px or more.
  - Primary button: an ink pill 56px tall. Secondary: a neutral pill.
- **Tab bar:** a floating ink capsule with 4 tabs: Today · Train · Food · Progress.
  - Each tab is an icon over a 15px label.
  - The active tab sits on a white rounded rectangle.
  - "You" is a 48px person circle at the top right of Today and Progress, labelled "You".
- **Dark mode:** follows the phone's setting. Token values are in the Pastel Bento spec, section 1.
- **Text size:** everything works at 200% text. No fixed heights.
- **Copy rules:**
  - Plain words, 25 words or fewer per screen where possible.
  - No shame words, streaks, emoji, calories or idioms.
  - Never "trend", "season", "kit", "deficit" or "module".

## 3. Plan engine (pure TypeScript in `src/lib/engine`, unit tested with vitest)
Every number comes from here. Screens never calculate anything.

### 3.1 Profile → daily food
- **BMR:** Mifflin-St Jeor for women, `10*kg + 6.25*cm - 5*age - 161`. Height "Not sure" = 162 cm.
- **Daily maintenance:** BMR × 1.4.
- **Goal "Keep steady" or "Get stronger":** maintenance.
- **Goal "Lose some weight":** maintenance − min(500, 20% of maintenance).
- **Floor:** never under 1,500 kcal for anyone, after every rule.
- **BMI rules** (from the setup weight, or the latest real weigh-in):
  - Under 20: "Lose some weight" is hidden.
  - Under 18.5: maintenance only.
  - Reaching 20 during "Lose some weight": the next check-in change is "Switch to Keep steady".
- **Protein:** 1.6 g/kg, or 2.0 g/kg on "Lose some weight". If BMI is over 30, use the weight at BMI 25.
- **Meals a day N** (2, 3 or 4): mealKcal = daily / N. Food is never shown in calories. Each meal shows:
  - the recipe at a serving multiplier rounded to 0.25 (e.g. "1½ servings");
  - a hand-portion line (palm protein, cupped-hand carbs, fist veg, thumb fat), scaled from a 300 kcal base meal = 1 of each, rounded to ½.
- **Fasting mode:** the same daily total in 2 bigger meals.
- **Buyers** ("I buy most food"):
  - Main meals are "1 ready meal + 1 side". The size line has no calories, e.g. "Regular pack (about 350–400 g), not large".
  - Breakfast and a 4th meal are grab-and-go items, each with a size line.
  - A size change adds or removes a side.

### 3.2 Weigh-ins
- The setup weight is NOT a weigh-in. Only one weigh-in a day counts; a later one replaces the earlier one.
- Average weight = mean of the weigh-ins over the last 7 days.
- "Change since start" runs from the first real weigh-in.

### 3.3 Weekly check-in (one change a week at most)
Priority order:
1. **Safety.** Speed brake: 2 real weigh-ins on different days within 14 days that show a loss faster than 1% of body weight a week → +150 kcal ("a little bigger"). This also runs outside check-ins and shows the T1 banner. The BMI 20 switch also counts as safety.
2. **Food** (only on "Lose some weight", at most 3 food changes per 12 weeks, never below the floor, never more than 500 below maintenance):
   - **With 3 or more weigh-ins on different days this week:** if average weight hasn't dropped by at least 0.25% a week for 3 weeks running → −150 kcal.
   - **Without weigh-ins:** clothes "Same" 3 weeks running → −150; "Looser" → no change; "Tighter" 2 weeks running → no cuts this week, with reassuring copy.
3. **Training:** if all planned workouts were done for 2 weeks and the moves were rated "Too easy" or "Just right" → one step up (e.g. "Legs get one extra set"). If she did under half → make it easier (a shorter default), never harder.
4. **Otherwise:** "Same plan."

More check-in rules:
- A week with nothing logged → C1b "Nothing logged this week. Same plan, fresh start." That week doesn't count toward the 12.
- The first check-in comes at least 7 days after the plan starts. Check-in day is a picker, Sunday by default. The banner stays up for 3 days.
- Walks are part of the base plan (three 15-minute walks a week) and are never a check-in lever.

### 3.4 Workouts
- **Exercise data:** `src/content/exercises.json`, built from `docs/content/exercises.csv` (copied from Jennifer's library), with ladders, units (reps or seconds), kit, position and swaps.
- **Equipment** maps to the kit field: floor, no floor (chair and wall moves only: position seated or standing, no floor moves), bands, dumbbells.
- **Minimum effective dose (owner decision, Nov 2026).** Every session has the same 4 main moves, one per
  pattern: squat or lunge, hip hinge, push and pull. They are picked by equipment (dumbbells first, then bands,
  then bodyweight; no-floor rules; the beginner rung; ladder progress kept).
- **Full body A and Full body B** use the same 4 patterns and alternate the version where the content allows:
  - A: squat, horizontal push, horizontal pull, hinge.
  - B: lunge, a vertical push if there is a suitable beginner one (else the same push), a vertical pull if
    suitable (else the same pull), and the other hinge ladder (e.g. a hip thrust vs a Romanian deadlift).
  - 4-day plans alternate A and B. There is no C.
- **Length changes the sets only, never the moves** (`SETS_BY_LENGTH`):
  - Short: 1 set each, about 8 min.
  - Standard (default and the suggestion): 2 sets each, about 15 min.
  - Long: 3 sets each, plus one core move (Pallof press with a band, dead bug with a floor, else a wall plank)
    at 2 sets, about 25 min.
  - Estimates come from the engine: 1 min to set up, then about 1 min of work + 45 s rest per set, shown as
    "about" (whole minutes up to 10, then the nearest 5). 3 Standard days = 6 sets a week per pattern.
  - Stored minutes are 8 / 15 / 25. Old values migrate (schema v2): 10 → 8, 20 → 15, 35 → 25; an old
    `?minutes=10` link means 8. Today's "8-minute version" is the Short version of today's workout.
- **Weekly check-in:** the training step up is Short → Standard → Long (never above Long); the easier option
  steps down Long → Standard → Short.
- **Rest:** 45 s. Each held move uses seconds.
- **Days:** 2, 3 or 4 a week, never back to back where possible.
- **Starting level:** the beginner rung of each ladder.
- **Progression:** when all sets hit rep_max (or the hold max) and the move was rated "Just right" or "Too easy" → go to the next ladder step.
  - In big screen mode, sets save the planned number, so a step up needs that rating.
  - "Hurts" twice → the move is swapped (using `swaps`) and listed in W11 "Moves I've set aside", with "Bring it back".
- **One workout per day.** "Not today" moves it to the next free home day; if there is none, it's dropped with no mark. It has a 5-second Undo.
- **Away days** (T6) are skipped. Weekly counts only include home days.
- **Weeks with no activity** don't count toward the 12 weeks.
- **A goal change** starts a new 12 weeks, with Undo on A9.

### 3.5 Food content
- **Recipes:** `src/content/recipes.json`, a curated subset of Jennifer's library. Each recipe has meal type, allergens (mapped to our 9: Nuts (tree), Peanuts, Egg, Shellfish, Fish, Soy, Sesame, Gluten, Dairy), ingredients, method, minutes, kcal and protein per serving.
- **Ready meals and grab-and-go:** `src/content/bought.json`, written generic (no brands, shops or prices).
- **Allergies:** an allergen is never served. A new allergy replaces today's unlogged meals at once, adds the new ingredients to this week's list, and shows "Already cooked or bought something with [nuts]? Don't eat it." Anything bought shows "Check the label".
- **Week plan:**
  - Cooks get 2–3 dinners/lunches batch-cooked twice a week, with simple breakfasts.
  - Variety comes from swaps (F3 offers the same meal type).
  - Favourites (heart) come first in swaps.
- **Shopping list:** built from the week's home days, sorted by shop area, with "Cooking for N" (remembered) scaling it. Share uses the Web Share API with a copy fallback.

### 3.6 Logging
- **Meals:** Ate the plan · Something like it · Something else (Home or bought? → size: Small · Same · Big).
  - The card stays for a 5-second Undo, then moves to the next meal.
  - Next meal = the first unlogged meal today, with a "Meal 3 instead" jump.
  - Repeat taps within 1 s are ignored.
- **Sets:** reps or seconds. **Effort:** Too easy · Just right · Too hard.

## 4. Device and PWA
- Manifest, icons and a service worker that caches the app shell and today's workout pictures for offline use.
- "Saved on phone" works offline because everything is local.
- **Install screens** (A14, A14b, A14w):
  - Detect iOS vs Android and in-app browsers (WhatsApp, FBAN/FBAV, Instagram) by user agent.
  - Show the right instructions.
  - Fallback line: "Don't see Add to Home Screen? Open this page in Safari."
- **Workout:**
  - Use the Screen Wake Lock API where it's supported.
  - Start the audio context on the Start tap.
  - Timers use timestamps (correct after the phone locks).
  - Voice cues use speechSynthesis.
  - Beeps use WebAudio.
- **Reminders:** in v0.1, A13 saves the choice only (no push). The note says "Reminders come in the next version."

## 5. v0.1 scope cuts (shown honestly, never fake)
- **Email code screens** (A10, A10b, A11, A11b, A14c): replaced by a single "Test version: no account needed. Your progress stays on this phone." screen. A11 "I've used it before" offers "Bring back my progress" (import the JSON file).
- **A15, A15b, A15c and S8 states:** shown as preview copy with "Test version, free". No charging.
- **Exercise pictures:** a neutral box with the move name and cues until the MoveKit clips are bought.
- **Photos (P3):** stored locally as compressed images in IndexedDB.

## 6. Quality bar
- `npm run build` passes. `npm test` (vitest) passes. Engine coverage includes every rule in section 3.
- Playwright smoke test at 390×844:
  - onboarding → taster → Today → log a meal → do a workout → check-in;
  - no horizontal scroll;
  - no text under 15px;
  - no tap target under 48px.
- Every screen in the wireframes exists as a route or a sheet, and every button goes where `.to` says (or the v0.1 cut).
