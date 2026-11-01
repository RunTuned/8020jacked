# Routes (App Router). Each screen builder owns its folders.

| Area | Routes | Wireframe IDs | Owner |
|---|---|---|---|
| Start, setup, install, account (test), free week preview | `/` (redirects to `/today` if set up, else `/start`), `/start`, `/start/[step]` (about, goal, ready, time, home, food, plan), `/start/save`, `/start/install`, `/start/shared-phone`, `/start/reminders`, `/start/free-week`, `/start/under-18`, `/start/browser`, `/start/back` (I've used it before: import file) | A1–A15c, A3b, A14w, A9 (`/plan-updated`) | Builder 1 |
| You (settings) | `/you`, `/you/[section]` (goal, body, home, food, reminders, display, subscription, data) | S1–S9, S8 states | Builder 1 |
| Today | `/today`, `/today/week` (T2), `/today/weigh-in` (T3), `/today/welcome-back` (T4), `/today/away` (T6) | T1–T8 | Builder 2 |
| Food | `/food`, `/food/meal/[date]/[slot]` (F2/F2b), `/food/swap/[date]/[slot]` (F3), `/food/list` (F4), `/food/cook` (F5), `/food/other` (F6/F7), `/food/pickup` (F8) | F1–F8 | Builder 2 |
| Train | `/train`, `/train/workout` (W2–W7, W3b, W3c, W3d as states of one flow), `/train/move/[id]` (W6), `/train/skills` (W8), `/train/history`, `/train/history/[id]` (W9/W10), `/train/set-aside` (W11) | W1–W11 | Builder 3 |
| Progress | `/progress` (P1 with in-place views), `/progress/weight` (P2), `/progress/photos` (P3), `/progress/check-ins` (P4), `/progress/wins` (P5) | P1–P5 | Builder 4 |
| Check-in | `/check-in` (C1–C5 steps, C1b, C2b, C8), `/check-in/history/[week]` (C5), `/check-in/done` (C6/C7 at the end of a 12-week block) | C1–C8 | Builder 4 |

## Shared rules
- **Data access:** wait for the store to load, using `useAppStore.persist.hasHydrated()`. Until then, show a skeleton in the bento shape.
- **Tabs:**
  - The tab bar appears on `/today`, `/train`, `/food` and `/progress`.
  - The "You" circle appears on Today and Progress.
  - The other screens have a Back circle that goes where the wireframe `.to` says.
- **Flows:** a flow such as setup, the workout or the check-in should be one route with steps held in state. Mirror the step in `?step=` so a reload resumes where she was.
- **Ownership:** don't edit another builder's folder. Shared UI lives in `src/components/ui`; ask the lead before changing it. Add new shared pieces in `src/components/<area>/`.
