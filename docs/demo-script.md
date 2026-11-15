# Demo script (3 minutes), DRAFT

**Status: draft written by Claude (an AI assistant) from a browser walkthrough of the live site on 2026-11-15, for Luz to review and edit.** It was not written or spoken by Luz or any other person yet. Luz owns the final wording (issue #134). Every step below is something Claude saw working on https://13-52-97-105.sslip.io on 2026-11-15; the numbers are the ones the page showed then and must be checked again on the day of filming. Planning tool, not for flight operations.

Speaking pace: about 130 words per minute, so the spoken text below (the lines starting "Say:") is about 330 words, roughly 2.5 minutes, and the rest of the three minutes is for clicking and pauses. Timings are rough.

Before filming: use the address with `start=2026-12-11` so the dates match this script. The live results are upper bounds today because terrain data is incomplete, and the script says so on purpose.

## 1. The problem in one sentence (0:00 to 0:15)
Show: Home page `/` (title, the amber chip, the three cards).

Say: "Near the Moon's south pole the Sun skims the horizon, so a ridge can hide the Sun or the Earth, and choosing where and when to land is hard."

## 2. Pick a site (0:15 to 0:35)
Show: press "Command Centre". In the Site box choose "Shackleton rim" and set Length to 15 days and the start date to 11 December 2026. (Address: `/command?site=pgda-site04&start=2026-12-11&days=15`.)

Say: "I choose a site point, Shackleton rim. These are derived tile centres, not landing points. I pick a start date and a stay of fifteen days."

Point at: the chip "Terrain incomplete: covers 95% of directions, reach 296.2 to 300.0 km".

## 3. The Sun and Earth against the real horizon (0:35 to 1:10)
Show: scroll to "Sky from the site" and "Horizon strip". Drag the time control, then press Play and Pause.

Say: "Here is the sky from the site, looking up, with the real terrain skyline in grey. The amber disc is the Sun and the blue disc is the Earth. The Sun stays within a couple of degrees of the horizon. Along the horizon strip the amber line is where the Sun travels over the whole window, and the dashed blue line is the Earth. When a disc is faded, the terrain is hiding it. I can move the time, or press Play to watch both move."

What the page showed on 2026-11-15 (check again): at 2026-12-18 12:00 UTC the Sun was 1.2 degrees up and fully visible; the page said "Sunset in 43.7 h (2026-12-20 07:42 UTC)" and "Earth is down now and does not rise within this window".

## 4. The amber upper bound state (1:10 to 1:45)
Show: scroll to the Verdict card (amber box at the top, "Not viable" and "robust" chips, the numbers with ranges). Optionally open "How the range in brackets is made".

Say: "The amber box is the honest part. Our terrain data stops short of three hundred kilometres in about five percent of directions. Missing terrain can only make the real horizon higher, so every sunlight and Earth figure here is an upper bound. The real value can be the same or worse, never better. The numbers in brackets show the range if the terrain heights are a little off, but they do not cover the missing terrain."

What the page showed (check again): sunlight 8.2 days (5.6 to 8.6), Sun share 54 percent (37 to 58), longest dark spell 5.7 days, Earth link 0 percent. Do not describe this as "verified landing conditions".

## 5. Change a mission need (1:45 to 2:10)
Show: scroll to "Mission needs". Change "Minimum sunlight" to 80 and press "Apply needs".

Say: "The default needs are placeholders, not mission requirements. I enter my own, minimum sunlight eighty percent, and press Apply. The chip changes to 'custom needs, saved in the link', and the link now carries my choice, so I can share exactly this scenario."

What the page showed: the address gained `&sun=80` and the chip changed to "custom needs, saved in the link". For Shackleton rim the verdict stayed "Not viable". An empty or out-of-range value is refused with a clear message (optional to show).

Note for Luz: the Verdict card's "Thresholds" sentence says "chosen by you" even before anything is applied (issue #179). Do not read that sentence aloud until the owner has fixed it.

## 6. Open in QuickMap (2:10 to 2:30)
Show: press "Open in QuickMap at this site and time (new tab)". The new tab opens NASA's LROC QuickMap in the south polar view.

Say: "To check against an independent viewer, one button opens NASA's own QuickMap at this site and time. We use it to compare our results with a second source."

Note: QuickMap is a heavy page. Wait for the map to load before speaking; on 2026-11-15 the first view sometimes showed dark empty tiles for a while, and zooming out a little made them load. Do the tab switch before filming and record only the loaded view. Also, I saw a mismatch between the app and QuickMap of 12 m in height at this exact site point; do not claim "matches QuickMap" on camera (see `docs/validation/browser-checks-2026-11-15.md`).

## 7. Credits (2:30 to 2:50)
Show: press "Credits". Scroll slowly past the source cards.

Say: "Every number comes from the sources listed here, with the author, the citation and whether we have confirmed the usage terms. Where we have not, the page says so plainly."

What the page showed: 10 source cards; Moon Trek and QuickMap carry "terms not yet confirmed".

## 8. Close (2:50 to 3:00)
Show: back to the Command Centre or the Home page with the amber chip visible.

Say: "This is a planning tool, not for flight operations."

## Things I saw working but left out for time
Compare (two sites side by side), the Slip matrix (what a one, three or seven day slip does), Public View (plain language story with a glossary), Pick a site (click the map or type coordinates; building a new site takes a minute or more), export buttons (CSV, PNG, TXT summary), the 3D view toggle. Add any of them if the time allows.

## Things I did not see working (do not claim them)
Anything on a phone-size window for Slip matrix and Credits (they scroll sideways, issues #174 and #175), automatic opening of the Command Centre after "Pick a site" (issue #177), and any comparison that says the app and QuickMap agree on height or slope at the site point.
