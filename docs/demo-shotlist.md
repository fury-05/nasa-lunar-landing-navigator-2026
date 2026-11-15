# Demo screenshot shot list

For the submission and the demo video. Capture on the live site https://13-52-97-105.sslip.io at 1440 x 900 unless stated. Capture only what the page really shows; do not edit numbers. Save images outside the repository (attach them to issue #96 or the submission form). Date of the list: 2026-11-15; if the deployment changes (for example far terrain tiers go live), re-check what each state shows before capturing.

Use UTC dates inside the supported range (start 2026-12-01 to 2029-11-01). The Command Centre reads `site`, `start` (YYYY-MM-DD) and `days` (3, 8, 15 or 30) from the address; with no `start` it uses 2026-12-11 and with no `days` it uses 8.

| # | Name | URL or steps | What must be visible | Why |
|---|---|---|---|---|
| 1 | home | `/` | Title, the amber "Planning tool, not for flight operations" chip, three view cards, "API online" chip | First impression and disclaimer |
| 2 | command-overview | `/command?site=pgda-site04&start=2026-12-11&days=15` | Site card with terrain chip, Verdict panel with amber "Upper bound, terrain incomplete", metrics with ranges, sky view | The honesty state, the core screen |
| 3 | horizon-strip | same page, scroll to "Horizon strip" | Grey skyline, amber Sun track, dashed blue Earth track, discs at the scrubber time | Sun and Earth against the real horizon |
| 4 | sky-view-hidden | same page, move the scrubber to a time where the Earth disc looks faded | Faded disc behind grey terrain, caption | Shows a body hidden by terrain |
| 5 | site-compare-by-hand | `/command` with `site=pgda-site07` and then `pgda-site04`, same dates | Two captures to show a site that is mostly lit against one with long dark spells (live example values on 2026-11-15: site07 sun share 1.0, site04 sun share 0.713) | Why site choice matters. Recheck values before captioning |
| 6 | mission-needs | Command Centre, the mission needs form after changing "Minimum sunlight" to 80 and applying | The form, the "chosen by you" wording in the Thresholds line | Editable needs |
| 7 | uncertainty-details | open "How the range in brackets is made" | The basis lines, including the line that missing terrain is not covered by the band | Uncertainty transparency |
| 8 | countdown-chips | scrub to a time where the Sun is up | "Sunset in ..." and Earth chips with UTC times | R06 |
| 9 | local-terrain | "Local terrain" section for `pgda-site04` | Shaded terrain, labelled vertical exaggeration, Sun direction | Local terrain with real Sun |
| 10 | timeline | "Timeline" section | Four strips with labels and the marker | Time dynamics |
| 11 | quickmap-button | site card, "Open in QuickMap at this site and time (new tab)" button, then the QuickMap tab it opens | Button, then the QuickMap south polar view at the site | Independent cross-check path |
| 12 | site-picker | `/sites/pick` | Trek polar map with markers, coordinate form, credit line under the map | Site selection, Trek credit |
| 13 | custom-site-validation | `/sites/pick`, type latitude `-50` and a longitude, submit | The validation message "Latitude must be between -89.999 and -60 ..." | Input validation. Do not run a real job during filming unless the queue is idle |
| 14 | public-top | `/public` | Title, Simple and Detailed buttons, story step links | Accessible view |
| 15 | public-slip | `/public#slip` | "Why a three day slip matters" with the live example | R14 |
| 16 | public-glossary | `/public#glossary`, Detailed mode on | Glossary entries including Upper bound | Plain language |
| 17 | spacecraft | `/spacecraft` | Dashboard with the "placeholder values, not a real lander" wording and the lander form | Honest labelling of placeholders |
| 18 | credits | `/credits` | Source cards with usage statements and the "unconfirmed terms" chips | Attribution and open items |
| 19 | api-docs | `/api/v1/docs` | The route table | Public API |
| 20 | mobile | `/command` at 375 x 812 | Layout does not overflow | Phone check (teammate task 5) |
| 21 | keyboard | `/command`, Tab to the scrubber, show the focus ring | Visible focus | Accessibility evidence |

Two notes for captions. First, the live results are upper bounds today (terrain incomplete); do not caption them as verified landing conditions. Second, the PGDA sites are derived tile centres, so call them "site points", not "landing sites". Do not show real names, emails or any key or server path in a screenshot or the terminal.

Out of scope here: the 3 minute demo script (`docs/demo-script.md`, Luz, issue #134).
