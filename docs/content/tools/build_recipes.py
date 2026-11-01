#!/usr/bin/env python3
"""Build src/content/recipes.json from Jennifer's recipe library (v3.12).

Usage: python3 docs/content/tools/build_recipes.py [path/to/recipe-library/v3.12/data]

The selection below was hand-picked from a filtered pool (see docs/content/README.md):
macro_status ok/recomputed, not held, spicy = No, <= 10 ingredients, <= 30 min (batch mains <= 60),
no pressure cooker / slow cooker, protein_per_100kcal >= 6 preferred, no specialty items.
Each entry may carry small overrides: a plain display name, ingredient renames / drops (a dropped
line is only an optional garnish, water, or a sub-recipe heading), a whole-recipe servings rescale
(same total food, so kcal and protein per serving scale by old/new), and method fixes for clarity.
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
# Each selection: id -> dict(slug, name, meal (primary), extra meal types, ing overrides, method, ...)
# ing: {raw_line substring: (name, qty, unit) | None (drop)}; any line not matched is converted automatically.
# add: extra (name, qty, unit, area) lines that split a "Season with ..." line into its parts.
S = {}

def sel(rid, slug, name, meal, **kw):
    S[rid] = dict(slug=slug, name=name, meal=meal, **kw)

# ---------------- Breakfasts ----------------
sel("sc11411", "salmon-egg-cups", "Baked smoked salmon and egg cups", "breakfast",
    ing={"handful of baby spinach": ("baby spinach", 1, "handful")},
    method=["Heat the oven to 200°C (180°C fan). Lightly grease 4 holes of a muffin tray, or 4 small ovenproof dishes.",
            "Line each hole with smoked salmon.",
            "Chop the spinach. In a bowl, beat the eggs with a fork, then stir in the spinach, chives and some black pepper.",
            "Share the mix between the 4 holes, top with the Parmesan and a little more pepper. Bake for 15 minutes, until the eggs are just set."])
sel("sc12856", "cheesy-scrambled-eggs", "Cheesy scrambled eggs", "breakfast",
    ing={"Chives": ("fresh chives, chopped", 1, "tbsp")},
    method=["Blend the cottage cheese until smooth with a stick blender or blender.",
            "Beat the eggs in a bowl, then whisk in the blended cottage cheese until no lumps are left.",
            "Warm a pan over medium-low heat with a little oil spray.",
            "Pour in the eggs and keep stirring through the middle of the pan, so they stay soft.",
            "When the eggs are mostly set but still a little runny, take the pan off the heat and stir in the cheddar, Parmesan, salt and pepper.",
            "Put the pan back on the heat and cook until no runny egg is left. Top with the chives."])
sel("sc12365", "full-english", "Full English breakfast", "breakfast",
    ing={"KJ controlled bread": ("bread, thin slices", 2, "slices"),
         "lean round cut bacon": ("lean back bacon", 50, "g")},
    method=["Warm a non-stick pan and give it a light coat of cooking spray.",
            "Slice the mushrooms. Fry them with the spinach and a little salt and pepper until soft, then lift them onto a plate.",
            "Fry the bacon in the same pan until crisp.",
            "Spray the pan again, crack in the eggs and cook them the way you like.",
            "Toast the bread and serve with the eggs, bacon, mushrooms and spinach."])
sel("sc10634", "tuna-egg-muffins", "Tuna, cheese and egg muffins", "breakfast", extra=["snack"], servings=4,
    ing={"100g broccoli": ("broccoli", 100, "g", "fruit-veg"),
         "low-cal spray oil": ("cooking spray", 0, TT)},
    method=["Heat the oven to 180°C. Crack the eggs into a large jug, season and whisk.",
            "Finely dice the red pepper, broccoli and spring onions and stir them into the eggs with the Parmesan. Flake in the tuna and stir again.",
            "Spray 8 holes of a muffin tray (or 8 paper cases) with cooking spray. Share the egg mix between them and scatter the cheddar on top.",
            "Bake on the middle shelf for 18–20 minutes, until set all the way through and golden. Eat warm, or cool on a rack and keep in the fridge."])
sel("sc10597", "eggs-asparagus", "Boiled eggs with asparagus soldiers", "breakfast",
    ing={"large pinch of ground cumin": ("ground cumin or smoked paprika", 1, "pinch")},
    method=["Snap the tough ends off the asparagus. Cook the spears in boiling water for 3 minutes, then drain.",
            "Bring a fresh pan of water to the boil, lower in the eggs and cook for 6–7 minutes for a runny yolk.",
            "Meanwhile heat a griddle or frying pan. Coat the asparagus in the oil, season with the cumin or paprika, salt and pepper, and cook for 3–4 minutes, turning, until tender.",
            "Put the eggs in egg cups and dip the asparagus into the yolks."])
sel("sc11688", "spinach-mushroom-shakshuka", "Spinach and mushroom shakshuka", "breakfast", extra=["main"],
    ing={"coconut oil": ("oil (olive or coconut)", 1, "tbsp"),
         "leaf spinach": ("spinach", 450, "g")},
    method=["Warm the oil in a large pan over medium heat. Soften the onion and garlic for 2–3 minutes.",
            "Add the mushrooms, cook for 3–4 minutes more and season with salt and pepper.",
            "Add the spinach a handful at a time, with the lid on, so each batch wilts before the next. Stir and check the seasoning.",
            "Make 4 hollows in the spinach and crack an egg into each. Cover and cook for 5–6 minutes, until the whites are set.",
            "Scatter with the parsley."])
sel("sc11439", "sweet-potato-egg-hash", "Sweet potato and egg hash", "breakfast",
    ing={"1/2 cup egg whites": ("egg whites", 4, ""),
         "Season with salt, pepper, garlic powder and paprika": None},
    add=[("garlic powder", 0, TT, "tins-dry"), ("paprika", 0, TT, "tins-dry"), ("salt and pepper", 0, TT, "tins-dry")],
    method=["Peel the sweet potato and cut it into small cubes (about 2 cm). Boil with the lid on for 6 minutes, then drain well.",
            "Heat the oil in a hot pan. Add the sweet potato, onion, red pepper, paprika, garlic powder, salt and pepper and stir-fry for 2 minutes.",
            "Push the vegetables apart to make two gaps and crack a whole egg into each, then pour the egg whites over. Cover and cook for 1–2 minutes, until the eggs are set."])
sel("sc10979", "pepper-goats-cheese-frittata", "Red pepper and goat's cheese frittata", "breakfast", extra=["main"],
    ing={"fresh oregano": ("fresh oregano, chopped (or 2 tsp dried)", 2, "tbsp"),
         "scallions": ("spring onions", 100, "g")},
    method=["Heat the grill, with a shelf in the top third of the oven.",
            "Beat the eggs in a bowl with the oregano, salt and pepper.",
            "Warm the oil over medium heat in a large non-stick frying pan that can go under the grill. Add the pepper and spring onions and stir for about 1 minute, until the onions just soften.",
            "Pour in the eggs. As they set, lift the edges so raw egg runs underneath. Cook for 2–3 minutes, until the base is lightly golden.",
            "Scatter the goat's cheese on top and put the pan under the grill for 2–3 minutes, until puffed and golden.",
            "Rest for 3 minutes. Eat hot or cold."])
sel("sc12871", "mango-cottage-cheese-bowl", "Mango, cottage cheese and yoghurt bowl", "breakfast", extra=["snack"],
    ing={"honey to taste": ("honey", 1, "tsp"), "vanilla extract": ("vanilla extract", 0, TT)})
sel("sc11690", "berry-walnut-yoghurt", "Berry and walnut yoghurt bowl", "breakfast", extra=["snack"],
    ing={"skyr": ("plain Greek yoghurt (fat-free) or skyr", 300, "g")},
    method=["Cut the strawberries into bite-sized pieces.",
            "Put the yoghurt in a bowl, add the berries and honey and stir.",
            "Break up the walnuts and scatter them on top."])
sel("sc11968", "banana-yoghurt-bowl", "Banana and vanilla yoghurt bowl", "breakfast", extra=["snack"],
    ing={"wheat germ": None, "Drizzle of honey": ("honey", 1, "tsp"),
         "banana thinly sliced": ("banana, ripe", 0.5, "")},
    drop_allergens=["gluten"],  # only the dropped wheat germ carried gluten
    method=["Slice the banana. Mix the yoghurt, banana and vanilla in a small bowl.",
            "Drizzle the honey on top."])
sel("sc13468", "tomato-basil-omelette", "Tomato and basil omelette", "breakfast", extra=["main"],
    ing={"basil leaves": ("fresh basil leaves", 4, ""), "cherry tomatoes": ("cherry tomatoes", 3, "")},
    method=["Beat the eggs with a fork and season lightly.",
            "Warm the oil in a small pan and fry the halved tomatoes for 2 minutes.",
            "Add the shredded basil for 20 seconds, then pour in the eggs and swirl them around with a spatula.",
            "When the omelette starts to set, loosen the edges and fold it in half. Slide onto a plate once lightly golden."])

# ---------------- Snacks ----------------
sel("sc12409", "bacon-egg-lettuce-cups", "Bacon, egg and tomato lettuce cups", "snack", extra=["main"],
    ing={"bacon medallions": ("lean back bacon", 4, "slices"), "lettuce leaves": ("large lettuce leaves", 4, ""),
         "hard-boiled eggs": ("eggs", 2, ""), "mayo": ("mayonnaise", 1, "tsp")},
    method=["Boil the eggs for 10 minutes, then cool them in cold water. Meanwhile fry the bacon in a dry non-stick pan until crisp, then let it cool.",
            "Peel the eggs and chop the eggs and bacon. Stir the diced tomato into the mayonnaise and season with salt and pepper.",
            "Lay the lettuce leaves on a plate, pile on the tomato, bacon and egg, and add a grind of black pepper."])
sel("sc11378", "trout-mango-wraps", "Smoked trout and mango lettuce wraps", "snack", extra=["main"],
    ing={"lettuce leaves": ("large lettuce leaves", 4, ""), "lemon juice": ("lemon juice (about 1 lemon)", 2, "tbsp")},
    method=["Lay the lettuce leaves flat and share the trout and mango between them.",
            "Scatter over the spring onion and spoon over the lemon juice.",
            "Roll each leaf up, tucking in the sides, and put them seam side down on a plate."])
sel("sc13777", "tuna-avocado-mix", "Tuna and avocado mix", "snack", extra=["main"],
    ing={"hard-boiled egg": ("egg", 1, ""), "red onion": ("red onion, small", 1, ""),
         "Greek yogurt": ("plain Greek yoghurt (fat-free)", 2, "tbsp")},
    method=["Boil the egg for 10 minutes, cool it in cold water, then peel and dice it.",
            "Put the drained tuna in a bowl with the diced avocado, onion, grated carrot, egg, yoghurt, mustard and lemon juice.",
            "Season with salt and pepper and stir together. Eat on its own or with salad leaves."])
sel("sc10842", "chicken-courgette-bites", "Chicken and courgette bites", "snack", extra=["main"], servings=6,
    ing={"zucchini": ("courgettes, grated", 2, "")},
    method=["Heat the oven or air fryer to 180°C.",
            "Put all the ingredients in a large bowl and mix well with your hands.",
            "Wet your hands so the mix doesn't stick and roll it into 18 balls, about the size of a golf ball.",
            "Put them on a tray lined with baking paper.",
            "Bake for 12–15 minutes, until golden and cooked through with no pink inside."])
sel("sc13510", "tzatziki", "Tzatziki dip", "snack",
    ing={"olive oil": ("olive oil", 1, "tsp"), "lemon": ("lemon", 0.25, "")},
    method=["Peel and grate the garlic into a bowl.",
            "Add the yoghurt, chopped dill and oil, and squeeze in the lemon juice.",
            "Season with salt and pepper and stir until smooth."])
sel("sc12692", "boiled-eggs", "Hard-boiled eggs (air fryer)", "snack", extra=["breakfast"], servings=2,
    ing={"1 cup water": None},
    method=["Put the eggs in a small ovenproof dish that fits your air fryer, pour over 250 ml water and put the dish in the basket.",
            "Cook at 150°C for 18 minutes.",
            "Peel and eat warm, or keep in the fridge."])
sel("sc11236", "berry-spinach-smoothie", "Berry and spinach smoothie", "snack", extra=["breakfast"],
    ing={"strawberry (frozen)": ("frozen strawberries", 75, "g", "freezer"),
         "raspberries (frozen)": ("frozen raspberries", 60, "g", "freezer"),
         "vanilla Greek yogurt": ("vanilla Greek yoghurt (fat-free)", 120, "g"),
         "orange juice": ("orange juice", 125, "ml")},
    method=["Put the spinach, berries, yoghurt and orange juice in a blender.",
            "Blend until smooth."])
sel("sc10871", "berry-banana-smoothie", "Berry and banana yoghurt smoothie", "snack", extra=["breakfast"],
    ing={"3/4 cups of water": None,
         "blueberries, raspberries and strawberries": ("mixed berries (frozen is fine)", 220, "g", "freezer")},
    method=["Put the yoghurt, banana, berries and 180 ml water in a blender.",
            "Blend until smooth and pour into a glass."])

# ---------------- Mains: batch cook (keep 3+ days in the fridge) ----------------
sel("sc13284", "beef-veg-soup", "Chunky beef and vegetable soup", "main",
    ing={"chopped tomatoes": ("tinned chopped tomatoes", 4, "tins (400 g)"),
         "salt.": ("salt", 1.5, "tsp"), "1-½ tsp. salt": ("salt", 1.5, "tsp"),
         "green cabbage": ("green cabbage", 0.5, ""), "beef stock": ("beef stock", 960, "ml")},
    method=["Heat a large pot over medium heat and fry the mince, stirring, for 5–7 minutes until browned. Add the salt.",
            "Add the carrots, celery and onion and cook for 5 minutes more.",
            "Pour in the stock and tomatoes, add the cabbage and bay leaves, cover and simmer for 30–40 minutes, until the vegetables are tender.",
            "Take out the bay leaves before serving."])
sel("sc10896", "chicken-tomato-curry", "Mild chicken and tomato curry", "main",
    ing={"curry powder": ("mild curry powder", 1.5, "tbsp")},
    method=["Melt the ghee in a frying pan over medium heat.",
            "Add the chicken mince and fry, breaking it up, until browned.",
            "Stir in the fish sauce, curry powder and pepper and cook for 2 minutes.",
            "Add the tomatoes and simmer for about 10 minutes, until the tomatoes are soft and the chicken is cooked through with no pink left."])
sel("sc10997", "butternut-cottage-pie", "Butternut cottage pie", "main",
    add=[("ground cinnamon", 0, TT, "tins-dry")],
    method=["Heat the oven to 180°C.",
            "Boil or steam the butternut until soft. Season with salt, pepper and a little cinnamon, then mash or blend with a splash of water.",
            "Spray a non-stick pan with cooking spray and brown the mince.",
            "Add the mushrooms, season, and cook until the mince is cooked through and the mushrooms are soft.",
            "Stir in the tomato and onion mix and the peas.",
            "Spoon the mince into a sprayed ovenproof dish and spread the butternut mash on top.",
            "Bake for 10–15 minutes, until the top is golden."])
sel("sc10752", "beef-stuffed-peppers", "Beef-stuffed peppers", "main",
    ing={"Large Peppers": ("large peppers (any colour)", 2, ""), "Reduced Fat Cheese": ("grated cheese (reduced-fat)", 20, "g")},
    method=["Heat the oven (or air fryer) to 180°C.",
            "Cut a lid off the top of each pepper and pull out the seeds.",
            "Cook the peppers in boiling water for 5–7 minutes to soften a little, then lift out.",
            "Spray a non-stick pan with cooking spray. Fry the onion, garlic and mince, seasoned, until the mince is browned.",
            "Stir in the tomato and onion mix and let it simmer.",
            "Blend or grate the cauliflower until it looks like rice. Stir it into the mince and cook for a few minutes, then take off the heat.",
            "Stand the peppers on a baking tray, fill them to the top with the mince and scatter over the cheese.",
            "Bake for 12–15 minutes."])
sel("sc10104", "honey-soy-chicken-rice", "Honey soy chicken with rice", "main",
    ing={"chicken thighs": ("chicken thighs, skinless (bone in)", 8, ""), "fresh garlic": ("garlic cloves, chopped", 3, ""),
         "dark soy sauce": ("soy sauce", 3, "tbsp"), "160g rice": ("white rice", 160, "g")},
    method=["Heat the oven to 180°C (fan).",
            "Whisk the soy sauce, honey, oil, garlic and ginger in a bowl and season with salt and pepper.",
            "Put the chicken in an ovenproof dish, pour over the sauce and turn to coat. Lay them smooth side down, cover with foil and roast for 20 minutes.",
            "Turn the chicken over, scatter with the sesame seeds and roast uncovered for 25 minutes more, until browned and cooked through.",
            "Cook the rice as the packet says while the chicken roasts. Serve with the pan juices spooned over."])
sel("sc12353", "beef-tomato-macaroni", "Beef and tomato macaroni", "main",
    ing={"Season with salt, pepper, garlic powder and paprika": None, "1 cup water": None,
         "dry macaroni": ("macaroni (dry)", 85, "g")},
    add=[("garlic powder", 0, TT, "tins-dry"), ("paprika", 0, TT, "tins-dry"), ("salt and pepper", 0, TT, "tins-dry")],
    method=["Warm the oil in a hot pan and soften the onion for 2–3 minutes.",
            "Add the mince with the salt, pepper, garlic powder and paprika and fry for 6–8 minutes, until browned.",
            "Pour in the tomatoes and 250 ml water and add the macaroni. Stir and bring to the boil, then cover, turn the heat to low and simmer for 20 minutes, until the pasta is soft."])
sel("sc11405", "turkey-stuffed-peppers", "Turkey-stuffed peppers", "main",
    ing={"bell peppers": ("peppers, halved and seeded", 3, "", "fruit-veg"), "ground turkey": ("turkey mince (or chicken mince)", 225, "g"),
         "cheddar": ("cheddar, grated", 130, "g")},
    add=[("salt and pepper", 0, TT, "tins-dry")],
    method=["Heat the oven to 180°C. Brown the mince in a frying pan over low heat, then add the mushrooms and cook until soft. Season with salt and pepper.",
            "Fill the pepper halves with the mince and scatter the cheddar on top.",
            "Cover with foil and bake for 15 minutes, until the peppers are tender but still hold their shape."])
sel("sc12808", "chicken-veg-traybake", "Chicken and vegetable traybake", "main",
    ing={"broccoli": ("broccoli", 100, "g", "fruit-veg"), "thyme": ("fresh thyme", 3, "sprigs"),
         "red onion": ("red onion, small", 0.5, "")},
    method=["Heat the oven to 200°C. Cut the sweet potato into 3 cm cubes, break the broccoli into florets, cut the onion into 4 wedges and chop the courgette into bite-sized pieces. Put it all in a large baking tray with the whole garlic cloves.",
            "Tuck the chicken among the vegetables. Drizzle with the oil, add the thyme and season with salt and pepper.",
            "Roast for 40–45 minutes, turning the vegetables halfway, until the chicken is cooked through and the vegetables are soft."])
sel("sc10224", "chicken-fried-rice", "Chicken fried rice", "main",
    ing={"uncooked white or brown rice": ("rice (dry)", 100, "g"), "coconut oil": ("oil (coconut or sunflower)", 2, "tsp")},
    method=["Cook the rice as the packet says, or use 200 g ready-cooked rice.",
            "Heat 1 tsp of the oil in a large pan or wok and soften the pepper and onion for 8–10 minutes.",
            "Cut the chicken into small pieces and add with the peas; cook for 2–3 minutes. Crack in the egg and stir all the time for 30 seconds to 1 minute, until scrambled.",
            "Add the spring onions, the rest of the oil, the soy sauce, salt, pepper and the rice. Mix well, cover and cook for 5 minutes more, until the chicken is cooked through.",
            "To keep, cool quickly and split between 2 airtight containers in the fridge."])
sel("sc12456", "roast-chicken-thighs-veg", "Roast chicken thighs and vegetables", "main",
    ing={"garlic powder": ("garlic powder", 0.5, "tsp"), "dry rosemary": ("dried rosemary", 1, "tsp"),
         "dry basil": ("dried basil", 1, "tsp"), "5 g oil": ("oil", 1, "tsp"),
         "1 medium onion or 50 g": ("onion", 50, "g"), "1 carrot or 100 g": ("carrot", 1, ""),
         "1 red bell pepper or 150 g": ("red pepper", 1, "")},
    method=["Heat the oven to 200°C.",
            "Cut the chicken and all the vegetables into bite-sized pieces.",
            "Put them in a baking dish, drizzle with the oil, add the garlic powder, rosemary, basil, salt and pepper and toss well.",
            "Roast for 25–30 minutes, until the chicken is cooked through."])
sel("sc10689", "turkey-broccoli-quinoa", "Turkey and broccoli stir-fry with quinoa", "main",
    ing={"200 ml Water": None, "Bouillon": ("stock powder (or ½ stock cube)", 1, "tsp"),
         "Tamari": ("soy sauce", 2, "tsp"), "Quinoa cooked": ("cooked quinoa", 180, "g"),
         "Turkey Mince": ("turkey mince (or chicken mince)", 400, "g"), "Broccoli": ("broccoli", 1, "head")},
    method=["Cook the mince in the oil in a wok or non-stick pan over medium heat until no pink is left. Pour off any fat.",
            "Add the broccoli florets and cook for 5 minutes.",
            "Stir in the garlic and ginger for 30 seconds.",
            "Add 200 ml water, the stock powder and soy sauce and simmer for 10 minutes.",
            "Add the quinoa, turn the heat up and stir for about 2 minutes, until hot all the way through."])
sel("sc10468", "turkey-steaks-mustard", "Turkey steaks with potatoes, leeks and mustard sauce", "main",
    ing={"turkey breast steaks": ("turkey breast steaks (or chicken breast fillets)", 2, ""),
         "skimmed milk": ("skimmed milk", 150, "ml")},
    method=["Halve the potatoes and thinly slice the leeks. Boil the potatoes for 15 minutes, until tender, adding the leeks for the last 3–5 minutes (or steam them on top).",
            "Meanwhile heat the oil in a frying pan over medium heat and fry the turkey for 3–4 minutes, turning once, until golden and cooked through.",
            "Melt the margarine in a small pan over medium-low heat. Whisk in the flour for 1–2 minutes, then slowly whisk in the milk until smooth. Simmer gently for 5 minutes until thick, then stir in the mustard and season.",
            "Serve the vegetables and turkey with the sauce spooned over. To prep ahead, pack the vegetables and turkey in 2 containers and the sauce in 2 small pots."])

# ---------------- Mains: cook fresh ----------------
sel("sc13436", "lemon-herb-fish", "Lemon and herb baked fish", "main",
    ing={"fish fillets": ("white fish fillets, hake or cod (about 140 g each)", 4, ""),
         "dill weed": ("dried dill", 1, "tsp", "tins-dry"),
         "salt-free all-purpose seasoning": ("all-purpose seasoning (salt-free)", 1, "tsp", "tins-dry"),
         "parsley flakes": ("dried parsley", 1.5, "tsp", "tins-dry")},
    method=["Heat the oven to 180°C and lightly spray a baking dish.",
            "Lay the fish in the dish in one layer and squeeze over the juice of half the lemon.",
            "Scatter over the parsley, dill, basil and seasoning. Cut the other lemon half into 4 thin slices and put one on each fillet.",
            "Cover with foil and bake for 10–15 minutes, until the fish flakes easily with a fork. Check thin fillets early so they don't dry out."])
sel("sc13703", "balsamic-chicken", "Balsamic chicken", "main",
    ing={"parsley sprig": None, "cherry tomatoes": None,
         "chicken breast halves": ("chicken breast fillets", 4, ""),
         "lemon-pepper seasoning": ("lemon pepper seasoning", 2, "tsp", "tins-dry")},
    method=["Put the chicken in a plastic bag and flatten it to about 5 mm with a rolling pin.",
            "Season both sides with the lemon pepper and press it in.",
            "Heat the oil in a large frying pan over medium heat. Cook the chicken for about 7 minutes, turning once, until cooked through.",
            "Move the chicken to a warm plate. Mix the vinegar, stock and garlic and pour into the pan. Let it bubble over medium-high heat for 2–4 minutes, scraping up the browned bits, until thick and syrupy.",
            "Stir in the butter until melted and spoon the sauce over the chicken."])
sel("sc10346", "chicken-fennel-courgette", "Chicken with fennel and courgette", "main",
    ing={"zucchini": ("courgettes", 3, ""), "chicken breasts": ("chicken breast fillets", 4, ""),
         "leek": ("leek (white part)", 1, "")},
    method=["Heat the oil in a large pan over high heat.",
            "Add the chicken strips and stir for 1–2 minutes until browned. Lift the chicken and juices into a bowl.",
            "Fry the fennel, leek and courgette in the same pan for 5 minutes.",
            "Put the chicken back, add the stock, salt and pepper, cover and simmer for 5 minutes, until the chicken is cooked through.",
            "Take off the heat and stir in the olives and dill."])
sel("sc10831", "fish-tomato-olives", "Baked white fish with tomatoes, olives and capers", "main",
    ing={"sea bass fillets": ("white fish fillets, hake or cod (about 140 g each)", 4, ""), "Kalamata olives": ("olives, pitted and chopped", 70, "g")},
    method=["Heat the oven to 190°C.",
            "Pour the oil into a baking dish and turn the fish in it to coat both sides.",
            "Scatter the onion, tomatoes, olives, capers and spinach over the fish, pour in the stock and season with the salt and pepper.",
            "Cover with foil and bake for 15 minutes, until the fish is white all the way through."])
sel("sc11789", "lemon-dill-salmon", "Lemon and dill salmon", "main",
    ing={"salmon fillets": ("salmon fillets (about 170 g each)", 4, ""), "lemon slices": ("lemon", 1, ""),
         "dill sprigs": ("fresh dill", 8, "sprigs")},
    method=["Heat the oven to 220°C. Line a baking tray with foil.",
            "Put the salmon on the tray, season with the salt and pepper, and top each fillet with 2 dill sprigs and 2 half slices of lemon.",
            "Roast for 15–20 minutes, until the salmon flakes easily with a fork."])
sel("sc12480", "air-fryer-greek-chicken", "Air-fryer Greek chicken and vegetables", "main",
    ing={"zucchini": ("courgette", 0.5, ""), "coconut oil": ("oil (coconut or olive)", 1, "tbsp"),
         "chicken breast": ("chicken breast fillet", 1, "")},
    method=["Cut the chicken into 2–3 cm cubes. In a large bowl, toss the chicken, courgette, pepper and onion with the oil, oregano, garlic powder and thyme.",
            "Tip into the air fryer basket and cook at 190°C for 15 minutes, shaking the basket halfway, until the chicken is cooked through."])
sel("sc11530", "hake-and-chips", "Hake and chips", "main",
    ing={"hake fillet": ("hake fillet (or other white fish)", 150, "g"), "flour (oat or cake)": ("plain flour", 10, "g"),
         "veg & potato seasoning": ("potato seasoning (or mixed dried herbs)", 0.5, "tsp"),
         "olive oil spray": ("cooking spray", 0, TT), "Lemon wedge": ("lemon", 0.25, ""),
         "Salt & pepper": ("salt and pepper", 0, TT), "200g white potato": ("potato", 200, "g"), "Salt": None},
    method=["Heat the oven or air fryer to 200°C.",
            "Cut the potato into chips. Spray with cooking spray, add salt and the potato seasoning and toss.",
            "Cook the chips for 15 minutes, shaking halfway.",
            "Mix the flour, garlic powder, paprika, salt and pepper in a shallow dish.",
            "Pat the fish dry with kitchen paper and press it into the flour to coat both sides.",
            "Spray a non-stick pan with a little cooking spray and heat over medium heat.",
            "Cook the fish for 3–4 minutes each side, until golden outside and flaking inside.",
            "Serve with the chips and a lemon wedge."])
sel("sc11145", "paprika-beef-lettuce-cups", "Paprika beef lettuce cups", "main",
    ing={"pepper, diced": ("pepper (any colour)", 1, ""), "Romanian lettuce": ("cos lettuce leaves", 8, ""),
         "parsley": ("fresh parsley", 1, "handful")},
    method=["Brown the mince in a non-stick pan with no oil until cooked through. Season with the paprika, salt and pepper, stir in the spring onions and set aside.",
            "Mix the tomatoes, pepper, avocado, parsley and lemon juice in a bowl and season lightly.",
            "Spoon the beef and the avocado mix into the lettuce leaves."])
sel("sc12284", "chicken-asparagus-stir-fry", "Chicken and asparagus stir-fry", "main", servings=3,
    ing={"skinless chicken": ("chicken breast fillets", 680, "g"), "grape seed oil": ("cooking oil", 1, "tbsp"),
         "asparagus": ("asparagus", 250, "g")},
    method=["Cut the chicken into strips and season with salt. Mix the soy sauce and stock in a small bowl.",
            "Fry the asparagus in the oil in a non-stick pan over medium heat for 3–5 minutes, until tender. Lift out.",
            "Cook the chicken in the same pan until cooked through with no pink left. Lift out.",
            "Pour the soy mix, lemon juice, garlic and ginger into the pan and bring to the boil. Put the chicken and asparagus back and toss to coat."])
sel("sc11591", "beef-avocado-burrito", "Beef and avocado burrito", "main",
    ing={"tortilla wrap": ("tortilla wrap (medium)", 1, ""), "extra lean beef mince": ("lean beef mince", 150, "g"),
         "Lettuce": ("shredded lettuce", 1, "handful")},
    method=["Spray a non-stick pan with cooking spray and heat it.",
            "Add the mince, season well and brown for 8–10 minutes, until cooked through.",
            "Stir in the tomato and onion mix, cook for 5 minutes more, then take off the heat.",
            "Mash the avocado with a fork and season.",
            "Warm the wrap and spread the avocado over it. Add the lettuce, then the mince, and roll up tightly."])
sel("sc12600", "salmon-quinoa-salad", "Warm salmon and quinoa salad", "main",
    ing={"1 litre of boiling water": None, "spices for salmon": ("fish spice (or paprika)", 1, "tsp", "tins-dry"),
         "salmon fillets": ("salmon fillets (about 100 g each)", 4, ""), "cooked quinoa": ("cooked quinoa", 250, "g"),
         "parsley": ("fresh parsley", 2, "handfuls")},
    method=["Heat the oven to 200°C.",
            "Slice the pepper into strips and stir-fry in the oil in a pan over medium heat for 5 minutes.",
            "Put the salmon on a tray lined with baking paper, sprinkle with the spice and roast for 10 minutes.",
            "Put the sugar snaps in a colander and pour a full kettle of boiling water over them. Add them and the quinoa to the peppers and warm through for 4 minutes.",
            "Chop the parsley and chives, stir them into the quinoa and serve with the salmon."])
sel("sc13507", "red-pepper-chicken-pasta", "Creamy red pepper chicken pasta", "main",
    ing={"Season with salt, pepper, paprika and garlic powder": None, "Season with salt": None,
         "pasta (for example": ("wholewheat pasta (dry)", 85, "g"),
         "low fat cheese": ("mozzarella, grated (reduced-fat)", 25, "g"),
         "chicken breast": ("chicken breast fillets", 2, ""),
         "1/2 tsp olive oil": None, "1 tsp olive oil": ("olive oil", 1.5, "tsp")},
    add=[("paprika", 0, TT, "tins-dry"), ("garlic powder", 0, TT, "tins-dry"), ("salt and pepper", 0, TT, "tins-dry")],
    method=["Cook the pasta in a pot of salted boiling water for 7 minutes. Keep 60 ml of the cooking water, then drain.",
            "Heat a little oil in a pan and soften the pepper, onion and garlic for 3–4 minutes. Blend them with the cheese and the saved pasta water until smooth.",
            "Rub the chicken with the rest of the oil, the paprika, garlic powder, salt and pepper. Cook covered in a hot pan for about 6 minutes each side, until cooked through, then dice.",
            "Put the pasta back in the pot with the sauce and chicken and toss together."])
sel("sc12764", "hake-potato-salad", "Hake with potato salad", "main",
    ing={"Fish Spice": ("fish spice", 1, "tsp", "tins-dry"), "Salad Onions": ("spring onions", 2, ""),
         "Lite Mayo": ("light mayonnaise", 20, "g"), "Hake Fillet": ("hake fillet (or other white fish)", 200, "g"),
         "White Potato": ("potato, large", 1, "")},
    method=["Peel the potato and boil or steam it until soft all the way through.",
            "Cut it into cubes and mix with the gherkins and spring onions. Season, stir in the mayonnaise and set aside.",
            "Spray a non-stick pan with cooking spray and heat it.",
            "Put the fish in skin side down and season with the fish spice.",
            "Turn it over and cook until the fish is white and flakes all the way through.",
            "Serve the fish with a squeeze of lemon and the potato salad."])

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
            if f.name.startswith(("cook_held", "food_match_held"))}
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
                continue  # dropped line (water, garnish, split seasoning, wheat germ)
            for flag, al in ITEM_FLAGS.items():
                if item.get(flag) == "1":
                    allergens.add(al)
            name, qty, unit = convert_line(l, item, N.get(l["item_id"], ""))
            area = None
            if ov:
                name, qty, unit = ov[0], ov[1], ov[2]
                area = ov[3] if len(ov) > 3 else None
            area = area or area_for(item, item.get("group_id", ""), name)
            ings.append({"name": clean_name(name), "qty": qty, "unit": unit, "area": area})
        for a in s.get("add", []):
            ings.append({"name": a[0], "qty": a[1], "unit": a[2], "area": a[3]})
        for a in s.get("drop_allergens", []):
            allergens.discard(a)
        src_serv = float(r["servings"])
        serv = s.get("servings", src_serv)
        f = src_serv / serv
        meal_types = [s["meal"]] + [m for m in s.get("extra", []) if m != s["meal"]]
        method = s.get("method") or [re.sub(r"^\d+\.\s*", "", x).strip() for x in r["method_text"].splitlines() if x.strip()]
        method = [re.sub(r"yogurt", "yoghurt", m) for m in method]
        out.append({
            "id": "rec-" + s["slug"], "name": s["name"], "mealTypes": meal_types,
            "minutes": int(float(r["total_time_min"])), "servings": int(serv),
            "kcal": int(round(float(r["calories"]) * f)), "protein": int(round(float(r["protein"]) * f)),
            "allergens": [a for a in ORDER if a in allergens],
            "batch": r["batch_cook"] == "Great for batch",
            "ingredients": ings, "method": method,
        })
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(out)} recipes to {OUT}")


if __name__ == "__main__":
    main()
