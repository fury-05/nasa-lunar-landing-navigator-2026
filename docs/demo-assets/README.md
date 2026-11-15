# Demo screenshots (P7-07)

Captured from the live site https://13-52-97-105.sslip.io on 2026-11-15 by Claude through browser automation, 1440 x 900, JPEG. Numbers are as the page showed them; nothing was edited. The results are upper bounds (terrain incomplete) and must not be captioned as verified landing conditions. The PGDA sites are derived tile centres, so call them "site points".

Shot list: docs/demo-shotlist.md. Status per item:

| # | Shot | File | Status |
|---|---|---|---|
| 1 | home | 01-home.jpg | captured |
| 2 | command overview and verdict | 02-command-verdict.jpg, 02a-command-top.jpg | captured after the wording fix: "Thresholds: placeholder defaults, not mission requirements" |
| 3 | horizon strip | ../validation/evidence/t5-command-horizon.jpg | captured earlier in the browser run |
| 5 | two sites by hand | 05a-site07-command.jpg, 05b-site04-command.jpg | captured |
| 6, 8 | mission needs, countdown chips | ../validation/evidence/t5-command-verdict.jpg | captured earlier; its Thresholds sentence was the old wording, so use 02-command-verdict.jpg for that part |
| 9 | local terrain | 09-local-terrain.jpg | captured |
| 10 | timeline | 10-timeline.jpg | captured |
| 11 | QuickMap button | ../validation/evidence/t1-pgda-site04-quickmap-centre.jpg | QuickMap side captured; button shot pending |
| 12 | site picker | 12-site-picker.jpg | captured |
| 13 | coordinate validation | ../validation/evidence/t5-pick-invalid.jpg | captured earlier |
| 14, 15, 16 | public view, slip, glossary | 14-public-top.jpg, 15-public-slip.jpg (glossary is in the same page below the slip) | captured; the slip example now uses Shackleton rim |
| 17 | spacecraft | 17-spacecraft.jpg | captured |
| 18 | credits | 18-credits.jpg | captured |
| 19 | api docs | 19-api-docs.jpg | captured |
| 20 | mobile 375 px | 20a-slip-375.jpg, 20b-credits-375.jpg, 20c-command-375.jpg | captured after the overflow fix |
| 21 | keyboard focus | 21-keyboard-focus.jpg | captured: the date field shows a 2 px outline |

## After the UI overhaul (2026-11-15, PR 197)
The layout changed: the Command Centre now shows the sky chart, horizon strip, local terrain and verdict tiles together, and Home has a 4-step guide. Shots taken after the overhaul, from the live site:

| File | What it shows |
|---|---|
| 30-command-1920.jpg | Command Centre at 1920 x 1080: controls as a left sidebar, sky chart, horizon strip with below-horizon band and labelled paths, local terrain (2D and 3D side by side) and verdict tiles |
| 31-command-1440.jpg | Command Centre at 1440 x 900: compact control block on top, charts and verdict below it |
| 32-home.jpg | New Home page: 4-step guide, colour legend, what this is not, one card per page |

Shots 01 to 21 above were taken before the overhaul. They show the older layout and are still accurate about the data, but retake them if you want the new look in the demo video.
