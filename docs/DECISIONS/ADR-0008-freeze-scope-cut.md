# ADR-0008: Scope cut at the 17:00 IST feature freeze
Date (UTC): 2026-11-15. Status: accepted. Deciders: Irfan (operator), confirmed in the session on 2026-11-15.

## Context
The deadline is 23:59 IST on 15 Nov 2026, with feature freeze at 17:00 IST and final submission by 21:30 IST. The priority is an honest, terrain-aware Command Centre, a site picker, far terrain and the 2D and local 3D visuals. Four rows do not serve that core and cannot be finished and validated in time.

## Options considered
1. Keep all rows and risk shipping unvalidated features. Rejected: it breaks the planning-grade honesty rule.
2. Mark rows POSTPONED. Rejected: `scripts/checklist.py --require-complete` fails on any non-DONE row.
3. Move the rows to ROADMAP.md and remove them from the todo tables, recording this ADR. Chosen.

## Decision
Moved to ROADMAP.md and removed from the checklist:
* P5-03 Moon globe with Trek equirectangular tiles (issue #79). The request named it "P5-02 Moon globe", but in todo/PHASE-5.md P5-02 is the 2D polar map, which stays because the site picker needs it. The user approved this mapping.
* P5-05 Sky dome first-person view (issue #81). The 2D sky view in the Command Centre covers the need.
* P6-05 Mission objective presets (issue #88). The editable mission needs form covers the need.
* P6-06 Saved scenarios and brief export (issue #89). Permalinks already reproduce a scenario through URL parameters.

## Evidence
`python scripts/checklist.py --check` and `--require-complete` are run after the edit; results are recorded in the pull request.

## Consequences and sources
No data source changes. The Public View may mention the globe and presets as future work only. The issues above are closed as "moved to ROADMAP".
