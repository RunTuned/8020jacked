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
                    r"zucchini|cilantro|scallion|skillet|broil|ground beef|ground turkey|ground chicken|yogurt|"
                    r"air fryer|air-fryer|slow cooker|slow-cooker|instant pot|pressure cooker|cayenne|hot chilli|chilli flakes|"
                    r"chipotle|jalape|sriracha|hot sauce", re.I)
# Prep and carry (Jennifer, Nov 2026)
FORMATS = {"tray", "pot"}
CARRY = {"hot", "cold"}
MAX_FRIDGE = 3
MAX_WASHUP = 3
# Crunchy toppings: every one is free of all 9 allergens.
TOPPINGS = {"Toasted sunflower seeds", "Toasted pumpkin seeds",
            "Quick slaw: shredded cabbage and carrot with a squeeze of lemon", "Quick pickled red onion",
            "Chopped cucumber and radish", "Sliced spring onion and fresh herbs", "Pomegranate seeds",
            "Thin-sliced raw pepper"}
CARB_WORDS = re.compile(r"\brice\b|pasta|macaroni|spaghetti|noodle", re.I)
WANT = {"tray_hot": 12, "pot_hot": 12, "cold": 6, "sauces": 8, "breakfasts": 8, "snacks": 6}
errors = []


def err(m):
    errors.append(m)


E = json.load(open(C / "exercises.json"))
R = json.load(open(C / "recipes.json"))
B = json.load(open(C / "bought.json"))
SA = json.load(open(C / "sauces.json"))

# ---- ids
for label, rows in (("exercises", E), ("recipes", R), ("bought", B), ("sauces", SA)):
    ids = [x["id"] for x in rows]
    for d in [i for i, n in collections.Counter(ids).items() if n > 1]:
        err(f"{label}: duplicate id {d}")
allids = [x["id"] for x in E + R + B + SA]
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
    # Batch mains 60 min; breakfasts that pack are made on cook day, 45 min; everything else 30.
    lim = 60 if (r["mealTypes"][0] == "main" and r["batch"]) else 45 if r["mealTypes"][0] == "breakfast" else 30
    if r["minutes"] > lim: err(f"{rid} too long ({r['minutes']} > {lim})")
    for i in r["ingredients"]:
        if i["area"] not in AREAS: err(f"{rid} area {i['area']}")
        if BANNED.search(i["name"]) or i["unit"] in ("cup", "cups", "oz", "lb"): err(f"{rid} ingredient wording: {i['name']} {i['unit']}")
        if not isinstance(i["qty"], (int, float)): err(f"{rid} qty")
    for step in r["method"]:
        if BANNED.search(step): err(f"{rid} method wording: {step[:60]}")
    if not (r["kcal"] > 0 and r["protein"] > 0 and r["servings"] > 0): err(f"{rid} numbers")
    # storage on every item
    if not isinstance(r.get("fridgeDays"), int) or not (1 <= r["fridgeDays"] <= MAX_FRIDGE): err(f"{rid} fridgeDays must be 1–3")
    if not isinstance(r.get("freezer"), bool): err(f"{rid} freezer must be true/false")
    if not isinstance(r.get("carbsFrozen"), bool): err(f"{rid} carbsFrozen must be true/false")
    has_carbs = any(CARB_WORDS.search(i["name"]) for i in r["ingredients"])
    if has_carbs != r.get("carbsFrozen"): err(f"{rid} carbsFrozen must be true exactly when it has rice or pasta")
    if r.get("carbsFrozen"):
        if not r["freezer"]: err(f"{rid} carbsFrozen needs freezer: true")
        if not any(re.search(r"freeze", m, re.I) and re.search(r"portion", m, re.I) for m in r["method"]):
            err(f"{rid} carbsFrozen: the method must say to freeze the rice/pasta in portions")
    if not isinstance(r.get("washUp"), int) or r["washUp"] < 1: err(f"{rid} washUp")
    if r.get("carry") not in CARRY: err(f"{rid} carry must be hot or cold")
    if not r.get("pack"): err(f"{rid} pack line")
    for sid in r.get("sauces", []):
        if sid not in {x["id"] for x in SA}: err(f"{rid} sauce {sid} missing")
    if r["mealTypes"][0] == "main":
        if r.get("format") not in FORMATS: err(f"{rid} format must be tray or pot")
        if r["washUp"] > MAX_WASHUP: err(f"{rid} washUp over 3")
        if not (2 <= len(r.get("sauces", [])) <= 3): err(f"{rid} needs 2–3 sauces")
        if r.get("topping") not in TOPPINGS: err(f"{rid} topping not in the allergen-free list")
        if not r["batch"]: err(f"{rid} mains are batch-cooked")
        if r["carry"] == "hot" and not any(re.search(r"steaming hot", m) for m in r["method"]):
            err(f"{rid} hot carry: the method must say heat until steaming hot")
    if not any(re.search(r"fridge", m, re.I) for m in r["method"]): err(f"{rid} method must say how it keeps in the fridge")

primary = collections.Counter(r["mealTypes"][0] for r in R)
mains = [r for r in R if r["mealTypes"][0] == "main"]
bfast = [r for r in R if "breakfast" in r["mealTypes"]]
batch_mains = [r for r in mains if r["batch"]]
if len(batch_mains) < 10: err(f"only {len(batch_mains)} batch mains")
counts = {
    "tray_hot": sum(r.get("format") == "tray" and r.get("carry") == "hot" for r in mains),
    "pot_hot": sum(r.get("format") == "pot" and r.get("carry") == "hot" for r in mains),
    "cold": sum(r.get("carry") == "cold" for r in mains),
    "sauces": len(SA),
    "breakfasts": primary["breakfast"],
    "snacks": primary["snack"],
}
for k, n in WANT.items():
    if counts[k] != n: err(f"{k}: {counts[k]} (want {n})")
for r in R:
    if r["mealTypes"][0] == "breakfast" and r["protein"] < 20: err(f'{r["id"]} breakfast under 20 g protein')
cold_mains = [r for r in mains if r.get("carry") == "cold"]
cov = {}
for a in ALLERGENS:
    m = sum(a not in r["allergens"] for r in mains)
    b = sum(a not in r["allergens"] for r in bfast)
    c = sum(a not in r["allergens"] for r in cold_mains)
    sc = sum(a not in x["allergens"] for x in SA)
    cov[a] = (m, b, c, sc)
    if m < 6: err(f"only {m} mains free of {a}")
    if b < 3: err(f"only {b} breakfasts free of {a}")
    if sc < 2: err(f"only {sc} sauces free of {a}")
    if c < 1: err(f"no good-cold main free of {a}")
for combo in (("gluten", "dairy"),):
    if not [r for r in mains if not set(combo) & set(r["allergens"])]: err(f"no main free of {combo}")
    if not [r for r in cold_mains if not set(combo) & set(r["allergens"])]: err(f"no cold main free of {combo}")
    if len([x for x in B if x["kind"] == "ready" and not set(combo) & set(x["allergens"])]) < 2:
        err(f"fewer than 2 ready meals free of {combo}")
# every main's sauce list has at least one sauce safe for each single allergy the main itself is safe for
sauce_al = {x["id"]: set(x["allergens"]) for x in SA}
for r in mains:
    for a in ALLERGENS:
        if a not in r["allergens"] and not any(a not in sauce_al[s] for s in r.get("sauces", []) if s in sauce_al):
            err(f'{r["id"]}: no listed sauce is free of {a}')

# ---- sauces
for x in SA:
    sid = x["id"]
    if x.get("minutes", 99) > 10: err(f"{sid} over 10 minutes")
    if not x.get("ingredients") or not x.get("method"): err(f"{sid} needs ingredients and a method")
    if len(x.get("ingredients", [])) > 10: err(f"{sid} over 10 ingredients")
    for a in x.get("allergens", [None]):
        if a not in ALLERGENS: err(f"{sid} allergen {a}")
    if not (isinstance(x.get("kcal"), (int, float)) and x["kcal"] >= 0 and isinstance(x.get("protein"), (int, float))): err(f"{sid} numbers")
    if not isinstance(x.get("fridgeDays"), int) or not (1 <= x["fridgeDays"] <= MAX_FRIDGE): err(f"{sid} fridgeDays must be 1–3")
    if not isinstance(x.get("freezer"), bool): err(f"{sid} freezer")
    for i in x.get("ingredients", []):
        if i["area"] not in AREAS: err(f"{sid} area {i['area']}")
        if BANNED.search(i["name"]): err(f"{sid} ingredient wording: {i['name']}")
    for step in x.get("method", []):
        if BANNED.search(step): err(f"{sid} method wording: {step[:60]}")

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
print(f"sauces:    {len(SA)}")
print(f"prep and carry: {counts}")
print("\nAllergen coverage (free-of counts)\n| Allergen | Mains free (of %d) | Breakfast-type free (of %d) | Cold mains free (of %d) | Sauces free (of %d) |\n|---|---|---|---|---|"
      % (len(mains), len(bfast), len(cold_mains), len(SA)))
for a in ALLERGENS:
    print(f"| {a} | {cov[a][0]} | {cov[a][1]} | {cov[a][2]} | {cov[a][3]} |")
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
