# Luz and Afreen: your tasks, step by step

Read this top to bottom once. Each task says what to do, how, what to write down, and where to send it. You need only a browser and a GitHub account. You never edit code or data files. Claude (the assistant working with Irfan) turns your results into proof inside the project.

Live site: https://13-52-97-105.sslip.io
Deadline for results: **15:30 IST today, 15 Nov 2026** (the feature freeze is 17:00 IST). Partial results are still useful: send what you have by 15:30 and say what is missing.

## The rules that matter
1. **Write only what you really saw.** If a number is not visible, write "not visible". A wrong number is worse than a gap.
2. **A mismatch is not a failure.** If the app and QuickMap disagree, that is the result we need. Write it down. Do not "fix" it.
3. **No guessing, no copying from other teams or from memory.**
4. **Do not edit files in the repo.** Send results as described in "How to send your results".

## What this project is, in two lines
It shows when the Sun and Earth are above the real lunar horizon at south pole sites (for power and for direct radio contact with Earth). Your checks compare the app with NASA's own viewer, QuickMap, so we can say honestly how far to trust it.

## How to use the app for these tasks
1. Open https://13-52-97-105.sslip.io/command
2. Pick a site in the **Site** box. Pick the **Start date** and **Length**.
3. On the site panel press **Open in QuickMap at this site and time (new tab)**. QuickMap opens centred on the site, in the south pole view, at the time chosen.
4. Keep the app tab open next to the QuickMap tab.

---

## Task 1 (Afreen): height and slope at 5 sites  [issue #55]
**Why:** the app uses a LOLA terrain model. QuickMap shows NASA's own height readout. We compare them.

**Sites** (choose them in the app exactly like this): Shackleton rim (`pgda-site04`), Peak near Shackleton (`pgda-site07`), Malapert massif (`pgda-site23`), Haworth (`pgda-haworth`), de Gerlache rim (`pgda-site11`).

**For each site:**
1. In the app note the site's **latitude** and **longitude** from the site panel (copy them exactly).
2. Press **Open in QuickMap**.
3. In QuickMap move the mouse over the centre of the map (the site). QuickMap shows the position and, for the base map, the elevation of the point under the cursor in the information bar. If you cannot see an elevation, look for the **Profile** or **Measure** tool in the toolbar and use it. Write down which tool you used.
4. Read the **height in metres** at the centre point.
5. Move the mouse about **1 km** away (use the scale bar at the bottom of the map for the distance) in a straight line, for example due north. Read the height there.
6. Estimate the slope: `slope in degrees = arctan((height difference in metres) / 1000)`. For small slopes you can use `difference / 1000 * 57.3`. Write the height difference too, so the arithmetic can be checked.
7. Take one screenshot of QuickMap showing the position and the height readout.

**Write down, one row per site:**

| site id | app latitude | app longitude | QuickMap height at centre (m) | QuickMap height 1 km away (m) | direction of the 1 km step | slope (deg) | tool used | screenshot name |
|---|---|---|---|---|---|---|---|---|

---

## Task 2 (Luz): lit or in shadow at 5 date-times  [issue #55]
**Why:** the app says when the Sun is above the horizon at a site. QuickMap can show which places are lit at a moment. We compare.

**Sites:** Shackleton rim (`pgda-site04`) and Malapert massif (`pgda-site23`).

**Before you look at anything,** choose **5 UTC date-times** between 2026-12-01 and 2027-03-01 (for example one every 2 to 3 weeks, at any hour) and write them in a note **first**. This stops us from picking the interesting ones afterwards.

**For each date-time and site:**
1. In the app set the **Start date** to that day and Length to 3 days. Move the **time control** (the slider in the "Time shown in the sky views" box) to the chosen hour. The sky view and the "What happens next" list tell you if the Sun is up. Write: **Sun up: yes or no**, and the **visible Sun share** shown in the Verdict panel if there is one.
2. Press **Open in QuickMap**. In QuickMap check the clock reads the same UTC date-time (if not, set it). Make sure the **terrain shadow** layer is switched on in the layer list. Look at the site point: **lit** or **in shadow**.
3. Take a screenshot of QuickMap with the clock and the site visible.

**Write down:**

| site id | UTC date-time | app says (Sun up yes/no, visible %) | QuickMap says (lit/shadowed) | match yes/no | screenshot name |
|---|---|---|---|---|---|

Add a short note for any "no match" row: what you saw, not why.

---

## Task 3 (both): two terms pages Claude could not read  [issue #16]
Claude already read the usage terms for JPL Horizons, the PGDA elevation data, NASA media rules, the Canadian Space Agency, NSSDC and the CLPS page, and recorded the exact points in `docs/ATTRIBUTION.md`. Two sites load their text by script, so Claude could not see it. A person with a browser can.

**Luz:** open https://trek.nasa.gov/moon/ . Scroll to the very bottom and the About/Help/Credits menus. Find any of: terms of use, data policy, citation request, credit line. Copy the **exact words** and the **page URL** where you found them. If there is nothing at all, write "nothing found" and list the places you looked.

**Afreen:** open https://quickmap.lroc.im-ldi.com/ . Look for an About, Help, Credits, Terms or Data policy link (usually a menu or an "i" icon). Copy the exact words and the page URL. If nothing, write "nothing found" and list where you looked.

Do not summarise in your own words. Copy and paste. Add the date and time you read it.

**Both, also (5 minutes):** read the page https://www.nasa.gov/nasa-brand-center/images-and-media/ and look at the section called "Super Intelligence (SI) Applications". It describes limits on using NASA data in AI products, including that NASA must not be credited as the source inside AI-generated output and that nothing may suggest NASA reviewed or approved it. Claude only saw a short summary. Copy the **exact wording** of that section into the issue, so Irfan can decide whether the Credits page and README need a change. This is a decision for Irfan, not for you.

---

## Task 4 (Luz): the demo script  [issue #134]
Write a 3 minute spoken demo script in a new file `docs/demo-script.md` **only after** you have used the live site yourself. Send the text as an issue comment (see below) and Claude will commit it under your name as co-author.

Structure: (1) the problem in one sentence, (2) pick a site, (3) show the Sun and Earth against the real horizon, (4) show the amber "Upper bound, terrain incomplete" state and say what it means, (5) change a mission need and press Apply, (6) press Open in QuickMap, (7) open the Credits page, (8) close with the words "planning tool, not for flight operations". Mention only things you actually saw working. Plain words, no dashes.

Use the shot list in `docs/demo-shotlist.md` to see which pages to show.

---

## Task 5 (both): break the live site  [issue #135]
Use https://13-52-97-105.sslip.io for 30 minutes each. Afreen takes Command Centre, Compare and Slip matrix. Luz takes Pick a site, Public View, Spacecraft and Credits.

Also try: keyboard only (Tab, Shift+Tab, Enter, arrow keys, no mouse), a phone-size window (make the browser narrow), browser zoom 200%, and a wrong or odd entry (a very old date, empty boxes).

For every problem create a **new GitHub issue** at https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/new with the label `bug` and these five lines:
1. Page address (URL)
2. What you did, step by step
3. What you expected
4. What happened
5. Browser and computer (for example "Chrome on Windows 11") plus a screenshot (drag the picture into the text box)

If you find nothing, comment "tested, found nothing" on issue #135 with the list of what you tried.

---

## How to send your results
**Option A (best): a GitHub comment.** Open the issue named on the task (for example https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/55). Paste your table into the comment box. Drag screenshots into the same box (GitHub uploads them). Press **Comment**. Write "done" or "partly done: ..." at the top.

**Option B: message Irfan.** Send the table text and the screenshots in your team chat. Irfan pastes them into the issue or into this chat.

Either way Claude then reads the issue, copies the results into `docs/validation/quickmap-checks.md` and the todo row as evidence, and credits you as co-author on that commit. Nothing is counted as validated until the numbers are in the issue.

Questions: ask Irfan. If a step does not match what you see on screen, say so in your comment instead of guessing.
