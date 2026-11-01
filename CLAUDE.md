# 8020jacked — rules for anyone building here

1. Read `docs/SPEC.md` first. The wireframes in `docs/design/screens/` are the truth; SPEC explains rules behind them.
2. Every number comes from `src/lib/engine` (pure, unit-tested). Screens never calculate.
3. All data goes through `src/lib/store` (on the phone in v0.1). Server-shaped things (auth, billing, email) sit behind `src/lib/services` with "test" implementations.
4. Copy: plain words, no shame, no streaks, no emoji, no calories on screen, nothing under 15px, taps ≥ 48px.
5. No health questions, no vegetarian/vegan/halal options (allergies only) — this is scope, not an oversight.
6. Next.js 16: read `node_modules/next/dist/docs/` before using an API you're unsure of.
7. Done = `npm run build`, `npm test` and `npm run lint` pass. Commits end with the session's attribution lines.
