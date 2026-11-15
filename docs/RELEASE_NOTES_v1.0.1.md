# Release notes: v1.0.1

Released 2026-11-15. Patch release on top of v1.0.0 (tag at 20d3a22). The engine, the API contract and the numbers are unchanged; this release is the UI overhaul, three bug and wording fixes, and documentation. **Planning tool, not for flight operations.**

## What changed since v1.0.0

### Interface (presentation only, no logic changes)
* **Home** has a guide: a hero with two buttons, four numbered steps, a colour key, one card per page, and a "What does 300 km mean?" section with a diagram (PR 197, PR 201).
* **Command Centre** shows the sky view, horizon strip, local terrain and verdict tiles together on one screen at 1440 and 1920 pixels, with a numbered 1-2-3 steps band and a wider control sidebar (PR 197, PR 200).
* **Charts:** the horizon strip no longer draws a stray diagonal line and now shows -6 to 15 degrees with labelled Sun and Earth paths; the sky view has a legend and labelled rings; the terrain views have a scale bar, north arrow, lit and shadow legend, and show 2D and 3D side by side on wide screens. The scale bars sit under the maps, not on top of them.
* **Type:** larger text, highlighted key numbers, four large verdict tiles.

### Fixes
* **Custom site not found right after it was built** (PR 200): the site list was cached for 5 minutes. The list now always revalidates (`Cache-Control: no-cache`, server and client), while a single site stays cached. A test covers it.
* **Flaky browser test** `a hidden tab does not draw`: fixed with a retry helper; 8 of 8 clean runs.

### Documentation
* **README:** badges, a start-here table, a real light and shadow animation captured from the live site, and a full architecture section with five diagrams and the formulas (ray casting with curvature, disc visibility, events, sensitivity band) (PR 203).
* **New [docs/HOW-TO-USE.md](HOW-TO-USE.md):** seven steps with marked screenshots.
* Post-overhaul screenshots in `docs/demo-assets` (PR 198). Stale lines in ARCHITECTURE.md and USER_GUIDE.md corrected.

## Unchanged and still true
All limits in [RELEASE_NOTES_v1.0.0.md](RELEASE_NOTES_v1.0.0.md) still apply:
* Terrain reaches the full 300 km in only 46% to 95% of directions across the ten curated sites, so every verdict is an upper bound.
* Earth link is line of sight only. Viability thresholds and lander values are placeholders.
* Validation is partial (Apollo 16 sun direction is off by 2.86 degrees, cause unknown); Moon Trek and QuickMap terms text was not found (`pending-source`).
* Open decision A11 (NASA media guideline wording for AI products) is still with the operator.

## Verification
* CI (python, web, repo checks) passed on every merged pull request in this release.
* Live site https://13-52-97-105.sslip.io returns ready; the deployed build is the one from PR 201 (later changes are documentation only).
