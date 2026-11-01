#!/usr/bin/env python3
"""Build src/content/recipes.json from Jennifer's recipe library (v3.12): the prep-and-carry library.

Usage: python3 docs/content/tools/build_recipes.py [path/to/recipe-library/v3.12/data]

Selection (see docs/content/README.md): macro_status ok/recomputed, not held (cookability, food-match
or cream holds), spicy = No, no protein powder / sweeteners / specialty items, 10 ingredient lines or
fewer, then a hand pick for the two cooking formats (one oven tray, or one pot on the hob), food that
keeps 3 days or less in the fridge, high protein per kcal, cheap shop food in SA, UK and US, and mixed
cuisines. Slow-cooker, pressure-cooker and air-fryer recipes are only used where the change to hob or
oven is obvious and safe (chicken pieces simmered in their sauce on the hob; air-fried chicken roasted
on a tray); those carry `converted` with a plain note in this file.

Each entry may carry small overrides: a plain display name, ingredient renames / drops (a dropped
line is only water, an optional garnish or an optional extra), a whole-recipe servings re-portion
(same total food, so kcal and protein per serving scale by old/new), a new time for converted
recipes, and a method rewritten in plain numbered steps that shows the tray/pot format and storage.
No nutrition value is invented: kcal and protein come from the library row.
"""
import csv, json, re, sys, collections, pathlib

DATA = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else
                    "/home/claude/looongstory/recipe-library/v3.12/data")
OUT = pathlib.Path(__file__).resolve().parents[3] / "src" / "content" / "recipes.json"

ALLERGEN_MAP = {"Tree Nuts": "nuts", "Peanuts": "peanuts", "Eggs": "egg", "Crustaceans": "shellfish",
                "Molluscs": "shellfish", "Fish": "fish", "Soy": "soy", "Sesame": "sesame",
                "Gluten": "gluten", "Milk": "dairy"}
ITEM_FLAGS = {"is_tree_nut": "nuts", "is_peanut": "peanuts", "is_egg": "egg", "is_crustacean": "shellfish",
              "is_mollusc": "shellfish", "is_fish": "fish", "is_soy": "soy", "is_sesame": "sesame",
              "is_gluten": "gluten", "is_dairy": "dairy"}
ORDER = ["nuts", "peanuts", "egg", "shellfish", "fish", "soy", "sesame", "gluten", "dairy"]

TT = "to taste"
S = {}

# Pack lines (plain, one line each).
HOT = "Microwave-safe box + sauce pot. Fridge at work, or eat within 2 hours with an ice pack. Heat until steaming hot all the way through."
COLD = "2-part box + sauce pot. Fridge at work, or eat within 2 hours with an ice pack. Good cold."
COLD_JAR = "Jar or box + sauce pot. Fridge at work, or eat within 2 hours with an ice pack. Good cold."
HOME = "Eat at home, or pack in a box with an ice pack and eat within 2 hours."
# Storage steps added to methods.
KEEP3 = "Cool, then put into boxes within 2 hours. Keep in the fridge for up to 3 days."
KEEP3F = "Cool, then put into boxes within 2 hours. Keep in the fridge for up to 3 days, or freeze for up to 3 months."
KEEP2 = "Cool, then put into boxes within 2 hours. Cooked fish keeps 2 days in the fridge, so eat it first."
REHEAT = "To eat hot: microwave until steaming hot all the way through, stirring halfway. Reheat only once."


def sel(rid, slug, name, meal, **kw):
    S[rid] = dict(slug=slug, name=name, meal=meal, **kw)


def main_dish(rid, slug, name, fmt, carry, sauces, topping, fridge=3, freezer=False, carbs=False, **kw):
    """A main: one tray or one pot, one board, one knife (washUp 3)."""
    sel(rid, slug, name, "main", fmt=fmt, wash=3, carry=carry, sauces=sauces, topping=topping,
        fridge=fridge, freezer=freezer, carbs=carbs,
        pack=kw.pop("pack", HOT if carry == "hot" else COLD), **kw)


# Toppings: every one is free of all 9 allergens (the validator checks the list).
SEEDS = "Toasted sunflower seeds"
PUMPKIN = "Toasted pumpkin seeds"
SLAW = "Quick slaw: shredded cabbage and carrot with a squeeze of lemon"
ONION = "Quick pickled red onion"
CUKE = "Chopped cucumber and radish"
HERBS = "Sliced spring onion and fresh herbs"
POM = "Pomegranate seeds"
PEPPERS = "Thin-sliced raw pepper"

# Sauce ids (src/content/sauces.json).
YOG, PERI, SOY, VERDE, TAHINI, JAM, PEANUT, CHIVE = (
    "sauce-lemon-herb-yoghurt", "sauce-peri-peri", "sauce-soy-garlic", "sauce-salsa-verde",
    "sauce-tahini-lemon", "sauce-tomato-jam", "sauce-peanut-lime", "sauce-garlic-chive")

MILD_CHILLI = ("mild chilli powder (or more paprika)",)

# ================= Tray mains (oven only, one tray) =================
main_dish("sc12456", "tray-chicken-thighs-veg", "Roast chicken thighs and vegetables", "tray", "hot",
          [VERDE, YOG, PERI], SEEDS, freezer=True,
          ing={"1 red bell pepper": ("red pepper", 1, ""), "1 medium onion": ("onion", 1, ""), "1 carrot": ("carrot", 1, ""),
               "5 g oil": ("oil", 5, "g", "tins-dry")},
          method=["Heat the oven to 200°C (180°C fan).",
                  "Cut the chicken thighs, cauliflower, onion, carrot and pepper into bite-size pieces on one board.",
                  "Tip everything onto one large tray. Add the oil, garlic powder, rosemary, basil, salt and pepper and toss with your hands.",
                  "Roast for 25–30 minutes, turning once, until the chicken is cooked through with no pink inside.",
                  KEEP3F, REHEAT])
main_dish("sc12808", "tray-chicken-sweet-potato", "Chicken, sweet potato and broccoli traybake", "tray", "hot",
          [CHIVE, TAHINI, PERI], PUMPKIN,
          ing={"fresh thyme": ("fresh thyme", 3, "sprigs"), "red onion": ("red onion, small", 0.5, "")},
          method=["Heat the oven to 200°C (180°C fan).",
                  "Cut the sweet potato into 3 cm cubes, the broccoli into florets, the onion into wedges and the courgette into chunks. Tip them onto one large tray with the whole garlic cloves.",
                  "Tuck the chicken thighs in between the vegetables. Drizzle with the oil, add the thyme and season with salt and pepper.",
                  "Roast for 40–45 minutes, turning the vegetables halfway, until the chicken is cooked through with no pink inside and the vegetables are soft.",
                  KEEP3, REHEAT])
main_dish("sc11481", "tray-lime-chicken", "Lime and coriander chicken", "tray", "hot",
          [PERI, YOG, JAM], ONION, freezer=True, servings=4, minutes=40,
          converted="air fryer → oven tray: thin chicken strips roast the same way on a hot tray",
          ing={"1/3 cup water": None, "Fresh black pepper": None, "cilantro": ("fresh coriander", 0.5, "bunch"),
               "chili powder": ("mild chilli powder (or more paprika)", 1, "tsp"), "avocado oil": ("cooking oil", 1, "tbsp", "tins-dry"),
               "thin sliced chicken": ("chicken breast fillets, thinly sliced", 905, "g"),
               "Juice of 1 lime": ("lime", 1, ""), "coarse salt": ("salt", 2, "tsp")},
          method=["Heat the oven to 220°C (200°C fan).",
                  "Chop the coriander. On a large tray, mix the coriander, lime juice, oil, honey, garlic powder, chilli powder, paprika, cumin, salt and a little pepper.",
                  "Add the sliced chicken and turn it until coated. Leave for 15 minutes if you have time.",
                  "Spread the chicken out in one layer and roast for 12–15 minutes, until cooked through with no pink inside.",
                  KEEP3F, REHEAT])
main_dish("sc13860", "tray-pepper-chicken-rolls", "Pepper-stuffed chicken rolls", "tray", "hot",
          [JAM, VERDE], SLAW, freezer=True, servings=2, minutes=40,
          converted="air fryer → oven tray at the same heat, a few minutes longer",
          ing={"chili powder": ("mild chilli powder (or more paprika)", 2, "tsp"), "coconut oil": ("cooking oil", 1, "tbsp"),
               "white onion": ("onion", 0.25, ""), "green bell pepper": ("green pepper", 1, "")},
          method=["Heat the oven to 200°C (180°C fan).",
                  "Slice the onion and pepper. Cut each chicken breast in half through the side to make 2 thin pieces, then flatten them with the heel of your hand.",
                  "Lay 3 onion slices and 4 pepper strips at one end of each piece and roll it up tightly. Put the rolls seam side down on one tray.",
                  "Rub with the oil and sprinkle with the chilli powder, cumin and garlic powder.",
                  "Roast for 25 minutes, until cooked through with no pink inside.",
                  KEEP3F, REHEAT])
main_dish("sc13593", "tray-smoky-chicken-thighs", "Smoky paprika chicken thighs", "tray", "hot",
          [PERI, CHIVE, YOG], CUKE, freezer=True, servings=4,
          ing={"Salt, garlic, onion": ("salt, garlic powder, onion powder, smoked paprika and mild chilli powder", 0, TT),
               "32oz": ("chicken thigh fillets, skinless", 900, "g")},
          method=["Heat the oven to 230°C (210°C fan) with one tray inside. Take the hot tray out and give it a light spray of oil.",
                  "Mix equal amounts of salt, garlic powder, onion powder, smoked paprika and mild chilli powder. Dust both sides of each thigh with a light, even coat.",
                  "Lay the thighs on the hot tray. Roast for 12–15 minutes, until cooked through with no pink inside.",
                  "Rest for 5 minutes, then slice.",
                  KEEP3F, REHEAT])
main_dish("sc12045", "tray-salmon-potatoes", "Salmon and potato traybake", "tray", "hot",
          [VERDE, YOG, CHIVE], HERBS, fridge=2,
          ing={"rosemary springs": ("fresh rosemary", 2, "sprigs"), "red onions": ("red onions", 3, ""),
               "cherry tomatoes": ("cherry tomatoes", 250, "g"), "baby potatoes": ("baby potatoes", 800, "g"), "steam broccoli": ("tenderstem broccoli or green beans", 200, "g")},
          method=["Heat the oven to 200°C (180°C fan).",
                  "Halve any big potatoes. Spread them on one large tray, rub with the oil, salt and pepper and roast for 15 minutes.",
                  "Cut the onions into wedges. Add them, the tomatoes and the rosemary to the tray, splash over the balsamic vinegar and roast for 10 minutes.",
                  "Season the salmon and tuck it in with the broccoli. Roast for 12–15 minutes more, until the salmon flakes easily in the middle.",
                  KEEP2, REHEAT])
main_dish("sc11575", "tray-cod-leek-mushroom", "Roast cod with leeks and mushrooms", "tray", "hot",
          [SOY, CHIVE], HERBS, fridge=2, add_allergens=["soy", "gluten"],
          ing={"coconut aminos": ("soy sauce", 1, "tbsp", "tins-dry"), "cod fillets": ("cod or hake fillets", 680, "g"), "shiitake": ("mushrooms (brown or shiitake), sliced", 225, "g"),
               "Freshly ground black pepper": None, "vegetable broth": ("chicken or vegetable stock", 120, "ml")},
          method=["Heat the oven to 190°C (170°C fan).",
                  "Slice the leek and mushrooms. Tip them into one roasting tin with the oil, soy sauce, paprika, salt and some pepper and toss.",
                  "Roast for 10 minutes.",
                  "Stir, lay the seasoned cod on top in one layer and pour in the stock. Roast for 12–15 minutes more, until the fish is white and flakes all the way through.",
                  KEEP2, REHEAT])
main_dish("sc12163", "tray-spiced-white-fish", "Spice-rubbed white fish", "tray", "hot",
          [YOG, TAHINI, JAM], SLAW, fridge=2,
          ing={"Slow-Cooker Ghee": ("ghee or butter, melted", 2, "tbsp"), "coconut sugar": None,
               "whitefish fillets": ("hake or other white fish fillets (about 170 g each)", 4, "")},
          method=["Heat the oven to 200°C (180°C fan).",
                  "Grease one roasting tin with half the melted ghee. Lay the fish in it and brush the tops with the rest.",
                  "Mix the paprika, cumin, onion powder, turmeric, salt and pepper. Sprinkle about 1 tablespoon over the fish so the tops are covered. Keep the rest of the mix in a jar for next time.",
                  "Bake for 12–15 minutes, until the fish is firm and flakes all the way through.",
                  KEEP2, REHEAT])
main_dish("sc10318", "tray-cheesy-chicken-wings", "Cheesy paprika chicken wings", "tray", "hot",
          [JAM, CHIVE], CUKE, freezer=True,
          ing={"light olive oil": ("olive oil", 60, "ml"), "unrefined sea salt": ("salt", 1, "tsp")},
          method=["Heat the oven to 230°C (210°C fan).",
                  "Toss the wings with the oil on one large tray and spread them out.",
                  "Sprinkle the onion powder, paprika and salt over the wings, then scatter the mozzarella on top.",
                  "Roast for 20–25 minutes, until the juices run clear and there is no pink by the bone.",
                  KEEP3F, REHEAT])
main_dish("sc13436", "tray-lemon-herb-fish", "Lemon and herb baked fish", "tray", "hot",
          [VERDE, TAHINI], PEPPERS, fridge=2, servings=2,
          ing={"fish fillets": ("white fish fillets, such as hake or cod (about 140 g each)", 4, ""),
               "all-purpose seasoning": ("mixed dried herbs", 1, "tsp"),
               "dill weed": ("dried dill", 1, "tsp"), "parsley flakes": ("dried parsley", 1.5, "tsp")},
          method=["Heat the oven to 180°C (160°C fan) and lightly oil one roasting tin.",
                  "Lay the fish in the tin in one layer and squeeze half the lemon over it.",
                  "Scatter over the parsley, dill, basil and mixed herbs. Slice the other half of the lemon thinly and lay a slice on each fillet.",
                  "Cover with foil and bake for 12–15 minutes, until the fish flakes all the way through. Thin fillets cook faster, so check early.",
                  KEEP2, REHEAT])
main_dish("sc11789", "tray-lemon-dill-salmon", "Lemon and dill salmon", "tray", "hot",
          [YOG, CHIVE, SOY], CUKE, fridge=2,
          ing={"6-oz.": ("salmon fillets (about 170 g each)", 4, ""), "fresh dill sprigs": ("fresh dill", 8, "sprigs"), "lemon slices": ("lemon", 1, "")},
          method=["Heat the oven to 220°C (200°C fan). Line one tray with foil and oil it lightly.",
                  "Lay the salmon on the tray and season with the salt and pepper. Top each fillet with 2 dill sprigs and 2 half lemon slices.",
                  "Roast for 12–15 minutes, until the salmon just flakes in the middle.",
                  KEEP2, "Also good cold. To eat hot: microwave until steaming hot all the way through. Reheat only once."])
main_dish("sc10831", "tray-hake-tomato-olive", "Baked hake with tomatoes, olives and capers", "tray", "hot",
          [VERDE, CHIVE], HERBS, fridge=2,
          ing={"sea bass fillets": ("hake fillets (or other white fish, about 140 g each)", 4, ""),
               "broth": ("chicken or vegetable stock", 120, "ml"), "spinach": ("spinach", 2, "handfuls")},
          method=["Heat the oven to 190°C (170°C fan).",
                  "Pour the oil into one roasting tin and turn the fish in it so both sides are coated.",
                  "Dice the onion. Scatter the onion, tomatoes, olives, capers and spinach over the fish, pour in the stock and season with the salt and pepper.",
                  "Cover with foil and bake for 15–20 minutes, until the fish is white and flakes all the way through.",
                  KEEP2, REHEAT])

# ================= Pot mains (hob only, one pot) =================
main_dish("sc14075", "pot-chicken-cacciatore", "Chicken cacciatore", "pot", "hot",
          [VERDE, CHIVE], SEEDS, freezer=True,
          ing={"250 g water": None, "1000 g chicken": ("chicken thigh fillets, skinless (or part breast)", 1000, "g"),
               "vegetable broth powder": ("stock powder or 1 stock cube", 10, "g"),
               "1 red bell pepper": ("red pepper", 1, ""), "1 carrot": ("carrot", 1, ""), "1 large onion": ("onion, large", 1, ""),
               "tomato puree": ("tomato purée", 20, "g", "tins-dry")},
          method=["Cut the chicken into large chunks and salt them. Chop the onion, mushrooms, pepper and carrot.",
                  "Warm the oil in one large pot over medium-high heat. Brown the chicken for 1 minute on each side, then lift it onto a plate.",
                  "Add the mushrooms with a splash of water and cook until they shrink and brown, about 5 minutes. Add the other vegetables and cook 5 minutes more.",
                  "Stir in the tomato purée for 30 seconds. Add the stock powder, 200 ml water and the crushed tomatoes and bring to a simmer.",
                  "Put the chicken back, cover and simmer for 25 minutes, until it is cooked through with no pink inside.",
                  KEEP3F, REHEAT])
main_dish("sc13284", "pot-beef-cabbage-soup", "Chunky beef and cabbage soup", "pot", "hot",
          [VERDE, YOG], SEEDS, freezer=True,
          method=["Chop the onion, celery, carrots and cabbage.",
                  "Brown the beef in one large pot over medium heat for 5–7 minutes, breaking it up. Add the salt.",
                  "Add the carrots, celery and onion and cook for 5 minutes.",
                  "Pour in the stock and tomatoes, add the cabbage and bay leaves, cover and simmer for 30–40 minutes, until the vegetables are soft.",
                  "Take out the bay leaves.",
                  KEEP3F, REHEAT])
main_dish("sc13230", "pot-beef-pumpkin-chilli", "Beef, pumpkin and vegetable chilli", "pot", "hot",
          [YOG, JAM, PERI], PUMPKIN, freezer=True, minutes=40,
          ing={"Garlic powder": None, "Paprika": None, "Salt & pepper": ("garlic powder, paprika, salt and pepper", 0, TT),
               "baby marrows": ("courgettes (baby marrows)", 150, "g"), "tomato & onion mix": ("tinned chopped tomatoes with onion", 300, "g"),
               "sweet corn": ("sweetcorn (tinned or frozen)", 50, "g", "tins-dry")},
          method=["Chop the onion, mushrooms, courgettes and broccoli. Cut the pumpkin into 2 cm cubes.",
                  "Brown the mince, onion and mushrooms in one large pot with a little oil spray. Season with garlic powder, paprika, salt and pepper.",
                  "Add the pumpkin, tinned tomatoes and 100 ml water. Cover and simmer for 15 minutes.",
                  "Add the broccoli, courgettes, peas and sweetcorn. Simmer for 8–10 minutes more, until the pumpkin is soft and the mince is cooked through.",
                  KEEP3F, REHEAT])
main_dish("sc10896", "pot-chicken-tomato-curry", "Chicken and tomato curry", "pot", "hot",
          [YOG, PEANUT], HERBS, freezer=True,
          ing={"curry powder": ("mild curry powder", 1.5, "tbsp"), "tomatoes, diced": ("tomatoes, diced", 2, "")},
          method=["Dice the tomatoes.",
                  "Melt the ghee in one pot over medium heat. Add the chicken mince and fry, breaking it up, until browned.",
                  "Stir in the fish sauce, curry powder and some pepper and cook for 2 minutes.",
                  "Add the tomatoes and a splash of water and simmer for 10 minutes, until the chicken is cooked through and the tomatoes have softened.",
                  KEEP3F, REHEAT])
main_dish("sc13177", "pot-honey-garlic-chicken-rice", "Honey garlic chicken with rice and peas", "pot", "hot",
          [SOY, PEANUT], SEEDS, freezer=True, carbs=True,
          ing={"1 cup water": None, "minced garlic": ("garlic, crushed", 1, "tbsp"),
               "Season with pepper, paprika": ("paprika and pepper", 0, TT)},
          method=["Put the rice and 250 ml water in one pot, add a pinch of salt and bring to the boil. Cover and simmer gently for 25 minutes. Stir in the frozen peas for the last 3 minutes.",
                  "Rice: spread it out to cool quickly, then pack single portions into freezer bags or boxes and freeze them today (within 1 hour). Never keep cooked rice in the fridge for days.",
                  "Dice the chicken and toss it with the paprika, pepper and oil.",
                  "Wipe out the pot, heat it and cook the chicken for 6 minutes. Add the honey, soy sauce and garlic and cook 1–2 minutes more, until the chicken is cooked through with no pink inside.",
                  KEEP3,
                  "The night before, move one rice portion to the fridge. Heat the chicken and rice until steaming hot all the way through. Reheat rice only once."])
main_dish("sc13834", "pot-lamb-lentil-ragu", "Lamb and lentil ragù", "pot", "hot",
          [TAHINI, YOG, VERDE], POM, freezer=True,
          ing={"ground lamb": ("lean lamb mince (or lean beef mince)", 450, "g"), "black pepper": None,
               "chicken broth": ("chicken stock", 240, "ml"), "green lentils": ("green or brown lentils (dry)", 96, "g")},
          method=["Chop the onion and garlic.",
                  "Heat the oil in one large pot over high heat. Fry the onion for 3 minutes, then the garlic for 1 minute.",
                  "Add the mince and cook, breaking it up, until browned, 3–4 minutes.",
                  "Stir in the lentils, tomatoes, stock, salt, cumin, oregano and some pepper. Simmer for 20–25 minutes, until the lentils are soft. Add a splash of water if it gets dry.",
                  KEEP3F, REHEAT])
main_dish("sc12279", "pot-coconut-fish-stew", "Coconut fish stew", "pot", "hot",
          [PEANUT, VERDE], HERBS, fridge=2,
          ing={"cilantro": None, "white pepper": None, "zucchini": ("courgettes", 2, ""),
               "lemongrass": ("lemongrass stalk (or the zest of 1 lemon)", 1, ""), "scallions": ("spring onions", 4, ""),
               "firm white fish": ("firm white fish fillets, such as hake", 680, "g"), "coconut oil": ("oil (coconut or sunflower)", 2, "tbsp")},
          method=["Slice the onion, garlic and courgettes thinly. Cut the fish into 3 cm cubes.",
                  "Warm the oil in one large pot over medium heat. Cook the courgettes, onion and garlic for 5 minutes, stirring.",
                  "Add the fish and lemongrass, pour in the coconut milk and season with the salt and a little pepper. Add water just to cover the fish.",
                  "Bring to the boil, then simmer gently for 5–6 minutes, until the fish is white all the way through.",
                  "Take out the lemongrass. Stir in the spring onions and lemon juice.",
                  KEEP2, REHEAT])
main_dish("sc13644", "pot-chicken-artichoke-olive", "Chicken with artichokes and olives", "pot", "hot",
          [VERDE, YOG], SEEDS, freezer=True, minutes=40,
          converted="slow cooker → hob: chicken breasts simmered covered in the tomato sauce",
          ing={"chicken breasts": ("chicken breast fillets", 4, ""), "Artichokes": ("tinned artichoke hearts, drained", 1, "tin"),
               "diced tomatoes": ("tinned chopped tomatoes", 800, "g"), "Kalamata": ("pitted black olives", 0.5, "jar"),
               "Oregano, Salt and Pepper": ("dried oregano, salt and pepper", 0, TT)},
          method=["Chop the garlic and cut the artichokes in half.",
                  "Put the tomatoes, artichokes, olives, garlic, oregano, salt and pepper in one large pot and bring to a simmer.",
                  "Add the chicken breasts so they sit in the sauce. Cover and simmer gently for 25–30 minutes, turning once, until the chicken is cooked through with no pink inside.",
                  "Lift out the chicken, slice it and stir it back into the sauce.",
                  KEEP3F, REHEAT])
main_dish("sc11856", "pot-chicken-onion-olive", "Chicken with onions, olives and sun-dried tomatoes", "pot", "hot",
          [CHIVE, TAHINI], PUMPKIN, freezer=True, minutes=45,
          converted="slow cooker → hob: sear in the pot, then simmer covered",
          ing={"Mediterranean Seasoning": ("mixed dried herbs", 1, "tsp"), "Kalamata": ("pitted black olives", 75, "g"),
               "Boneless Chicken Breasts": ("chicken breast fillets", 1100, "g"), "Chicken Stock": ("chicken stock", 60, "ml")},
          method=["Chop the onion and garlic.",
                  "Brown the chicken on both sides in one large pot with a little oil, about 2 minutes a side.",
                  "Add the onion, olives, sun-dried tomatoes, lemon juice, garlic, herbs, pepper and stock, plus 150 ml water.",
                  "Cover and simmer gently for 25–30 minutes, turning the chicken once, until it is cooked through with no pink inside. Slice it in the pot.",
                  KEEP3F, REHEAT])
main_dish("sc13041", "pot-five-spice-chicken", "Five-spice ginger chicken", "pot", "hot",
          [SOY, CHIVE, PEANUT], SLAW, freezer=True, minutes=50,
          converted="slow cooker → hob: thighs simmered covered until tender",
          ing={"chicken thighs": ("chicken thigh fillets, skinless", 1100, "g"), "chicken broth": ("chicken stock", 240, "ml"),
               "lemon zest": ("lemon zest", 0.5, "tsp"), "5-spice": ("Chinese five-spice powder", 1, "tsp")},
          method=["Chop the onion, celery, garlic and ginger. Trim any fat off the chicken.",
                  "Put the chicken in one large pot. Add the onion, celery, garlic, ginger, lemon zest, salt and five-spice, then pour in the stock.",
                  "Bring to the boil, cover and simmer gently for 35–40 minutes, until the chicken is cooked through and pulls apart with a fork.",
                  "Shred the chicken in the pot with two forks.",
                  KEEP3F, REHEAT])
main_dish("sc12639", "pot-coconut-tomato-chicken-soup", "Coconut, tomato and chicken soup", "pot", "hot",
          [VERDE, PERI], SEEDS, freezer=True, minutes=40,
          converted="slow cooker → hob: fresh (not frozen) chicken simmered covered in the soup",
          ing={"frozen skinless boneless chicken breast": ("chicken breast fillets (fresh, not frozen)", 4, "", "fridge"),
               "coconut milk": ("coconut milk", 1, "tin (400 ml)", "tins-dry"), "diced tomatoes": ("tinned chopped tomatoes", 1, "tin (400 g)", "tins-dry"),
               "Garlic salt": None, "Sea Salt": ("salt and pepper", 0, TT), "chicken broth": ("chicken stock", 240, "ml"),
               "Italian Seasoning": ("mixed dried herbs", 2, "tbsp")},
          method=["Chop the garlic.",
                  "Put everything in one large pot and bring to a simmer.",
                  "Cover and simmer gently for 25–30 minutes, until the chicken is cooked through with no pink inside.",
                  "Lift out the chicken, shred it with two forks and stir it back in.",
                  KEEP3F, REHEAT])
main_dish("sc11573", "pot-beef-bean-chilli", "Beef and bean chilli", "pot", "hot",
          [YOG, JAM], ONION, freezer=True,
          ing={"taco seasoning": ("taco seasoning (mild)", 2, "tsp"), "steamed mixed veggies": ("frozen mixed vegetables", 100, "g"),
               "tomato & onion mix": ("tinned chopped tomatoes with onion", 150, "g")},
          method=["Brown the mince in one pot with a little oil spray, breaking it up. Season with the taco seasoning and garlic powder.",
                  "When the mince is nearly cooked, add the tinned tomatoes.",
                  "Add the drained beans and the frozen vegetables. Simmer for 8–10 minutes, until the mince is cooked through and the vegetables are hot.",
                  "Grate the cheddar and keep it in a small bag to sprinkle on after heating.",
                  KEEP3F, REHEAT])

# ================= Good-cold carry mains (still one tray or one pot) =================
main_dish("sc12228", "cold-chicken-fajita-strips", "Chicken fajita strips with peppers", "tray", "cold",
          [PERI, YOG, JAM], PEPPERS, freezer=True, minutes=30,
          converted="air fryer → oven tray: strips roasted at a high heat",
          ing={"chili powder": ("mild chilli powder (or more paprika)", 1, "tbsp"), "coconut oil": ("oil (coconut or sunflower)", 2, "tbsp"),
               "10 ounces": ("chicken breast fillets", 285, "g"), "green bell pepper": ("green pepper", 0.5, ""),
               "red bell pepper": ("red pepper", 0.5, "")},
          method=["Heat the oven to 220°C (200°C fan).",
                  "Slice the chicken into thin strips and the onion and peppers into strips.",
                  "On one large tray, toss the chicken with the oil, chilli powder, cumin, paprika and garlic powder. Spread it out.",
                  "Roast for 8 minutes. Add the onion and peppers, stir and roast 8–10 minutes more, until the chicken is cooked through with no pink inside.",
                  KEEP3F, "Good cold with salad leaves. To eat hot: microwave until steaming hot all the way through."])
main_dish("sc12600", "cold-salmon-quinoa", "Salmon, pepper and quinoa salad", "tray", "cold",
          [CHIVE, TAHINI], HERBS, fridge=2, minutes=25,
          ing={"1 litre of boiling water": None, "spices for salmon": ("fish spice (or paprika)", 1, "tsp"),
               "salmon fillets": ("salmon fillets (about 100 g each)", 4, ""), "cooked quinoa": ("cooked quinoa (ready to eat)", 250, "g"),
               "parsley": ("fresh parsley", 2, "handfuls")},
          method=["Heat the oven to 200°C (180°C fan).",
                  "Slice the pepper into strips. Toss it with the oil on one tray and roast for 5 minutes.",
                  "Add the salmon to the tray and sprinkle it with the spice. Roast for 10 minutes, adding the sugar snaps for the last 3 minutes, until the salmon flakes in the middle.",
                  "Chop the parsley and chives and mix them through the quinoa. Share the quinoa between 4 boxes and top with the peppers, sugar snaps and salmon.",
                  KEEP2])
main_dish("sc10263", "cold-chicken-couscous-feta", "Chicken, couscous and feta salad", "tray", "cold",
          [YOG, PERI], CUKE, minutes=25,
          converted="pan → oven tray for the chicken",
          ing={"chicken breast (raw": ("chicken breast fillet", 110, "g"), "couscous (raw": ("couscous (dry)", 40, "g"),
               "peri-peri sauce": ("lemon and herb peri-peri sauce (mild, bought)", 30, "g"), "fat free feta": ("feta (reduced-fat)", 20, "g"),
               "red onion": ("red onion", 30, "g"), "baby tomatoes": ("cherry tomatoes", 100, "g")},
          method=["Heat the oven to 200°C (180°C fan).",
                  "Put the chicken on one small tray, season with the garlic powder, paprika, salt and pepper and roast for 18–20 minutes, until cooked through with no pink inside.",
                  "Meanwhile put the couscous and a pinch of salt in your lunch box, pour on 100 ml boiling water, cover and leave for 5 minutes. Fluff it with a fork.",
                  "Dice the cucumber, tomatoes and red onion and add them to the box. Slice the chicken and add it with the crumbled feta.",
                  "Keep the peri-peri sauce in a separate small pot and pour it over just before eating.",
                  KEEP3])
main_dish("sc11578", "cold-honey-soy-chicken-slaw", "Honey-soy chicken with crunchy slaw", "tray", "cold",
          [PEANUT, SOY], SEEDS, minutes=25,
          converted="griddle pan → oven tray for the chicken",
          ing={"Slaw:": None, "deboned skinless chicken thighs": ("chicken thigh fillets, skinless", 120, "g"),
               "shredded cabbage": ("cabbage, shredded", 60, "g"), "chopped chives": ("fresh chives", 2, "sprigs"),
               "honey soy & ginger": ("honey, soy and ginger stir-fry sauce (bought)", 40, "g")},
          method=["Heat the oven to 200°C (180°C fan).",
                  "Season the chicken with the paprika, garlic powder, salt and pepper. Roast on one small tray for 20–25 minutes, until cooked through with no pink inside. Let it cool and slice it.",
                  "Chop the broccoli small and slice the cucumber and chives. Put them in your lunch box with the cabbage.",
                  "Put the chicken on top. Keep the honey-soy sauce in a separate pot and pour it over just before eating.",
                  "Cut the avocado on the morning you eat it, so it stays green.",
                  KEEP3])
main_dish("sc11145", "cold-paprika-beef-lettuce-cups", "Paprika beef lettuce cups", "pot", "cold",
          [YOG, VERDE], ONION,
          ing={"lean ground beef": ("lean beef mince", 250, "g"), "1 pepper": ("pepper (any colour)", 1, ""),
               "baby Romanian lettuce": ("cos lettuce leaves", 8, ""), "parsley": ("fresh parsley", 1, "handful"), "cherry tomatoes": ("cherry tomatoes", 125, "g")},
          method=["Brown the mince in one pot with no oil, breaking it up, until cooked through. Season with the paprika, salt and pepper and stir in the chopped spring onions. Let it cool.",
                  "Dice the pepper and halve the tomatoes. Pack them with the parsley and lemon juice in the second part of the box.",
                  "Pack the lettuce leaves whole, wrapped in a paper towel.",
                  "Cut the avocado on the morning you eat it. Spoon the beef and the salad into the leaves to eat.",
                  KEEP3])
main_dish("sc12764", "cold-hake-potato-salad", "Hake with potato salad", "pot", "cold",
          [VERDE, CHIVE], HERBS, fridge=2,
          ing={"Fish Spice": ("fish spice", 1, "tsp"), "Salad Onions": ("spring onions", 2, ""),
               "Lite Mayo": ("light mayonnaise", 20, "g"), "Hake Fillet": ("hake fillet (or other white fish)", 200, "g"),
               "White Potato": ("potato, large", 1, ""), "Gherkins": ("gherkins", 3, "")},
          method=["Peel the potato and cut it into 2 cm cubes. Boil in one pot of salted water for 10–12 minutes, until soft all the way through. Drain, holding the lid on, and tip into your box.",
                  "Chop the gherkins and spring onions and mix them into the potato with the mayonnaise. Season.",
                  "Wipe the pot dry and heat it with a little oil spray. Put in the fish, sprinkle it with fish spice and cook 3–4 minutes a side, until white and flaking all the way through.",
                  "Pack the fish next to the potato salad with a wedge of lemon.",
                  KEEP2])

# ================= Breakfasts that pack =================
sel("sc13842", "egg-white-bites", "Italian egg white bites", "breakfast", wash=4, fridge=3, freezer=True,
    carry="hot", pack="Small box. Warm for 30–60 seconds until hot through, or eat cold.",
    ing={"egg whites": ("egg whites", 300, "g"), "mozzarella": ("mozzarella, grated", 25, "g")},
    method=["Heat the oven to 180°C (160°C fan). Oil 6 holes of a muffin tray, or use paper cases.",
            "Chop the tomato and spinach very small.",
            "Mix everything in a jug and pour it into the 6 holes.",
            "Bake for 15–18 minutes, until set in the middle.",
            "Cool, then keep in a box in the fridge for up to 3 days, or freeze."])
sel("sc10863", "turkey-blueberry-patties", "Turkey and blueberry breakfast patties", "breakfast", wash=3, fridge=3,
    freezer=True, carry="hot", pack="Small box. Warm until hot all the way through.",
    ing={"Extra-virgin olive oil": ("olive oil, for brushing", 0, TT), "ground turkey": ("turkey mince (or chicken mince)", 680, "g"),
         "dried blueberries": ("dried blueberries or cranberries", 70, "g"), "scallions": ("spring onions", 2, ""),
         "fresh sage": ("fresh sage, chopped (or 1 tsp dried)", 1, "tbsp")},
    method=["Heat the oven to 200°C (180°C fan) and brush one tray with oil.",
            "Mix the mince, dried berries, sliced spring onions, sage, nutmeg, salt and pepper with your hands, right on the tray.",
            "Shape into 12 small patties and spread them out on the tray.",
            "Bake for 12–15 minutes, until firm and cooked through with no pink inside.",
            "Cool, then keep in the fridge for up to 3 days, or freeze."])
sel("sc12871", "mango-cottage-cheese-pot", "Mango, cottage cheese and yoghurt pot", "breakfast", extra=["snack"],
    wash=2, fridge=2, carry="cold", pack="Jar with a lid. Fridge, or an ice pack.",
    ing={"cottage cheese": ("cottage cheese", 225, "g"), "Greek yogurt": ("plain Greek yoghurt (fat-free)", 80, "g"),
         "honey to taste": ("honey", 1, "tsp"), "vanilla": ("vanilla extract", 0, TT),
         "fresh mango": ("mango, diced (fresh or frozen)", 40, "g", "fruit-veg")},
    method=["Stir the yoghurt and cottage cheese together in a jar.",
            "Put the mango on top and drizzle with the honey and a drop of vanilla.",
            "Make up to 2 days ahead and keep in the fridge."])
sel("sc11690", "berry-walnut-yoghurt-pot", "Berry and walnut yoghurt pot", "breakfast", extra=["snack"],
    wash=2, fridge=1, carry="cold", pack="Jar with a lid, walnuts in a small bag. Fridge, or an ice pack.",
    ing={"skyr": ("plain Greek yoghurt (fat-free) or skyr", 300, "g")},
    method=["Cut the strawberries into small pieces.",
            "Put the yoghurt in a jar and stir in the berries and honey.",
            "Break up the walnuts and keep them in a small bag, so they stay crunchy.",
            "Make the night before and keep in the fridge."])
sel("sc10344", "salmon-frittata", "Smoked salmon and vegetable frittata", "breakfast", wash=3, fridge=2,
    carry="cold", pack="Small box. Good cold. Fridge, or an ice pack.", minutes=35,
    converted="pan + tin → one tin: the vegetables soften in the oven first",
    ing={"coconut oil": ("oil", 0.5, "tsp"), "Tenderstem": ("tenderstem broccoli", 60, "g"), "yellow bell pepper": ("yellow pepper", 0.5, ""), "1 tomato": ("tomato", 1, "")},
    method=["Heat the oven to 190°C (170°C fan).",
            "Cut the onion, pepper, tomato and broccoli into chunks. Toss them with the oil in one small round tin and roast for 10 minutes.",
            "Beat the eggs with a fork in a mug with a little salt and pepper.",
            "Scatter the smoked salmon over the vegetables and pour the egg on top. Bake for 15–20 minutes, until set in the middle.",
            "Cool, slice and keep in the fridge for up to 2 days."])
sel("sc10098", "breakfast-fried-rice", "Breakfast fried rice", "breakfast", wash=3, fridge=1, freezer=True,
    carbs=True, carry="hot", pack="Microwave-safe box. Heat until steaming hot all the way through.",
    ing={"1 cup water": None, "turkey bacon": ("bacon (turkey or back bacon)", 2, "slices"),
         "egg whites": ("egg whites", 245, "g"), "minced garlic": ("garlic, crushed", 1, "tsp")},
    method=["Put the rice and 250 ml water in one pot with a pinch of salt. Bring to the boil, cover and simmer for 25 minutes. Tip it onto a plate to cool.",
            "Heat the oil in the same pot and fry the bacon for 2 minutes a side, until crisp. Lift it out and chop it.",
            "Beat the eggs and egg whites with the chopped onion and garlic. Pour into the pot, cover and cook 2–3 minutes, then break into small pieces.",
            "Add the bacon, rice, soy sauce and frozen vegetables and stir until the vegetables are hot.",
            "Rice: cool quickly and freeze in single portions today (within 1 hour). The night before, move one to the fridge and eat it within a day. Reheat once, until steaming hot."])
sel("sc12088", "beef-egg-stacks", "Beef patty and egg stacks", "breakfast", wash=3, fridge=3, freezer=True,
    carry="hot", pack="Small box. Warm until hot all the way through.", servings=6,
    ing={"cooked bacon strips": ("back bacon", 6, "slices"), "ground beef": ("lean beef mince", 450, "g"),
         "coconut oil": ("oil", 1, "tbsp")},
    method=["Mix the mince with the fennel seeds, nutmeg, allspice and pepper on a board and shape into 6 patties.",
            "Warm the oil in one large frying pan over medium-low heat. Fry the bacon until crisp and lift it out.",
            "Beat the eggs and pour them into the pan in loose rounds. Turn each to cook the second side, then lift out.",
            "Fry the patties in the same pan for 4–5 minutes a side, until cooked through with no pink inside.",
            "Stack each patty and some bacon between 2 egg rounds. Cool, then keep in the fridge for up to 3 days, or freeze."])
sel("sc10634", "tuna-egg-muffins", "Tuna, cheese and egg muffins", "breakfast", extra=["snack"], wash=3, fridge=3,
    freezer=True, carry="cold", pack="Small box. Good cold, or warm for 30 seconds.", servings=4,
    ing={"100g broccoli": ("broccoli", 100, "g", "fruit-veg"), "low-cal spray oil": ("cooking spray", 0, TT)},
    method=["Heat the oven to 180°C (160°C fan). Spray 8 holes of a muffin tray.",
            "Crack the eggs into a large jug, season and whisk.",
            "Dice the red pepper, broccoli and spring onions very small and stir them into the eggs with the Parmesan. Flake in the tuna.",
            "Share between the 8 holes and scatter the cheddar on top. Bake for 18–20 minutes, until set all the way through.",
            "Cool, then keep in the fridge for up to 3 days, or freeze. 2 muffins = 1 serving."])

# ================= Snacks =================
sel("sc11998", "veg-egg-white-cups", "Cheesy vegetable egg white cups", "snack", servings=4, wash=4, fridge=3, freezer=True,
    carry="cold", pack="Small box. Good cold.",
    ing={"(Recipe makes 12)": None, "Egg Whites": ("egg whites", 360, "g"), "Garlic Powder": ("garlic powder", 0, TT), "Paprika": ("paprika", 0, TT)},
    method=["Heat the oven to 180°C (160°C fan). Oil a 12-hole muffin tray.",
            "Chop the onion, tomato, pepper and mushrooms very small.",
            "Whisk the egg whites in a jug with the vegetables, cheese, garlic powder, paprika, salt and pepper.",
            "Pour into the 12 holes and bake for 18–20 minutes, until set.",
            "Cool, then keep in the fridge for up to 3 days. Eat 3 at a time (1 serving)."])
sel("sc13510", "tzatziki-veg-sticks", "Tzatziki dip", "snack", wash=2, fridge=3, carry="cold", pack="Small pot. Fridge, or an ice pack.",
    ing={"greek yogurt": ("plain Greek yoghurt (fat-free)", 100, "g"), "lemon": ("lemon", 0.25, ""), "olive oil": ("olive oil", 1, "tsp")},
    method=["Grate the garlic into a small pot.",
            "Chop the dill and add it with the yoghurt, oil, a squeeze of lemon, salt and pepper.",
            "Stir until smooth. Eat with cucumber or carrot sticks. Keeps 3 days in the fridge."])
sel("sc13449", "prosciutto-asparagus", "Prosciutto-wrapped asparagus", "snack", wash=1, fridge=2, carry="cold",
    pack="Small box. Good cold.", minutes=20,
    converted="pressure-cooker steam → oven tray",
    ing={"2 cups water": None, "asparagus": ("asparagus, trimmed", 450, "g"), "prosciutto": ("prosciutto (or thin ham)", 225, "g")},
    method=["Heat the oven to 200°C (180°C fan).",
            "Wrap each asparagus spear in a strip of prosciutto and lay them on one tray.",
            "Roast for 10–12 minutes, until the asparagus is just tender.",
            "Eat warm or cold. Keeps 2 days in the fridge."])
sel("sc11378", "trout-mango-wraps", "Smoked trout and mango lettuce wraps", "snack", servings=2, wash=2, fridge=1,
    carry="cold", pack="Small box. Fridge, or an ice pack. Eat the same day.",
    ing={"lettuce leaves": ("large lettuce leaves", 4, ""), "lemon juice": ("lemon juice (about 1 lemon)", 2, "tbsp"),
         "scallion": ("spring onion", 1, "")},
    method=["Lay the lettuce leaves flat and share the trout and mango between them.",
            "Scatter over the sliced spring onion and spoon over the lemon juice.",
            "Roll each leaf up and pack them seam side down. Keep in the fridge and eat the same day."])
sel("sc12046", "cottage-cheese-fruit-pot", "Cottage cheese and fruit pot", "snack", extra=["breakfast"], wash=2, fridge=1,
    carry="cold", pack="Jar with a lid. Fridge, or an ice pack.",
    ing={"Goji": ("dried cranberries or goji berries", 28, "g"), "full fat": ("cottage cheese", 400, "g"),
         "mango, cut": ("mango, diced", 170, "g"), "juice of half a lime": ("lime", 0.5, "")},
    method=["Dice the mango and toss it with the blueberries and a squeeze of lime.",
            "Share the cottage cheese between 2 jars and spoon the fruit on top. Add the dried berries.",
            "Keep in the fridge and eat the same day or the next morning."])
sel("sc12409", "bacon-egg-lettuce-wraps", "Bacon, egg and tomato lettuce wraps", "snack", extra=["main"], wash=3, fridge=1,
    carry="cold", pack="Box with an ice pack. Fill the leaves when you eat.",
    ing={"bacon medallions": ("lean back bacon", 4, "slices"), "lettuce leaves": ("large lettuce leaves", 4, ""),
         "hard-boiled eggs": ("eggs", 2, ""), "mayo": ("mayonnaise", 1, "tsp")},
    method=["Boil the eggs in one pot for 10 minutes, then cool them in cold water.",
            "Tip out the water and fry the bacon in the same dry pot until crisp. Let it cool.",
            "Peel and chop the eggs and chop the bacon. Stir the diced tomato into the mayonnaise with salt and pepper.",
            "Pack the leaves separately and fill them when you eat. Boiled eggs and bacon keep 3 days in the fridge."])

# ---------------- conversion helpers ----------------
NAME = {  # item name (library) -> plain UK/SA shopping name
    "Eggs (large)": "eggs", "Chicken breast fillets (skinless)": "chicken breast fillets",
    "Chicken thigh fillets (skinless)": "chicken thigh fillets, skinless", "Beef mince (lean)": "lean beef mince",
    "Chicken mince": "chicken mince", "Turkey mince": "turkey mince", "Garlic (fresh bulbs)": "garlic cloves",
    "Black pepper (ground)": "black pepper", "Salt (table)": "salt", "Fat-free Greek yoghurt": "plain Greek yoghurt (fat-free)",
    "Low-fat cottage cheese": "cottage cheese (low-fat)", "Cottage cheese (full-fat)": "cottage cheese",
    "Cheddar cheese (low-fat)": "cheddar (reduced-fat), grated", "Parmesan cheese": "Parmesan, grated",
    "White button mushrooms": "mushrooms", "Canned chopped tomatoes": "tinned chopped tomatoes",
    "Canned tomato & onion mix": "tinned chopped tomatoes with onion", "Canned tuna (in brine)": "tinned tuna in brine",
    "Frozen peas": "frozen peas", "Onions": "onion", "Red peppers": "red pepper", "Courgette": "courgette",
    "Mangoes": "mango", "Lemons": "lemon", "Limes": "lime", "Avocados": "avocado", "Tomatoes": "tomatoes",
    "Carrots": "carrots", "Bananas": "banana", "Sweet potatoes": "sweet potato", "Potatoes": "potatoes",
    "Baby potatoes": "baby potatoes", "Spring onions": "spring onions", "Fresh chives": "fresh chives",
    "Fresh parsley": "fresh parsley", "Fresh dill": "fresh dill", "Fresh basil": "fresh basil", "Fresh ginger": "fresh ginger",
    "Olive oil": "olive oil", "Sunflower oil": "sunflower oil", "Coconut oil": "coconut oil", "Soy sauce": "soy sauce",
    "Honey": "honey", "Vanilla extract": "vanilla extract", "Smoked salmon": "smoked salmon", "Smoked trout": "smoked trout",
    "Back bacon": "back bacon", "Mustard (prepared)": "Dijon or wholegrain mustard", "Mayonnaise (light)": "light mayonnaise",
    "Chicken stock (liquid, carton)": "chicken stock", "Vegetable stock (liquid, carton)": "vegetable or chicken stock",
    "Beef stock (liquid, carton)": "beef stock", "Goat's cheese (chevin)": "goat's cheese, crumbled",
    "Mozzarella cheese (low-fat)": "mozzarella (reduced-fat), grated", "Cheddar cheese": "cheddar, grated",
    "Butternut squash": "butternut", "Cos lettuce": "cos lettuce", "Mixed salad leaves": "lettuce leaves",
    "Gherkins (dill pickles)": "gherkins", "Green olives": "olives", "Capers": "capers", "Balsamic vinegar": "balsamic vinegar",
    "Butter (salted)": "butter", "Fennel bulb": "fennel bulb", "Leeks": "leeks", "Sugar snap peas": "sugar snap peas",
    "Frozen mixed vegetables": "frozen stir-fry vegetables", "Hake fillets": "hake fillets", "Salmon fillets": "salmon fillets",
    "Margarine (tub)": "margarine", "Plain flour": "plain flour", "Fat-free milk": "skimmed milk", "Pasta (dry)": "pasta (dry)",
    "White rice (dry)": "white rice", "Ghee": "ghee", "Fish sauce": "fish sauce", "Curry powder": "curry powder",
    "Paprika": "paprika", "Garlic powder": "garlic powder", "Ground cumin": "ground cumin", "Dried oregano": "dried oregano",
    "Dried thyme": "dried thyme", "Bay leaves": "bay leaves", "Celery": "celery sticks", "Cabbage": "cabbage",
    "Cauliflower": "cauliflower", "Broccoli": "broccoli", "Frozen broccoli": "broccoli", "Asparagus": "asparagus",
    "Baby spinach": "baby spinach", "Blueberries": "blueberries", "Strawberries": "strawberries", "Walnuts": "walnuts",
    "Sesame seeds": "sesame seeds", "Orange juice (100%)": "orange juice", "Dried basil": "dried basil",
}
COUNT_WORDS = {"clove": "", "slice": "slices", "handful": "handful", "bunch": "bunch", "sprig": "sprigs",
               "leaf": "", "tin": "tin", "pinch": "pinch", "tsp": "tsp", "tbsp": "tbsp"}


def area_for(item, group, name):
    n = (name + " " + item.get("item_name", "")).lower()
    if "frozen" in n and "broccoli" not in name.lower():
        return "freezer"
    if any(w in n for w in ("tinned", "canned", "tin ")):
        return "tins-dry"
    nl = name.lower()
    if nl.startswith("dried") or nl == "bay leaves" or "powder" in nl or "seasoning" in nl or "spice" in nl:
        return "tins-dry"
    if "yoghurt" in nl or "juice" in nl and "lemon" not in nl or "margarine" in nl:
        return "fridge"
    if nl.startswith("fresh"):
        return "fruit-veg"
    g = int(group) if group else 0
    if g == 55:
        return "tins-dry"
    if 1 <= g <= 30 or g == 37:
        return "fridge"
    if 38 <= g <= 67 or g in (88, 89):
        return "fruit-veg"
    return "tins-dry"


def rnd(x):
    if x >= 100:
        return int(round(x / 5.0) * 5)
    if x >= 20:
        return int(round(x))
    if x == int(x):
        return int(x)
    return round(x * 4) / 4 if x < 1 else round(x, 1)


def convert_line(l, item, name_intl):
    """Library line -> (name, qty, unit). Weighed lines become grams/ml; spoons and counts stay."""
    name = NAME.get(name_intl, name_intl.lower() if name_intl else l["raw_line"].lower())
    unit, method, status = l["unit"], l["grams_method"], l["parse_status"]
    qty = float(l["qty"]) if l["qty"] else None
    grams = float(l["grams"]) if l["grams"] else None
    if status in ("to_taste", "no_weight") or (qty is None and grams is None):
        return name, 0, TT
    liquid = any(w in name for w in ("stock", "milk", "juice", "vinegar"))
    if unit in ("tsp", "tbsp", "pinch") and qty:
        if name == "lemon":
            name = "lemon juice"
        return name, rnd(qty), unit
    if unit in ("clove",) and qty:
        return name, rnd(qty), ""
    if unit in ("slice", "handful", "bunch", "sprig") and qty:
        return name, rnd(qty), COUNT_WORDS[unit]
    if unit == "" and qty and method.startswith(("piece", "count", "explicit", "review")):
        return name, rnd(qty), ""
    if grams:
        return name, rnd(grams), "ml" if liquid else "g"
    return name, rnd(qty or 0), unit


def clean_name(n):
    return n[:1].lower() + n[1:] if n and not n.startswith(("Parmesan", "Dijon")) else n




def main():
    R = {r["recipe_id"]: r for r in csv.DictReader(open(DATA / "recipes.csv"))}
    I = {r["item_id"]: r for r in csv.DictReader(open(DATA / "items.csv"))}
    N = {r["item_id"]: r["name_intl"] for r in csv.DictReader(open(DATA / "item_names.csv"))}
    held = {r["recipe_id"] for f in DATA.glob("*held*.csv") for r in csv.DictReader(open(f))
            if f.name.startswith(("cook_held", "food_match_held", "cream_held"))}
    L = collections.defaultdict(list)
    for l in csv.DictReader(open(DATA / "recipe_ingredients.csv")):
        L[l["recipe_id"]].append(l)
    out = []
    for rid, s in S.items():
        r = R[rid]
        assert r["macro_status"] in ("ok", "recomputed"), rid
        assert rid not in held, rid
        assert r["spicy"] == "No", rid
        allergens = {ALLERGEN_MAP[a.strip()] for a in r["allergens"].split(",") if a.strip() in ALLERGEN_MAP}
        ings = []
        for l in L[rid]:
            if l["parse_status"] in ("heading", "skipped"):
                continue
            ov = None
            matched = False
            for key, val in s.get("ing", {}).items():
                if key in l["raw_line"]:
                    ov, matched = val, True
                    break
            item = I.get(l["item_id"], {})
            if matched and ov is None:
                continue  # dropped line (water, garnish, optional extra, split seasoning)
            for flag, al in ITEM_FLAGS.items():
                if item.get(flag) == "1":
                    allergens.add(al)
            name, qty, unit = convert_line(l, item, N.get(l["item_id"], ""))
            area = None
            if ov:
                name, qty, unit = ov[0], ov[1], ov[2]
                area = ov[3] if len(ov) > 3 else None
            area = area or area_for(item, item.get("group_id", ""), name)
            name = clean_name(name)
            if name == "black pepper" and unit == TT:
                name = "salt and pepper"
            ings.append({"name": name, "qty": qty, "unit": unit, "area": area})
        for a in s.get("add", []):
            ings.append({"name": a[0], "qty": a[1], "unit": a[2], "area": a[3]})
        for a in s.get("add_allergens", []):
            allergens.add(a)
        for a in s.get("drop_allergens", []):
            allergens.discard(a)
        src_serv = float(r["servings"])
        serv = s.get("servings", src_serv)
        f = src_serv / serv
        meal_types = [s["meal"]] + [m for m in s.get("extra", []) if m != s["meal"]]
        method = [re.sub(r"yogurt", "yoghurt", m) for m in s["method"]]
        row = {
            "id": "rec-" + s["slug"], "name": s["name"], "mealTypes": meal_types,
            "minutes": int(s.get("minutes", float(r["total_time_min"]))), "servings": int(serv),
            "kcal": int(round(float(r["calories"]) * f)), "protein": int(round(float(r["protein"]) * f)),
            "allergens": [a for a in ORDER if a in allergens],
            "batch": s["meal"] == "main",
        }
        if "fmt" in s:
            row["format"] = s["fmt"]
        row.update({
            "washUp": s["wash"], "fridgeDays": s["fridge"], "freezer": bool(s.get("freezer", False)),
            "carbsFrozen": bool(s.get("carbs", False)), "carry": s["carry"], "pack": s["pack"],
            "sauces": s.get("sauces", []),
        })
        if "topping" in s:
            row["topping"] = s["topping"]
        row["ingredients"] = ings
        row["method"] = method
        out.append(row)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(out)} recipes to {OUT}")


if __name__ == "__main__":
    main()
