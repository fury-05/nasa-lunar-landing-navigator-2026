# Approvals needed from a human (priority order)

Claude keeps working on everything else and adds items here instead of stopping. Irfan reviews this list in the morning. Mark an item DONE with the date and the decision when handled. This file is not part of the phase checklist.

| # | Priority | What needs a human | Why Claude cannot decide it | Blocks |
|---|---|---|---|---|
| A1 | p0 | Read the usage terms of the four official resources plus PGDA, NSSDC and the NASA CLPS page, and fill the `pending-source` licence cells in docs/ATTRIBUTION.md (issue #16, owner Luz) | Terms are legal text; a person must read and accept them | Final release gate, Credits page wording |
| A2 | p0 | Decide on a wide-area terrain source for the 100 to 400 km tiers (candidates not yet verified; a new ADR is needed) | Only the 5 m PGDA tiles (16 km and up) are verified. Distant peaks near the pole matter, and docs/02 limits sources | P2 skyline accuracy beyond the tile edge |
| A3 | p1 | Confirm teammates agree to be credited as `Co-authored-by` on their track commits (AFREEN_CONSENT, MEMBER3_CONSENT stay blank because author mode is not used) | Consent is theirs to give | None today; needed only if switching to author mode |
| A4 | p1 | Luz: check the three Trek layers render and record the credit text (docs/data/trek-layers.md) | Needs a human in a browser who can read the credit line | P1-05 attribution strings |
| A5 | p1 | Luz: five lit or shadowed spot checks against the QuickMap terrain shadow layer (docs/data/quickmap-links.md) | Independent validation must be a human step | P2 validation report |
| A6 | p2 | Set `HORIZONS_CONTACT_EMAIL` in `.env.local` and `/etc/lunar/lunar.env` if you want NASA to be able to reach the team | A personal email must not be chosen or committed by Claude | Etiquette item in docs/02 |
| A7 | p1 | Decide whether our public submission counts as "non-commercial" use of CSA content under https://www.asc-csa.gc.ca/eng/terms.asp, or email info@asc-csa.gc.ca. Claude read the terms but cannot judge how the organisers classify the project | Legal reading of terms | Public View CSA links (data/content/csa.json) |
