# Teammate tasks (Afreen and Luz)

Live site: https://13-52-97-105.sslip.io . Repo: fury-05/nasa-lunar-landing-navigator-2026 . Deadline 23:59 IST on 15 Nov; feature freeze 17:00 IST; final submission 21:30 IST. Do the tasks in order. Each result goes into the GitHub issue named on the task (comment) so Claude can copy it into the todo row as evidence. Record only what you actually saw. If you cannot do a step, write "not done" and why. Never guess a number.

Tool for all spot checks: QuickMap, https://quickmap.lroc.im-ldi.com/ . Use the "Open in QuickMap" button on a site's Command Centre page; it opens the south polar view (Stereographic South Pole, proj 27) at the site and the chosen time. Switch on the "terrain shadow" layer (stack id 4072) when a task asks about lit or shadowed.

## Task 1 (Afreen, issue #55, validation): height and slope at 5 sites
Pick these five sites in the app: pgda-site04 (Shackleton rim), pgda-site07 (Peak near Shackleton), pgda-site23 (Malapert massif), pgda-haworth (Haworth), pgda-site11 (de Gerlache rim).
For each: 1) open the site in the Command Centre and note the latitude, longitude and the terrain reach shown; 2) click "Open in QuickMap"; 3) in QuickMap use the elevation readout (hover or the profile tool) at the site centre and at one point 1 km away; 4) read off the height in metres and estimate the slope in degrees between the two points; 5) paste into the issue as a table: site id, lat, lon, QuickMap height (m), QuickMap slope (deg), screenshot filename. Attach screenshots to the issue, not to the repo.

## Task 2 (Luz, issue #55, validation): lit or shadowed at 5 date-times
Use site pgda-site04 and pgda-site23. Choose five UTC date-times between 2026-12-01 and 2027-03-01 (write them down first, so you do not pick after looking). For each: open the app for that site and date, note whether the Sun is up and the visible fraction shown; then open the QuickMap link for the same UTC time, enable the terrain shadow layer, and note whether the site point is lit or shadowed. Table: site, UTC time, app says (Sun up yes or no, visible %), QuickMap says (lit or shadowed), match yes or no. Include mismatches. Mismatches are valuable; do not hide them.

## Task 3 (Afreen and Luz, issue #16): read the terms, replace "pending-source"
Read the usage terms on each page and write the exact wording of the usage statement, the page URL and the date you read it. Afreen: NASA Horizons terms (https://ssd.jpl.nasa.gov/), NASA Trek (https://trek.nasa.gov/), QuickMap (https://quickmap.lroc.im-ldi.com/), PGDA Data Usage Policy and "Reproduction Guidelines" (https://pgda.gsfc.nasa.gov/products/90, also products 78, 81, 69). Luz: NSSDC Apollo page (https://nssdc.gsfc.nasa.gov/planetary/lunar/apolloland.html), NASA CLPS page (https://science.nasa.gov/lunar-science/clps-deliveries/), CSA terms (https://www.asc-csa.gc.ca/eng/terms.asp, and decide whether a public hackathon submission counts as non-commercial; if unsure, say so and email info@asc-csa.gc.ca). Post the wording in issue #16. Claude then edits data/attribution.json; do not edit it yourselves.

## Task 4 (Luz, issue #134): demo script
Draft a 3 minute demo script in docs/demo-script.md (new file, no em dashes): problem in one sentence, pick a site, show the Sun and Earth against the real horizon, show the amber "upper bound, terrain incomplete" honesty state, change a mission need, open QuickMap, show Credits, close with "planning tool, not for flight operations". Only describe what the live site really does; check each step on the live site first.

## Task 5 (Afreen and Luz, issue #135): test the live site
Go through: Command Centre (change site, start date, length), the site picker, Public View, Credits, keyboard only (Tab, Enter, arrow keys, no mouse), a phone-size window, and browser zoom 200 percent. Report each bug as a GitHub issue with: URL, what you did, what you expected, what happened, browser and OS, screenshot. Label them bug. Do not fix code unless Irfan says so.

## Reporting
When done, comment "done" with the tables on each issue. Claude records them in the todo rows and in docs/validation/. Questions go to Irfan.
