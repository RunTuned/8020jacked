# Content files (`src/content/`)

All three files are built or checked by scripts in `docs/content/tools/`. Rebuild and check with:

```
python3 docs/content/tools/build_exercises.py
python3 docs/content/tools/build_recipes.py      # reads the recipe library v3.12 data folder
python3 docs/content/tools/validate.py           # prints the tables below; exit 1 on any failure
```

The validator checks: every id is unique (within and across files), every swap exists, is the same
pattern and is never a higher step on the same ladder, allergens come only from the 9, every recipe
has ingredients and a method, at most 10 ingredients, time limits, metric units and UK/SA wording,
cues of 25 words or fewer, a beginner no-floor option for each main pattern, at least 10 batch mains,
and the allergen coverage rule (at least 6 mains and 3 breakfasts free of each allergen).

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

## recipes.json: 45 recipes

12 breakfasts, 25 mains (12 batch-cook), 8 snacks, by first meal type. Some carry a second type
(for example the smoothies and boiled eggs also count as breakfasts, the shakshuka also as a main).

How they were picked from 4,107: macro_status ok or recomputed; not held (cookability or food-match holds);
spicy = No; 10 ingredients or fewer; 30 min or less (batch mains 60 or less); no pressure cooker or slow cooker;
protein per 100 kcal 6 or more (two exceptions: the two smoothies, 5.2 and 5.9, kept for egg-free
breakfast cover); no protein powder, sweeteners, peanut butter powder, branded or
specialty items; then a hand pick for mixed cuisines (British, Italian, Greek, Chinese, Indian, Mexican,
Middle Eastern, American) and food found in SA, UK and US shops.

- kcal and protein per serving are the library's numbers. Four recipes were re-portioned (same total food,
  numbers scaled): egg muffins 8 → 4 servings (2 each), chicken bites 18 → 6 (3 each), boiled eggs 4 → 2,
  chicken and asparagus stir-fry 2.5 → 3.
- Allergens: the library's allergen column mapped to the 9 (Tree Nuts → nuts, Milk → dairy, Crustaceans and
  Molluscs → shellfish), plus each ingredient's own allergen flags. The library is cautious (for example
  bread and seasonings add soy and sesame), so some lists look long. That is on purpose.
- Ingredients: shop names in UK/SA English, grams or ml for weighed items, spoons and counts kept as they are.
  "to taste" lines have qty 0. Water and optional garnish lines were dropped (water amounts are in the method).
- Method: the library's own words, tightened, with US words and °F changed, and a cook-through cue added
  where it was missing (for example the curry, burrito, stir-fry and chicken bites), and a boil step for
recipes that list "hard-boiled egg". No source titles or provenance.
- "Batch" = the library's "Great for batch". That is taken to mean it keeps 3 or more days in the fridge.

### Allergen coverage (number of recipes free of each)

| Allergen | Mains free (of 25) | Breakfast-type free (of 15) |
|---|---|---|
| nuts | 25 | 14 |
| peanuts | 25 | 15 |
| egg | 20 | 5 |
| shellfish | 24 | 15 |
| fish | 18 | 13 |
| soy | 12 | 13 |
| sesame | 23 | 14 |
| gluten | 12 | 13 |
| dairy | 13 | 5 |

## bought.json: 30 items

12 ready meals, 10 grab-and-go, 8 sides. Written generic: no brands, shops or prices. kcal and protein are
typical estimates for sizing only (never shown). Allergens list the likely ones; the UI always adds
"Check the label".

## Please check (Jennifer)

1. Egg-free and dairy-free breakfasts are thin: 3 yoghurt bowls are the only egg-free breakfasts (plus 2 smoothies), and nothing is both egg- and dairy-free at breakfast.
2. "Batch = keeps 3+ days" is assumed from the library's "Great for batch"; there is no fridge-days field.
3. Turkey mince and turkey steaks are hard to find in SA; they are labelled "(or chicken mince / chicken breast)".
4. Swaps made by name: sea bass and "fish fillets" → hake or cod; ostrich mince → lean beef mince (burrito); KJ bread → thin-sliced bread; wheat germ dropped from the banana bowl (gluten removed with it).
5. Fennel (chicken with fennel) and asparagus (two recipes) may be pricey or seasonal in SA.
6. Breakfast protein is low on a few: banana yoghurt bowl (14 g), tomato omelette (15 g), boiled eggs with asparagus (15 g).
7. Kettlebell and gym moves were left out: say if you want kettlebell treated as dumbbell instead.
8. No-floor users with no kit get no vertical push or vertical pull move (see above).
9. Bought-item kcal/protein are my estimates, not label figures.
