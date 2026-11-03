// QA fix round (Start, PWA, progress, settings). Each block guards one item from the QA list.
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("idb-keyval", () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined }));

import { CONTENT } from "../../engine/__tests__/fixtures";
import { inAppCopy } from "../../../components/start/copy";
import { installFirst } from "../../device";
import {
  WEIGH_IN_ADVICE,
  appState,
  initialState,
  resetRepeatGuard,
  resolveHeightCm,
  resolveWeightKg,
  selectGoalNote,
  selectGoalOptions,
  selectProgress,
  selectStrength,
  selectWeightCard,
  selectWinItems,
  setClock,
  setContent,
  useAppStore,
} from "..";

let t = 0;
const at = (date: string, h = 12) => {
  const [y, m, d] = date.split("-").map(Number);
  t = new Date(y, m - 1, d, h, 0).getTime();
};
const A = () => useAppStore.getState();

function onboard(kg = 75, heightCm = 165) {
  A().saveAbout({ age: 40, heightCm, setupWeightKg: kg, noWeigh: false });
  A().saveGoal("steady", true);
  A().saveTime({ minutes: 15, daysPerWeek: 3 });
  A().saveEquipment(["floor"]);
  A().saveFoodSetup({ mealsPerDay: 3, cookOrBuy: "cook", allergies: [] });
  A().createPlan();
}

beforeEach(() => {
  setContent(CONTENT);
  setClock(() => t);
  at("2026-11-02");
  resetRepeatGuard();
  useAppStore.setState({ ...initialState(), ui: { undo: null, pendingGoal: null, lastCheckIn: null } });
});

describe("16: changing units never changes stored values", () => {
  it("keeps the stored kg when the shown number wasn't changed", () => {
    // 75 kg shows as 165 lb; 165 lb on its own would be 74.8 kg.
    expect(resolveWeightKg("165", "lb", 75)).toBe(75);
    expect(resolveWeightKg("75", "kg", 75)).toBe(75);
    expect(resolveWeightKg("75.0", "kg", 75)).toBe(75);
  });
  it("uses the typed number once she changes it", () => {
    expect(resolveWeightKg("160", "lb", 75)).toBe(72.6);
    expect(resolveWeightKg("74", "kg", 75)).toBe(74);
    expect(resolveWeightKg("", "kg", 75)).toBeNull();
  });
  it("keeps the stored cm across a ft/in round trip", () => {
    // 167 cm shows as 5 ft 6 in; 5 ft 6 in on its own is 168 cm.
    expect(resolveHeightCm({ unit: "ftin", cm: "", ft: "5", inch: "6" }, 167)).toBe(167);
    expect(resolveHeightCm({ unit: "cm", cm: "167", ft: "", inch: "" }, 167)).toBe(167);
    expect(resolveHeightCm({ unit: "ftin", cm: "", ft: "5", inch: "7" }, 167)).toBe(170);
    expect(resolveHeightCm({ unit: "cm", cm: "165", ft: "", inch: "" }, null)).toBe(165);
  });
  it("saving units alone leaves body numbers and weigh-ins as they were", () => {
    onboard(75, 167);
    A().saveUnits({ weight: "lb", height: "ftin" });
    A().saveUnits({ weight: "kg", height: "cm" });
    expect(appState().profile.setupWeightKg).toBe(75);
    expect(appState().profile.heightCm).toBe(167);
  });
});

describe("13: one weigh-in message everywhere", () => {
  it("is the agreed sentence", () => {
    expect(WEIGH_IN_ADVICE).toBe("Weigh in on 3 different days a week for the best picture. Fewer is fine.");
  });
  it("no screen has its own weigh-in frequency wording", () => {
    const root = path.resolve(__dirname, "../../..");
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, f.name);
        if (f.isDirectory()) {
          if (f.name !== "__tests__") walk(p);
        } else if (/\.(tsx?|ts)$/.test(f.name)) files.push(p);
      }
    };
    walk(path.join(root, "components"));
    walk(path.join(root, "app"));
    walk(path.join(root, "lib/store"));
    const odd = files.filter((f) =>
      /(a week is plenty|Once a week is plenty|Weigh in when it suits you|Weigh in on 3 different days for)/.test(fs.readFileSync(f, "utf8")),
    );
    expect(odd).toEqual([]);
  });
  it("the weight card with no weigh-ins uses it", () => {
    onboard();
    expect(selectWeightCard(appState()).detail).toBe(WEIGH_IN_ADVICE);
  });
});

describe("15: Progress on day 1", () => {
  it("never says 0 good weeks, and hides zero counts", () => {
    onboard();
    useAppStore.setState({
      workouts: [
        {
          id: "w1",
          creatorId: "8020jacked",
          date: "2026-11-02",
          letter: "A",
          minutes: 15,
          status: "done",
          sets: [],
          moveEffort: {},
          bigScreen: false,
          taster: false,
          startedAt: t,
          endedAt: t,
        },
      ],
    });
    const w = selectWinItems(appState());
    const text = JSON.stringify(w);
    expect(text).not.toMatch(/\b0 good weeks?\b/);
    expect(text).not.toMatch(/\b0 \w+/);
  });
  it("the weight subtitle shows on the Weight view only", () => {
    onboard();
    const s = appState();
    expect(selectProgress(s, "wins").subline).toBeNull();
    expect(selectProgress(s, "strength").subline).toBeNull();
    expect(selectProgress(s, "weight").subline).toMatch(/average weight/);
  });
});

describe("9: no links to cut screens", () => {
  it("wins and strength never point at /train/skills or /train/history", () => {
    onboard();
    const items = JSON.stringify([selectWinItems(appState()), selectStrength(appState())]);
    expect(items).not.toMatch(/\/train\/(skills|history)/);
  });
});

describe("BMI under 20: goal screen explains the missing option", () => {
  it("adds one line when Lose some weight is hidden", () => {
    A().saveAbout({ age: 40, heightCm: 170, setupWeightKg: 55, noWeigh: false }); // BMI 19
    expect(selectGoalOptions(appState())).not.toContain("lose");
    expect(selectGoalNote(appState())).toBe(
      "Lose some weight isn't offered at your current weight. Keep steady or get stronger instead.",
    );
  });
  it("says nothing when it is offered", () => {
    A().saveAbout({ age: 40, heightCm: 165, setupWeightKg: 75, noWeigh: false });
    expect(selectGoalOptions(appState())).toContain("lose");
    expect(selectGoalNote(appState())).toBeNull();
  });
});

describe("18: in-app browser wording per platform", () => {
  it("iPhone says Safari, Android says Chrome, and nothing repeats", () => {
    const ios = inAppCopy("ios");
    const android = inAppCopy("android");
    expect(JSON.stringify(ios)).toMatch(/Safari/);
    expect(JSON.stringify(ios)).not.toMatch(/Chrome|browser now/);
    expect(JSON.stringify(android)).toMatch(/Chrome/);
    expect(JSON.stringify(android)).not.toMatch(/Safari/);
    for (const [i, c] of [ios, android, inAppCopy(null)].entries()) {
      const lines = [c.steps, ...c.lines];
      expect(new Set(lines.map((l) => l.toLowerCase())).size).toBe(lines.length);
      // "Open in Safari" appears once, never twice in different words.
      const opens = lines.join(" ").match(/open (it )?in (safari|chrome)/gi) ?? [];
      expect(opens.length).toBeLessThanOrEqual(i === 2 ? 2 : 1);
    }
  });
});

describe("iPhone install-first", () => {
  it("iPhone Safari, not installed: install first", () => {
    expect(installFirst({ plat: "ios", standalone: false, inApp: null })).toBe(true);
  });
  it("skips it once installed, on Android, in an in-app browser, or before the device is known", () => {
    expect(installFirst({ plat: "ios", standalone: true, inApp: null })).toBe(false);
    expect(installFirst({ plat: "android", standalone: false, inApp: null })).toBe(false);
    expect(installFirst({ plat: "ios", standalone: false, inApp: "whatsapp" })).toBe(false);
    expect(installFirst({ plat: null, standalone: false, inApp: null })).toBe(false);
  });
});
