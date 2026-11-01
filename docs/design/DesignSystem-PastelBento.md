# Design system v2 — "Soft Pastel Bento" (APP-27, Jennifer 5 Oct 2026) — revision 2 (after CD round 3)

Replaces the LOOK of the 27 Sep design system (D-034: tokens, type, card and bar styling). Screens keep their content,
order, copy and behaviour from their approved notes in this folder unless a section below says otherwise. Source:
Jennifer's "Visual Style Brief: Soft Pastel Bento" (chat, 5 Oct 2026). Her calls: typeface Plus Jakarta Sans (bundled,
OFL, `app/app/static/fonts/`), and a dark version that follows the phone's setting.
Revision 2 answers CD round 3 (REVIEWS.md) fixes 1–12 and notes as marked [F1]…[F12], [N]; rounds 4 and 5 are answered as [R4-n] and [R5-n]; round 6: PASS.

## 0. The feeling
Calm, friendly, slightly toy-like: big rounded pastel blocks on white, heavy black type, black icon circles and a black
floating bar for weight. No gradients, no shadows, no textures, no glass. Depth comes only from colour blocks side by
side. Empty pastel space is part of the look.

## 1. Tokens — every token defined for light and dark [F9]
| Token | Light | Dark | Use |
|---|---|---|---|
| `--canvas` | #FFFFFF | #111111 | every screen's background |
| `--ink` | #111111 | #F5F5F5 | all text, icon circles |
| `--ink-muted` | #555555 | #B3B3B3 | secondary text (never on lavender) |
| `--on-ink` | #FFFFFF | #111111 | text / icons on an `--ink` fill |
| `--fill-neutral` | #F1F1F1 | #262626 | secondary pills, inputs, neutral cards |
| `--pastel-lime` | #E8F8C4 | #2E3B17 | Food |
| `--pastel-butter` | #FBF4C2 | #3D3814 | Cook day |
| `--pastel-blue` | #BFD5FB | #1E2F4F | Training |
| `--pastel-aqua` | #C0F6F4 | #163E3D | Check-in, weigh-in |
| `--pastel-pink` | #F6C3DF | #4A2238 | Progress, photos, skills |
| `--accent-lavender` | #B8A7F4 | #B8A7F4 | one accent circle (cook-mode Back); never text, never a status |
| `--on-accent` | #111111 | #111111 | icon on lavender (8.9:1) |
| `--bar` | #111111 | #262626 | the floating bar |
| `--bar-item` | #FFFFFF | #3A3A3A | inactive tab circles |
| `--on-bar-item` | #111111 | #F5F5F5 | their icons |
| `--bar-item-active` | #FFFFFF | #F5F5F5 | active tab pill (with label) |
| `--on-bar-item-active` | #111111 | #111111 | its icon + label |
| `--circle-button` | #FFFFFF | #3A3A3A | round buttons on cards (flag, chevron, swap) |
| `--on-circle-button` | #111111 | #F5F5F5 | their icons |
| `--sheet` | #FFFFFF | #1C1C1C | sheets and dialogs |
| `--scrim` | rgba(17,17,17,0.40) | rgba(0,0,0,0.60) | behind sheets |
| `--bar-item-current` | #111111 | #F5F5F5 | the active tab in compact mode (circle) [R4-2] |
| `--on-bar-item-current` | #FFFFFF | #111111 | its icon |
| `--bar-item-current-ring` | #FFFFFF | #F5F5F5 | its 2 px ring (so it differs from the other circles) |
| `--focus` | #111111 | #F5F5F5 | focus ring everywhere except inside the bar / cook capsule (incl. around ink pills on the canvas) |
| `--focus-on-bar` | #FFFFFF | #F5F5F5 | focus ring inside the bar and the cook-mode capsule (18.88 / 13.88) [R4-1] |
| `--error` | #B42318 | #F97066 | ONLY on canvas, neutral or sheet [F11] |
| `--done` | #111111 | #F5F5F5 | done ticks: a `--done` circle with an `--on-ink` tick [R4-6] |

**Old → new map [F10]** (every approved note's colour words keep working):
`--surface` → `--canvas`; `--surface-raised` → `--canvas` (cards use a fill); `--surface-sunken` → `--fill-neutral`;
`--line` / `--line-strong` → no lines (separation by space or fill), except the input / unselected-option outline
`--ink-muted`; `--beet` (primary, links, selected, progress) → `--ink` (fills) / `--on-ink` on it; `--beet-soft` →
`--fill-neutral`; `herb` / `herb-soft` → `--pastel-lime` fill + `--ink` text; `grain` → `--pastel-blue`; `stone` →
`--pastel-aqua`; the CheckInTaps progress track → `--fill-neutral` track with an `--ink` fill; storage lines ("From the
fridge / freezer") → `--ink-muted` text with a small icon (no colour); the CookDayStorage dashed lid squares → 2 px
dashed `--ink-muted` outline on `--canvas`; the session rest timer → `numeral` on `--fill-neutral`.

## 2. Contrast (WCAG AA, computed from the hex values; CD round 3 confirmed)
Light: `--ink` on every fill >= 8.88:1; `--ink-muted` >= 4.90 (pink) on every fill except lavender; on-ink 18.9.
Dark: `--ink` >= 10.76; `--ink-muted` >= 5.59. Icons: `--on-bar-item` on `--bar-item` 18.9 (light) / 10.43 (dark);
`--on-circle-button` on `--circle-button` same. `--error` only where it passes: light 6.57 on canvas, 5.82 on neutral, 6.57 on the sheet;
dark 6.78 on canvas, 5.43 on neutral, 6.12 on the sheet. The error card's message text is `--ink`; `--error` is its icon only, placed
straight on the neutral card (never inside an ink circle) [F11, R4-4]. Neutral pills on white (1.13) are identified by their label, not their edge (non-blocking N1, watched at UAT).

## 3. Type — Plus Jakarta Sans (variable 200–800), fallback `ui-rounded, system-ui, sans-serif` [F5]
All sizes in `rem` (1rem = 16 px default, so the phone's text size scales them); every line height unitless.
| Role | Size | Line height | Weight | Notes |
|---|---|---|---|---|
| `display-xl` hero | 2.25rem | 1.08 | 800 | letter-spacing -0.02em; wraps to as many lines as it needs |
| `display-l` hero | 2rem | 1.1 | 800 | same |
| `title` card title | 1.25rem | 1.2 | 700 | wraps freely; never truncated; `overflow-wrap: anywhere; hyphens: auto` [R4-9] |
| `body` | 1.0625rem (17 px) | 1.5 | 400 | A2: body 17 px |
| `body-strong` | 1.0625rem | 1.5 | 700 | |
| `body-small`, `label` | 0.9375rem (15 px) | 1.45 | 400 (label 600) | nothing tappable under 15 px |
| `numeral` | 1.75rem | 1.15 | 800 | tabular figures |
| cook-mode step text | 1.75rem | 1.25 | 700 | as the approved CookDay (28 px) [N4] |
Inputs 1.0625rem (never under 16 px, A2). Text left aligned; icons centred in their circles. Font local, `font-display:
swap`, fallback first paint. Every text block: `overflow-wrap: anywhere; hyphens: auto` (long words at 200 % text);
hero sizes are rem only, so they grow with the text size (WCAG 1.4.4): the hero is `display-l` 2rem on phones and in the
tablet column, and `display-xl` 2.25rem only when the page container is at least 37.5rem wide (container query); at
200 % text on a 344 px phone that is 64 px and wraps inside the margins [R4-9, R5-1].

## 4. Shapes, spacing, safe areas [F6]
- Side margin `max(20px, env(safe-area-inset-left/right))`, 24 px from 600 px width; top row padding
  `max(16px, env(safe-area-inset-top))` (also the cook-mode band).
- Card radius 30 px; buttons, pills and the bar fully round. No borders, dividers or shadows. Rows inside one card are
  separated by 12 px of the card's fill.
- Gaps 12 px (phones), 16 px from 600 px.
- Inputs, checkboxes and unselected options: `--fill-neutral` fill and a 2 px `--ink-muted` outline (WCAG 1.4.11: their
  edge must be seen); focused: 3 px `--focus`.
- Focus ring: 3 px `--focus`, 2 px offset, everywhere (incl. around ink pills, whose ring sits on the canvas); inside
  the bar and the cook-mode capsule `--focus-on-bar` [F3, R4-1].
- Card padding 1.25rem, 1.5rem from 600 px [R4-7]. Round icon buttons (You, Back, circle buttons) `flex-shrink: 0`.
- `scroll-padding-bottom` = the bar's measured height + 16 px + safe area, so focused fields scroll above it; while a
  text field has focus (on-screen keyboard), the bar is hidden [F6].

## 5. Components
### 5.1 Top row
Left: the screen's short label as a plain `label` (Today: the date) — NOT a pill, because it isn't tappable [N6]; a
neutral pill only where it opens something (with a chevron). Right: a 48 px `--fill-neutral` circle with a thin icon
(Today: "You: settings and records"). Back, where a screen has it, is a 48 px neutral circle on the left. The row wraps
when it doesn't fit [F5].
### 5.2 Hero heading
`display-l` / `display-xl`, the loudest thing on the screen, existing h1 copy unchanged, as many lines as it needs.
### 5.3 Bento grid (Today, Cook overview, Check-in tab) [F4, F7, F8]
- A container (`container-type: inline-size`): two columns when the container is at least `18rem` wide — every phone
  at 100 % text — and one column below it (200 % text, narrow windows). A lone card spans both columns.
- **Width [R4-7]:** a card that holds controls spans both columns (full width); only link cards (no controls) sit two
  to a row. On Today that means the main item is full width and tall, and the shorter link cards sit side by side.
- **Rows and stagger [R4-8]:** aligned rows; the stagger comes from row heights (a tall row, min-height 13.75rem, then
  shorter rows, min-height 9.5rem, alternating); content may make any card taller (nothing is clipped).
- **Fills by position [R4-8]:** a card's fill is its category pastel where (row + column) is even, `--fill-neutral` where
  it is odd (a full-width card counts as column 0), so neighbours side by side and above / below never match, even when
  every card has the same category (cook overview).
- Card anatomy: category-word eyebrow (`label`, `--ink-muted` — the word, not the colour, says what it is; where an
  approved note names the row's label, e.g. CookDayStorage Part C's "Tonight", that label is the eyebrow), a 44 px `--ink`
  circle with a 22 px `--on-ink` outline icon, the title (`title`), the approved content of that item, and a status line
  at the bottom in `body-small` `--ink-muted`.
- **Links and controls [F7]:** a card that holds no controls is one link (whole card, >= 48 px). A card that holds
  controls (Start session, ticks, "Short on time?", "No kit with me today", "Not today", "I did cook", the backup offer)
  is NOT a link: its title is the link to the screen, and every approved control stays inside the card, in the approved
  order. Nothing moves out of its card; reading order = visual order.
  Awaiting Creative Director review (food safety, 15 Oct 2026): the controls list above gains "Start cooking" (the later-cook block, TodayTraining.md "FS C2").
- Today keeps everything its approved notes put on each item (TodayTraining.md, APPROVED-FIXES §4, CookBackup.md,
  CookDayStorage.md Part C): exercise names, the focus chip, "Moved from", the rest-day inline meal ticks (one tap each),
  the cook card's breakfast line and the backup offer with "I did cook". The bento only changes how the items look.
- "Also today" stays as a visually hidden `h2` over the shorter cards [N8]. Loading skeletons take the bento shape [N9].
### 5.4 Full-width list cards (Week, Shopping, Settings, Logbook, Skills, Progress, Measurements, Focus, Kit import,
Break, Backup, recipe sheet) [F8]
Full-width cards, radius 30, title top-left (`body-strong` / `title`), the row's action as a 48 px `--circle-button`
with an `--on-circle-button` icon. In a vertical stack the fills alternate category pastel / `--fill-neutral`, so no two
neighbours match. "You" (Settings) is a list, not a bento [F8]: its groups alternate `--fill-neutral` and
`--pastel-pink`, rows inside a group separated by space. No 3D illustration (no art yet; never stock).
### 5.5 Buttons
Primary: `--ink` pill, `--on-ink` 1.0625rem 700, min-height 56 px. Secondary: `--fill-neutral` pill, `--ink` text, min 48.
Text button: `--ink` 600 underlined, 48 x 48 tap area. Destructive: secondary pill with the word "Delete …"; its text is
`--error` only on canvas / neutral / sheet, else `--ink` with a warning icon [F11].
Quiet text button (ReportProblem / ErrorCard "Report this", CD PASS 8 Oct 2026, note 5): the text button in
`body-small` (15 px) and `--ink-muted`, underlined, no fill, no icon, min-height 48 px, its text left-aligned with the
line above (the 4 px side padding pulled back); in code `.tbtn.small.muted`. For an optional, secondary action that must
read quieter than a screen's own next steps (it sits under them, never instead of them). Contrast `--ink-muted` on
`--fill-neutral` 6.6:1 light, 7.2:1 dark. Reuse it for that job; don't make another muted link style.
### 5.6 Options (radio / checkbox cards)
Unselected: `--fill-neutral` + 2 px `--ink-muted` outline. Selected: `--ink` fill, `--on-ink` text, a tick: `--ink` tick in
a `--canvas` circle [F9]. Minimum 64 px tall (as INDEX / OnboardingCards) [N3].
### 5.7 Switch (Settings) and stepper (SetLogging) [F10]
Switch: 52 x 32 track, off `--fill-neutral` with 2 px `--ink-muted` outline and an `--ink-muted` thumb (6.60 / 7.22);
on `--ink` track with a `--canvas` thumb; 48 px tap area; `role="switch"` with `aria-checked`; on/off also in its label
[R4-5]. Stepper: −/value/+ in one `--fill-neutral` pill, the − and + as 48 px `--circle-button`
circles, value in `numeral`.
### 5.8 Floating bottom bar (replaces the 84 px tab bar) [F1, F2, F3, F6]
- A fully round `--bar` capsule floating 16 px above `env(safe-area-inset-bottom)`, inset
  `max(16px, env(safe-area-inset-left/right))` from the sides (landscape too), min-height 64 px, padding 8 px, gap 8 px.
- Order unchanged: Today · Week · Cook · Train · Check-in. `nav aria-label="Main"`; the active link has
  `aria-current="page"` in every mode; each link's accessible name is its label.
- **Full mode:** the active tab is a `--bar-item-active` pill with icon + label (`label` 15 px 600); the others are 48 px
  `--bar-item` circles with `--on-bar-item` icons.
- **Compact mode** (chosen by measuring whether the full row fits with the WIDEST label, "Check-in", so the mode never
  changes from tab to tab): every tab is a 48 px circle; the active one is a `--bar-item-current` circle with a 2 px
  `--bar-item-current-ring` ring and an `--on-bar-item-current` icon, so it differs from the others [F2, R4-2]. Five
  48 px circles + four 8 px gaps + 2 x 8 px padding = 288 px: one row on every phone (capsule 312–398 px).
- **More rows** (as many as it needs) only when even compact mode doesn't fit (e.g. a desktop window at 200 % zoom:
  three rows at 172 CSS px) [R4-10].
- The mode and the bar's height are re-measured on resize, when the font has loaded and when the text size changes
  (ResizeObserver on the bar and its row) [R4-10]. A browser check runs at 344x882, 360x780, 390x844 and 430x932, at
  100 % and 200 % text, light and dark, and passes only when: no horizontal overflow; every bar item is at least 48x48;
  exactly one `aria-current="page"`; one row where the sums say so; the bar never covers the focused field or the last
  item of the page; in cook mode the timer and the last step's content are never under the capsule [R5-3].
- The page's bottom padding follows the capsule's measured height + 16 px + safe area. Hidden while a text field has
  focus [F6]. Hidden in cook mode and while a session runs, as now (APPROVED-FIXES 5.4).
### 5.9 Sheets and dialogs
`--sheet` panel with 30 px top corners, a 48 px neutral circle Close, no shadow, `--scrim` behind.
### 5.10 Status cards (alert banner, error card, offline strip; the health pause is retired by flow fixes H, 12 Oct 2026)
`--fill-neutral` card (never colour alone): a 44 px `--ink` circle with the icon, the plain message in `--ink`, the next
step as a primary or secondary pill. Error card: no ink circle — the `--error` icon sits straight on the neutral card
(5.82 / 5.43), the message in `--ink` [F11, R4-4].
### 5.11 Cook mode (full screen) [F12]
No tab bar (APPROVED-FIXES 5.4). A `--pastel-butter` band at the top (safe-area padded) with the step count as a plain
label ("Cook day · step 2 of 6") and "Leave cook mode" (a 48 px text button) top right; the step text in cook-mode
type on `--canvas`; at the bottom one capsule (`--bar`) holding a `--accent-lavender` 48 px Back circle (`--on-accent`
icon, `aria-label` "Back: previous step") and a `--bar-item-active` Next pill with `--on-bar-item-active` text [R4-3];
focus inside the capsule `--focus-on-bar`. Content (any timer, the last step's labels) keeps bottom padding of the
capsule's measured height + 16 px + `env(safe-area-inset-bottom)`, with the same `scroll-padding-bottom`, re-measured as
in 5.8, so nothing sits under it [R5-2]. Lavender never marks the current step.
Awaiting Creative Director review (food safety, 15 Oct 2026): on a later cook session the band label reads "Cook tonight · step {k} of {n}" (CookDayStorage.md "FS-D").
The prep day keeps "Cook day · step {k} of {n}".

## 6. Screen by screen (what changes)
- **Today:** top row (date label, You circle), hero h1 unchanged, then the bento of the existing items (main item tall,
  then Food and the third slot shorter) with every approved control inside its card (5.3).
- **Week:** day strip as `--fill-neutral` pills (selected: `--ink` pill, `--on-ink` text), scrolling sideways as
  approved; meals as full-width cards alternating lime / neutral, each with its storage line and a `--circle-button` "Swap".
- **Cook:** overview as a full-width stack (each meal card holds controls, so it spans the width, 5.3) with fills by position, each with "See the method"
  (APP-25) and "Open the recipe"; "Start cook day" primary; "Shopping list first" secondary. Cook mode per 5.11.
- **Train / session:** session cards blue / neutral; exercise rows full-width with a `--circle-button` "How to do it".
- **Check-in tab:** as built (the check-in card aqua tall, weigh-in neutral, "Starting point and progress" pink) [N7].
- **Lists** (shopping, recipe sheet, logbook, settings, skills, progress, measurements, kit import, break, backup,
  focus): full-width list cards (5.4) with alternating fills; flags / chevrons / ticks as `--circle-button` circles.
- **Start questions:** canvas, the question in `display-l`, options per 5.6, primary pill.

## 7. Do / Don't (from the brief, kept)
Do exaggerate scale (headline, radius, padding); keep the staggered heights; let ink anchor the pastels.
Don't use gradients, shadows, glass or outlines (except the input / option / switch / focus outlines accessibility
needs, and CookDayStorage's dashed lid squares, which are a drawing of a label);
never more than one pastel per card; never colour for text; never fill every card.

## 8. What doesn't change
Every screen's copy, order, numbers (engine), behaviour, sheets, error and offline states, A2 rules (fluid layout,
safe areas, `100dvh`, 48 px targets, 200 % text, no hover-only, reduced motion) and the test ids the browser suite
reads. Android `theme-color`: light #FFFFFF, dark #111111 [N10]. The four inactive tabs' labels are not shown (the
owner's brief; each keeps its name for screen readers and as a tooltip) — watched at UAT [N5].
