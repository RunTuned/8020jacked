# Content files (`src/content/`)

All four files are built or checked by scripts in `docs/content/tools/`. Rebuild and check with:

```
python3 docs/content/tools/build_exercises.py
python3 docs/content/tools/build_recipes.py      # reads the recipe library v3.12 data folder
python3 docs/content/tools/validate.py           # prints the tables below; exit 1 on any failure
```
`sauces.json` is written by hand (8 quick sauces); the validator checks it with the rest.

The validator checks: every id is unique (within and across files), every swap exists, is the same
pattern and is never a higher step on the same ladder, allergens come only from the 9, every recipe
has ingredients and a method, at most 10 ingredients, time limits, metric units and UK/SA wording,
cues of 25 words or fewer, a beginner no-floor option for each main pattern, at least 10 batch mains,
and the allergen coverage rule (at least 6 mains and 3 breakfasts free of each allergen).

Prep-and-carry checks (Nov 2026): the exact counts (12 hot tray mains, 12 hot pot mains, 6 good-cold
mains, 8 breakfasts, 6 snacks, 8 sauces); every main is `tray` or `pot` with `washUp` 3 or less, 2–3
sauces that exist, and a topping from the allergen-free list; every item has `fridgeDays` 1–3,
`freezer` and `carbsFrozen` true/false, `carry` hot/cold and a `pack` line; `carbsFrozen` is true
exactly when the item has rice or pasta, it then freezes and the method says to freeze it in portions;
hot-carry mains say "steaming hot"; every method says how it keeps in the fridge; no air fryer, slow
cooker or pressure cooker words and no hot-chilli words; breakfasts have 20 g protein or more;
sauces take 10 minutes or less, have fridge days 1–3 and at least 2 sauces are free of each allergen;
each main lists a sauce free of every allergen the main itself is free of; each allergen has a
good-cold main free of it; and there is a main, a cold main and 2 ready meals free of gluten and dairy together.

## exercises.json: 87 moves

- Source: `docs/content/exercises.csv` (102 moves). **15 left out**: 9 gym moves (barbell, leg press, machines,
  cable) and 6 kettlebell moves, because the app offers no gym or kettlebell kit. Swaps that pointed at
  them were dropped; every remaining move still has at least one swap.
- Kit: `none`, `bands` → `band`, `dumbbells` (and `dumbbells|bench`) → `dumbbell`, pull-up bar moves → `bar`.
  No-kit moves that need a chair (sit-to-stand, chair dip, rear-foot-elevated split squat, box pistol,
  elevated / feet-elevated pike) → `chair`; wall push-ups, wall sit, wall hip hinge and wall plank → `wall`.
  Counter, stair and door-frame moves stay `none` (every home has them). Counts: none 44, chair 6, wall 5,
  band 11, dumbbell 13, bar 8.
- Position: hanging → standing; bench and chair → seated; head-down (pike, feet-elevated push-up) and
  incline (low step push-up) → floor, to be safe. Wall moves → wall. `noFloor` = position is not floor.
- Unit: `reps_per_side` / `seconds_per_side` become `reps` / `seconds` with an extra `perSide: true`.
  Two more extras are kept because the rules need them: `effort` (hard / practice / low_load; practice moves
  never count as hard sets) and `maxUserKg` (table rows, chair dip and the bar are not offered above 100 kg).
- Cues: the library's cue split into short cues; 9 long ones rewritten in plain words, the table-test
  safety cue kept word for word in meaning.

### Ladder coverage per equipment

| Pattern | No kit (incl. chair/wall) | Band | Dumbbell | Pull-up bar |
|---|---|---|---|---|
| squat | squat_bw (4 steps), wall_sit | band_squat | db_goblet_squat | – |
| hinge | hinge_bw (5), hinge_standing (2) | band_pull_through | db_rdl, db_hip_thrust | – |
| lunge | lunge_bw (6), step_up_bw (2), split_squat_hold | **gap** | db_reverse_lunge, db_step_up | – |
| horizontal push | push_up (7), wall_push_up_fists | band_chest_press | db_floor_press, db_bench_press | – |
| vertical push | pike_push_up (3) | band_overhead_press | db_overhead_press | – |
| horizontal pull | row_bw (5) | band_row, band_pull_apart | db_row, db_chest_supported_row | – |
| vertical pull | floor_lat_pull | band_lat_pulldown | **gap** | pull_up (8) |
| core | core_front (5), core_side (2), core_standing (2), bird_dog | band_pallof_press | suitcase_carry | – |
| hip abduction / balance / arms | yes / yes / chair_dip | yes / – / yes | – / – / yes | – |

Band and dumbbell ladders are one step each: progress is a heavier band or weight, not a new move.
Gaps: no band lunge, no dumbbell vertical pull (band lat pulldown or no-kit floor lat pull covers it).

Beginner no-floor options exist for squat, hinge, lunge, push, pull and core with no kit at all, except
**vertical push** (no-kit options are all head-down, floor) and **vertical pull** (floor lat pull is on the floor):
those need a band, dumbbells or a bar. Carry = suitcase carry (dumbbell), listed under core.

## recipes.json: 44 recipes, a prep-and-carry library

Rebuilt in Nov 2026 for women who carry lunch to work. **30 mains, 8 breakfasts, 6 snacks**, plus
**8 sauces** in `sauces.json`. All from Jennifer's library (v3.12) except the sauces.

### How it works for her

- **Two cook days a week.** Sunday cooks Mon–Wed, Wednesday cooks Thu–Sat, so nothing is older than
  3 days. Sunday's own meals come from the freezer (freezer-friendly mains from that week's batches)
  or, if nothing freezes, a fresh quick main.
- **Two cooking formats, small washing up.** `tray` = one oven traybake; `pot` = one pot on the hob.
  Most to wash for a main: one tray or pot, one board, one knife (`washUp` 3). Oven and hob only.
- **Taste comes from sauces.** Proteins and veg are cooked simply. Each main lists 2–3 sauces that
  suit it, kept in a separate pot so lunch doesn't go soggy. The engine gives each batch main 2 of its
  sauces in turn across the days. Every main also has a crunchy topping, always free of all 9 allergens.
- **Carry.** `carry: "hot"` needs a microwave (heat until steaming hot all the way through);
  `"cold"` is good cold. The engine puts a good-cold main at lunch at least 2 days a week (in practice
  4: the first and third lunch of each batch).
- **Storage.** `fridgeDays` is 3 at most (2 for cooked fish, 1 for rice and things eaten the next
  day). The engine never serves a meal past its fridge days: if nothing in the batch keeps long
  enough it uses a freezer portion, then a longer-keeping main, else hand portions. Rice and pasta are
  frozen in single portions on cook day (`carbsFrozen: true`, said in the method), moved to the fridge
  the night before, reheated once (UK FSA rule).

### How they were picked

From 4,107 recipes: macro_status ok or recomputed; not held (cookability, food-match or cream holds);
spicy = No; no protein powder, sweeteners, peanut butter powder or specialty items; 10 ingredient lines
or fewer; then a hand pick for one tray or one pot, keeps 3 days or less, high protein per kcal,
cheap food found in SA, UK and US shops, and mixed cuisines (Italian, Greek, Mexican, Indian, Chinese,
Middle Eastern, British, Thai-style, American).

- **Conversions (obvious and safe only), marked `converted` in `build_recipes.py`:** 4 slow-cooker
  chicken dishes → simmered covered on the hob until cooked through (artichoke and olive; onion and
  olive, seared in the same pot first; five-spice; coconut-tomato soup); 3 air-fryer recipes → a hot
  oven tray (lime chicken, pepper rolls, fajita strips); a pressure-cooker steam → oven tray
  (prosciutto asparagus); griddle/pan chicken → oven tray in 2 cold salads; the frittata's pan step →
  the same tin in the oven; the beef chilli's separate steaming → simmered in the pot. Converted
  recipes got a new time; nothing else about their food or numbers changed.
- **Not used:** beef stews that need 1½–2 hours, stuffed peppers and pies that need a pan and a dish,
  anything needing a blender or food processor, and one-pot pasta (the pasta can't be frozen apart).
- **Numbers:** kcal and protein per serving are the library's. Re-portioned (same total food, numbers
  scaled): lime chicken 8 → 4, smoky chicken thighs 8 → 4, pepper chicken rolls 4 → 2, lemon herb
  fish 4 → 2, beef and egg stacks 12 → 6, tuna egg muffins 8 → 4, egg white cups 12 → 4, trout wraps 4 → 2.
- **Allergens:** the library's column mapped to the 9 plus each ingredient's own flags (cautious on
  purpose: stock powder adds gluten, soy and dairy). One swap added allergens: coconut aminos → soy
  sauce in the roast cod (soy and gluten added).
- **Swaps by name:** sea bass, whitefish and "fish fillets" → hake (or other white fish); turkey mince →
  "(or chicken mince)"; lamb mince → "(or lean beef mince)"; chilli powder → "mild chilli powder (or
  more paprika)"; shiitake → "brown or shiitake"; dried blueberries → "or cranberries"; goji → "dried
  cranberries or goji". Dropped lines: water, optional coconut sugar, optional gelatine, garnish coriander.
- **Method:** rewritten in plain numbered steps that show the one tray or pot, a cook-through cue, how
  it keeps, and for hot carry "steaming hot all the way through". No source titles or provenance.

### The mains

| Main | Format | Carry | Fridge days | Freezes | Allergens | Protein g | Sauces |
|---|---|---|---|---|---|---|---|
| Roast chicken thighs and vegetables | tray | hot | 3 | yes | none | 48 | Salsa verde, Lemon, herb and yoghurt sauce, Peri-peri-style sauce |
| Chicken, sweet potato and broccoli traybake | tray | hot | 3 | no | none | 30 | Garlic and chive dressing, Tahini and lemon sauce, Peri-peri-style sauce |
| Lime and coriander chicken | tray | hot | 3 | yes | none | 52 | Peri-peri-style sauce, Lemon, herb and yoghurt sauce, Sweet tomato jam |
| Pepper-stuffed chicken rolls | tray | hot | 3 | yes | none | 40 | Sweet tomato jam, Salsa verde |
| Smoky paprika chicken thighs | tray | hot | 3 | yes | none | 45 | Peri-peri-style sauce, Garlic and chive dressing, Lemon, herb and yoghurt sauce |
| Salmon and potato traybake | tray | hot | 2 | no | fish | 33 | Salsa verde, Lemon, herb and yoghurt sauce, Garlic and chive dressing |
| Roast cod with leeks and mushrooms | tray | hot | 2 | no | fish, soy, gluten | 32 | Sweet soy and garlic sauce, Garlic and chive dressing |
| Spice-rubbed white fish | tray | hot | 2 | no | fish, dairy | 33 | Lemon, herb and yoghurt sauce, Tahini and lemon sauce, Sweet tomato jam |
| Cheesy paprika chicken wings | tray | hot | 3 | yes | dairy | 31 | Sweet tomato jam, Garlic and chive dressing |
| Lemon and herb baked fish | tray | hot | 2 | no | fish, soy, gluten, dairy | 51 | Salsa verde, Tahini and lemon sauce |
| Lemon and dill salmon | tray | hot | 2 | no | fish | 35 | Lemon, herb and yoghurt sauce, Garlic and chive dressing, Sweet soy and garlic sauce |
| Baked hake with tomatoes, olives and capers | tray | hot | 2 | no | fish, soy, gluten, dairy | 28 | Salsa verde, Garlic and chive dressing |
| Chicken cacciatore | pot | hot | 3 | yes | soy, gluten, dairy | 58 | Salsa verde, Garlic and chive dressing |
| Chunky beef and cabbage soup | pot | hot | 3 | yes | none | 44 | Salsa verde, Lemon, herb and yoghurt sauce |
| Beef, pumpkin and vegetable chilli | pot | hot | 3 | yes | dairy | 33 | Lemon, herb and yoghurt sauce, Sweet tomato jam, Peri-peri-style sauce |
| Chicken and tomato curry | pot | hot | 3 | yes | shellfish, fish, soy, gluten, dairy | 30 | Lemon, herb and yoghurt sauce, Peanut and lime sauce |
| Honey garlic chicken with rice and peas | pot | hot | 3 | yes | soy, gluten | 40 | Sweet soy and garlic sauce, Peanut and lime sauce |
| Lamb and lentil ragù | pot | hot | 3 | yes | none | 31 | Tahini and lemon sauce, Lemon, herb and yoghurt sauce, Salsa verde |
| Coconut fish stew | pot | hot | 2 | no | fish | 34 | Peanut and lime sauce, Salsa verde |
| Chicken with artichokes and olives | pot | hot | 3 | yes | none | 43 | Salsa verde, Lemon, herb and yoghurt sauce |
| Chicken with onions, olives and sun-dried tomatoes | pot | hot | 3 | yes | none | 44 | Garlic and chive dressing, Tahini and lemon sauce |
| Five-spice ginger chicken | pot | hot | 3 | yes | none | 38 | Sweet soy and garlic sauce, Garlic and chive dressing, Peanut and lime sauce |
| Coconut, tomato and chicken soup | pot | hot | 3 | yes | none | 43 | Salsa verde, Peri-peri-style sauce |
| Beef and bean chilli | pot | hot | 3 | yes | soy, gluten, dairy | 51 | Lemon, herb and yoghurt sauce, Sweet tomato jam |
| Chicken fajita strips with peppers | tray | cold | 3 | yes | none | 33 | Peri-peri-style sauce, Lemon, herb and yoghurt sauce, Sweet tomato jam |
| Salmon, pepper and quinoa salad | tray | cold | 2 | no | fish | 25 | Garlic and chive dressing, Tahini and lemon sauce |
| Chicken, couscous and feta salad | tray | cold | 3 | no | egg, soy, gluten, dairy | 36 | Lemon, herb and yoghurt sauce, Peri-peri-style sauce |
| Honey-soy chicken with crunchy slaw | tray | cold | 3 | no | soy, sesame, gluten, dairy | 31 | Peanut and lime sauce, Sweet soy and garlic sauce |
| Paprika beef lettuce cups | pot | cold | 3 | no | none | 30 | Lemon, herb and yoghurt sauce, Salsa verde |
| Hake with potato salad | pot | cold | 2 | no | egg, fish, soy, gluten, dairy | 40 | Salsa verde, Garlic and chive dressing |

Rice: only *Honey garlic chicken with rice and peas* and *Breakfast fried rice* contain rice (`carbsFrozen: true`).

### Breakfasts that pack (8) and snacks (6)

| Item | Type | Carry | Fridge days | Freezes | Allergens | Protein g |
|---|---|---|---|---|---|---|
| Italian egg white bites | breakfast | hot | 3 | yes | egg, dairy | 40 |
| Turkey and blueberry breakfast patties | breakfast | hot | 3 | yes | soy, gluten, dairy | 34 |
| Mango, cottage cheese and yoghurt pot | breakfast | cold | 2 | no | dairy | 31 |
| Berry and walnut yoghurt pot | breakfast | cold | 1 | no | nuts, dairy | 34 |
| Smoked salmon and vegetable frittata | breakfast | cold | 2 | no | egg, fish | 28 |
| Breakfast fried rice | breakfast | hot | 1 | yes | egg, soy, gluten | 30 |
| Beef patty and egg stacks | breakfast | hot | 3 | yes | egg | 31 |
| Tuna, cheese and egg muffins | breakfast | cold | 3 | yes | egg, fish, soy, gluten, dairy | 22 |
| Cheesy vegetable egg white cups | snack | cold | 3 | yes | egg, dairy | 14 |
| Tzatziki dip | snack | cold | 3 | no | dairy | 11 |
| Prosciutto-wrapped asparagus | snack | cold | 2 | no | none | 18 |
| Smoked trout and mango lettuce wraps | snack | cold | 1 | no | fish | 14 |
| Cottage cheese and fruit pot | snack | cold | 1 | no | dairy | 26 |
| Bacon, egg and tomato lettuce wraps | snack | cold | 1 | no | egg | 35 |

Every breakfast has 20 g protein or more a serving. The old low-protein breakfasts (banana yoghurt
bowl, tomato omelette, eggs with asparagus) are gone. The library has no overnight oats with 20 g
protein that don't use protein powder or peanut butter powder, so there are none.

## sauces.json: 8 quick sauces (written by me, not from the library)

Simple classic combinations, 10 minutes or less, each kept in its own pot. kcal and protein are my
estimates per serving (about 2 tablespoons), from typical food values. The engine takes the sauce off
the meal size before scaling the main, and puts the sauce on the shopping list (one pot a person).

| Sauce | Minutes | Allergens | kcal | Protein g | Fridge days | Freezes |
|---|---|---|---|---|---|---|
| Lemon, herb and yoghurt sauce | 5 | dairy | 30 | 5 | 3 | no |
| Peri-peri-style sauce (mild) | 5 | none | 62 | 0 | 3 | yes |
| Sweet soy and garlic sauce | 8 | soy, gluten | 30 | 1 | 3 | yes |
| Salsa verde | 8 | none | 82 | 0 | 3 | yes |
| Tahini and lemon sauce | 5 | sesame | 62 | 2 | 3 | no |
| Sweet tomato jam | 10 | none | 37 | 1 | 3 | yes |
| Peanut and lime sauce | 5 | peanuts, soy, gluten | 70 | 3 | 3 | no |
| Garlic and chive dressing | 5 | none | 85 | 0 | 3 | no |

Toppings (a plain suggestion line on each main, all free of the 9): toasted sunflower seeds, toasted
pumpkin seeds, quick slaw, quick pickled red onion, cucumber and radish, spring onion and herbs,
pomegranate seeds, thin-sliced raw pepper. Bought crispy onions were left out (they usually contain wheat).

### Allergen coverage (number free of each)

| Allergen | Mains free (of 30) | Breakfast-type free (of 9) | Cold mains free (of 6) | Sauces free (of 8) |
|---|---|---|---|---|
| nuts | 30 | 8 | 6 | 8 |
| peanuts | 30 | 9 | 6 | 7 |
| egg | 28 | 4 | 4 | 8 |
| shellfish | 29 | 9 | 6 | 8 |
| fish | 20 | 7 | 4 | 8 |
| soy | 20 | 6 | 3 | 6 |
| sesame | 29 | 9 | 5 | 7 |
| gluten | 20 | 6 | 3 | 6 |
| dairy | 19 | 3 | 3 | 7 |

Breakfast-type counts 9 because the cottage cheese and fruit pot (a snack) is also a breakfast.
Gluten- and dairy-free together: 17 mains, of them 3 good cold (fajita strips, beef lettuce cups,
salmon quinoa salad).

## bought.json: 32 items

14 ready meals, 10 grab-and-go, 8 sides. Written generic: no brands, shops or prices. kcal and protein
are typical estimates for sizing only (never shown). Allergens list the likely ones; the UI always
adds "Check the label". Two ready meals were added so gluten- and dairy-allergic buyers have one:
"Roast chicken with potatoes and veg ready meal (no gravy)" and "Plain chicken, rice and vegetable
ready meal (no sauce)", both listed with no allergens.

## Please taste-test first (Jennifer)

These 10 carry the most risk (a converted method, a new storage step, or a hard-to-find item):

1. **Roast chicken thighs and vegetables** (tray). The staple; check the timing and size of a box.
2. **Chicken fajita strips with peppers** (tray, cold). Converted from the air fryer; is it good cold with the peri-peri sauce?
3. **Five-spice ginger chicken** (pot). Converted from the slow cooker; does 35–40 minutes make it tender?
4. **Chicken with artichokes and olives** (pot). Converted from the slow cooker; breasts can dry out.
5. **Honey garlic chicken with rice and peas** (pot). Tests the freeze-the-rice routine end to end.
6. **Beef, pumpkin and vegetable chilli** (pot). The steaming step is now simmered in the pot.
7. **Salmon, pepper and quinoa salad** (tray, cold). Fish keeps 2 days; is it nice cold on day 2?
8. **Honey-soy chicken with crunchy slaw** (tray, cold). Griddle → tray, and a bought sauce.
9. **Smoked salmon and vegetable frittata** (breakfast). The pan step is now done in the tin.
10. **Turkey and blueberry breakfast patties** (breakfast). Turkey mince and dried blueberries may be hard to find in SA.

And the 8 sauces: they are mine, not from the library, so taste every one (salsa verde, peri-peri and
tomato jam go with the most dishes).

## Please check (Jennifer)

1. Dairy-free breakfasts are thin: exactly 3 (frittata, fried rice, beef and egg stacks), the minimum.
2. Fish is in 10 of the 30 mains (cheap hake helps in SA, salmon is pricey). Fish and the coconut fish stew keep 2 days.
3. Fish reheated in a work microwave can smell; you may want more fish marked cold.
4. Asparagus (prosciutto snack) and lemongrass (fish stew, lemon zest instead) may be pricey or hard to find in SA.
5. The couscous salad and honey-soy slaw use a bought sauce (lemon-herb peri-peri, honey-soy-ginger) because the library recipe does.
6. Sauce kcal and protein are my estimates.
7. Bought-item kcal/protein are my estimates, not label figures.
7. Kettlebell and gym moves were left out: say if you want kettlebell treated as dumbbell instead.
8. No-floor users with no kit get no vertical push or vertical pull move (see above).
