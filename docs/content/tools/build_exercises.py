#!/usr/bin/env python3
"""Build src/content/exercises.json from docs/content/exercises.csv.

Kit: the app offers none / band / dumbbell (+ household chair, wall, and a pull-up bar).
Gym-machine/barbell moves and kettlebell moves have no kit option in the app, so they are left out
(listed in docs/content/README.md); swaps that pointed at them are removed.
Positions: hanging -> standing, bench/chair -> seated, head_down/incline -> floor (conservative: the
hands or body go near the floor). noFloor = position != floor.
Cues: the library's cue text split at ';' into short cues (<= 25 words each); a few long ones are
rewritten in plain words below (safety content kept).
"""
import csv, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[3]
SRC = ROOT / "docs" / "content" / "exercises.csv"
OUT = ROOT / "src" / "content" / "exercises.json"

EXCLUDE_KITS = {"gym", "kettlebell"}
KIT = {"none": "none", "bands": "band", "dumbbells": "dumbbell", "dumbbells|bench": "dumbbell",
       "pullup_bar": "bar", "pullup_bar|bands": "bar", "pullup_bar|dumbbells": "bar"}
# no-kit moves that need a chair or a wall to do at all
CHAIR = {"EX-001", "EX-024", "EX-026", "EX-044", "EX-046", "EX-087"}
WALL = {"EX-031", "EX-038", "EX-088", "EX-091", "EX-093"}
POSITION = {"standing": "standing", "seated": "seated", "floor": "floor", "hanging": "standing",
            "bench": "seated", "chair": "seated", "head_down": "floor", "incline": "floor"}

CUES = {
    "EX-012": ["Stand on one leg with a soft knee.",
               "Push your hips back and reach toward the floor as the back leg rises.",
               "Keep your back flat. Touch a wall for balance if you need to."],
    "EX-034": ["Hands on a sturdy step or low box about 30 cm high, body straight.",
               "Lower your chest to the edge, then push away.",
               "This is lower than a chair seat, so it is harder than a knee push-up."],
    "EX-052": ["Only under a very sturdy table: lie under the edge and grip it, knees bent, heels down.",
               "Pull your chest to the table, body straight.",
               "Before every set, lean your full weight on the table edge.", "If it tips, slides or wobbles, stop and do a band row or Y-T raise instead."],
    "EX-053": ["Like the bent-knee table row, but with legs straight: body in one line.",
               "Before every set, lean your full weight on the table edge.", "If it tips, slides or wobbles, stop and do a band row or Y-T raise instead."],
    "EX-054": ["Like the straight-leg table row, with your heels on a chair.",
               "Before every set, lean your full weight on the table edge.", "If it tips, slides or wobbles, stop and do a band row or Y-T raise instead."],
    "EX-090": ["Face an open door frame and hold both sides at chest height.",
               "Feet just in front of the frame, lean back a little with straight arms.",
               "Pull your chest to the frame, then lower slowly. Step your feet back to make it easier."],
    "EX-099": ["Use a stair or sturdy step about shin height, with a wall or rail in reach.",
               "Put your whole foot on the step and push through that heel to stand tall.",
               "Step down slowly."],
    "EX-100": ["Use a sturdy step or bench about knee height, never a chair that can tip.",
               "Lean forward a little and drive through the heel on the step to stand tall.",
               "Lower slowly, without pushing off the back foot."],
    "EX-102": ["Lie on your side, head on your arm, bottom knee bent.",
               "Keep the top leg straight and in line with your body, toes forward.",
               "Lift it to just above hip height, then lower slowly."],
}


def split_cues(text):
    parts = [p.strip() for p in re.split(r";|(?<=[.])\s+", text) if p.strip()]
    out = []
    for p in parts:
        p = p.rstrip(".") + "."
        out.append(p[0].upper() + p[1:])
    return out


def main():
    rows = list(csv.DictReader(open(SRC)))
    keep = {r["exercise_id"] for r in rows if r["kit"] not in EXCLUDE_KITS}
    out, excluded = [], []
    for r in rows:
        eid = r["exercise_id"]
        if eid not in keep:
            excluded.append(f'{eid} {r["name"]} ({r["kit"]})')
            continue
        kit = KIT[r["kit"]]
        if kit == "none" and eid in CHAIR:
            kit = "chair"
        if kit == "none" and eid in WALL:
            kit = "wall"
        pos = POSITION[r["position"]]
        if eid in WALL and pos == "standing":
            pos = "wall"
        cues = CUES.get(eid) or split_cues(r["cues"])
        swaps = [s for s in r["swaps"].split("|") if s and s in keep]
        ex = {
            "id": eid, "name": r["name"], "pattern": r["pattern"], "primaryMuscle": r["primary_muscle"],
            "kit": kit, "level": r["level"], "ladder": r["ladder"], "ladderStep": int(r["ladder_step"]),
            "unit": "seconds" if r["unit"].startswith("seconds") else "reps",
            "repMin": int(r["rep_min"]), "repMax": int(r["rep_max"]),
            "position": pos, "cues": cues, "swaps": swaps, "noFloor": pos != "floor",
            # extras kept from the library because the rules depend on them
            "perSide": r["unit"].endswith("_per_side"),
            "effort": r["effort_class"],
            "maxUserKg": int(r["max_user_kg"]) if r["max_user_kg"] else None,
        }
        # 3 Nov 2026 (Jennifer): the Prone Y-T raise is a weak start for the pull slot, so the bodyweight row
        # ladder starts at the door-frame row and the Y-T raise stands alone (still usable as a swap).
        LADDER_FIX = {"EX-051": ("yt_raise", 1), "EX-090": ("row_bw", 1), "EX-052": ("row_bw", 2),
                      "EX-053": ("row_bw", 3), "EX-054": ("row_bw", 4)}
        if eid in LADDER_FIX:
            ex["ladder"], ex["ladderStep"] = LADDER_FIX[eid]
        out.append(ex)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(out)} exercises; excluded {len(excluded)}:")
    for e in excluded:
        print("  ", e)


if __name__ == "__main__":
    main()
