#!/usr/bin/env python3
"""Validate src/content/*.json and print a summary (and the README coverage tables).

Usage: python3 docs/content/tools/validate.py   -> exit code 1 on any failure.
"""
import json, pathlib, re, sys, collections

ROOT = pathlib.Path(__file__).resolve().parents[3]
C = ROOT / "src" / "content"
ALLERGENS = ["nuts", "peanuts", "egg", "shellfish", "fish", "soy", "sesame", "gluten", "dairy"]
AREAS = {"fruit-veg", "fridge", "tins-dry", "freezer"}
MEALS = {"breakfast", "main", "snack"}
KITS = {"none", "band", "dumbbell", "chair", "wall", "bar"}
LEVELS = {"beginner", "intermediate", "advanced"}
POSITIONS = {"standing", "seated", "floor", "wall"}
BANNED = re.compile(r"protein powder|whey|sweetener|stevia|peanut butter powder|\d\s*cups?\b|\d\s*oz\b|\blbs?\b|°F|"
                    r"zucchini|cilantro|scallion|skillet|broil|ground beef|ground turkey|ground chicken|yogurt", re.I)
errors = []


def err(m):
    errors.append(m)


E = json.load(open(C / "exercises.json"))
R = json.load(open(C / "recipes.json"))
B = json.load(open(C / "bought.json"))

# ---- ids
for label, rows in (("exercises", E), ("recipes", R), ("bought", B)):
    ids = [x["id"] for x in rows]
    for d in [i for i, n in collections.Counter(ids).items() if n > 1]:
        err(f"{label}: duplicate id {d}")
allids = [x["id"] for x in E + R + B]
if len(allids) != len(set(allids)):
    err("ids not unique across files")

# ---- exercises
ex = {e["id"]: e for e in E}
for e in E:
    if e["kit"] not in KITS: err(f'{e["id"]} kit {e["kit"]}')
    if e["level"] not in LEVELS: err(f'{e["id"]} level')
    if e["position"] not in POSITIONS: err(f'{e["id"]} position')
    if e["unit"] not in ("reps", "seconds"): err(f'{e["id"]} unit')
    if e["noFloor"] != (e["position"] != "floor"): err(f'{e["id"]} noFloor')
    if not (0 < e["repMin"] <= e["repMax"]): err(f'{e["id"]} rep range')
    if not e["swaps"]: err(f'{e["id"]} has no swaps')
    for s in e["swaps"]:
        if s not in ex: err(f'{e["id"]} swap {s} missing')
        elif ex[s]["pattern"] != e["pattern"]: err(f'{e["id"]} swap {s} different pattern')
        elif ex[s]["ladder"] == e["ladder"] and ex[s]["ladderStep"] > e["ladderStep"]:
            err(f'{e["id"]} swap {s} is a higher step')
    for c in e["cues"]:
        if len(c.split()) > 25: err(f'{e["id"]} cue over 25 words')
    if not e["cues"]: err(f'{e["id"]} no cues')

MAIN_PATTERNS = ["squat", "hinge", "lunge", "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "core"]
GROUP = {"squat": "squat", "hinge": "hinge", "lunge": "lunge", "horizontal_push": "push", "vertical_push": "push",
         "horizontal_pull": "pull", "vertical_pull": "pull", "core": "core"}
nofloor_beg = collections.defaultdict(list)
for e in E:
    if e["level"] == "beginner" and e["noFloor"] and e["effort"] != "practice":
        nofloor_beg[e["pattern"]].append(e)
for g in sorted(set(GROUP.values())):
    if not any(nofloor_beg[p] for p in GROUP if GROUP[p] == g):
        err(f"no beginner no-floor option for {g}")

# ladder coverage: pattern x equipment group (none = none/chair/wall)
EQ = {"none": "none", "chair": "none", "wall": "none", "band": "band", "dumbbell": "dumbbell", "bar": "bar"}
lad = collections.defaultdict(lambda: collections.defaultdict(set))
for e in E:
    lad[e["pattern"]][EQ[e["kit"]]].add(e["ladder"])
steps = collections.defaultdict(int)
for e in E:
    steps[e["ladder"]] = max(steps[e["ladder"]], e["ladderStep"])

# ---- recipes
for r in R:
    rid = r["id"]
    if not r["ingredients"]: err(f"{rid} no ingredients")
    if not r["method"]: err(f"{rid} no method")
    if len([i for i in r["ingredients"]]) > 10: err(f"{rid} over 10 ingredients")
    if not set(r["mealTypes"]) <= MEALS: err(f"{rid} mealTypes")
    for a in r["allergens"]:
        if a not in ALLERGENS: err(f"{rid} allergen {a}")
    lim = 60 if (r["mealTypes"][0] == "main" and r["batch"]) else 30
    if r["minutes"] > lim: err(f"{rid} too long ({r['minutes']} > {lim})")
    for i in r["ingredients"]:
        if i["area"] not in AREAS: err(f"{rid} area {i['area']}")
        if BANNED.search(i["name"]) or i["unit"] in ("cup", "cups", "oz", "lb"): err(f"{rid} ingredient wording: {i['name']} {i['unit']}")
        if not isinstance(i["qty"], (int, float)): err(f"{rid} qty")
    for step in r["method"]:
        if BANNED.search(step): err(f"{rid} method wording: {step[:60]}")
    if not (r["kcal"] > 0 and r["protein"] > 0 and r["servings"] > 0): err(f"{rid} numbers")

primary = collections.Counter(r["mealTypes"][0] for r in R)
mains = [r for r in R if r["mealTypes"][0] == "main"]
bfast = [r for r in R if "breakfast" in r["mealTypes"]]
batch_mains = [r for r in mains if r["batch"]]
if len(batch_mains) < 10: err(f"only {len(batch_mains)} batch mains")
cov = {}
for a in ALLERGENS:
    m = sum(a not in r["allergens"] for r in mains)
    b = sum(a not in r["allergens"] for r in bfast)
    cov[a] = (m, b)
    if m < 6: err(f"only {m} mains free of {a}")
    if b < 3: err(f"only {b} breakfasts free of {a}")

# ---- bought
kinds = collections.Counter(x["kind"] for x in B)
for x in B:
    if x["kind"] not in ("ready", "grab", "side"): err(f'{x["id"]} kind')
    if not set(x["mealTypes"]) <= MEALS or not x["mealTypes"]: err(f'{x["id"]} mealTypes')
    for a in x["allergens"]:
        if a not in ALLERGENS: err(f'{x["id"]} allergen {a}')
    if not x["sizeLine"]: err(f'{x["id"]} sizeLine')

# ---- summary
print(f"exercises: {len(E)}  (kits: {dict(collections.Counter(e['kit'] for e in E))})")
print(f"recipes:   {len(R)}  (primary: {dict(primary)}; batch mains: {len(batch_mains)}; with breakfast type: {len(bfast)})")
print(f"bought:    {len(B)}  ({dict(kinds)})")
print("\nAllergen coverage (free-of counts)\n| Allergen | Mains free (of %d) | Breakfasts free (of %d) |\n|---|---|---|" % (len(mains), len(bfast)))
for a in ALLERGENS:
    print(f"| {a} | {cov[a][0]} | {cov[a][1]} |")
print("\nLadders per pattern and equipment (ladder:top step)\n| Pattern | No kit (incl. chair/wall) | Band | Dumbbell | Pull-up bar |\n|---|---|---|---|---|")
for p in sorted(lad):
    cells = [", ".join(f"{l}:{steps[l]}" for l in sorted(lad[p][k])) or "**gap**" for k in ("none", "band", "dumbbell", "bar")]
    print(f"| {p} | " + " | ".join(cells) + " |")
print("\nBeginner no-floor options per pattern:")
for p in MAIN_PATTERNS:
    print(f"  {p}: " + (", ".join(f"{e['id']} {e['name']} ({e['kit']})" for e in nofloor_beg[p]) or "NONE"))
if errors:
    print("\nFAIL")
    for e in errors: print("  -", e)
    sys.exit(1)
print("\nRESULT: PASS")
