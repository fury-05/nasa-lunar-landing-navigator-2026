# Independent browser checks of the live site, 2026-11-15

**Performed by Claude (an AI assistant) through browser automation on 2026-11-15. NOT performed by Luz or Afreen, and not by any human.** This is an independent run of Tasks 1, 2, 3 and 5 of `docs/luz-and-afreen-tasks.md`, requested by the owner (Irfan). It does not replace the human checks; a human may still repeat them. Planning tool, not for flight operations.

Tool note: the Playwright MCP server (`mcp__plugin_playwright_playwright__*`) failed to connect in this session ("Failed to connect"), so the same automation was driven through the locally installed Python `playwright` package with Chromium (headless). Screenshots were taken by that tool and then read by Claude as images. No value below comes from memory.

Live site: https://13-52-97-105.sslip.io (the deployed build at the time of the run; the app was not edited).

## Task 2 pre-registration (written and committed BEFORE any app or QuickMap output for Task 2 was looked at)

Claude chose these five UTC date-times in advance, spread over 2026-12-01 to 2027-03-01, with different hours of day, without having seen any illumination output for them. The same five are used for both sites (10 site/time pairs).

| # | UTC date-time |
|---|---|
| 1 | 2026-12-09T03:00:00Z |
| 2 | 2026-12-27T15:00:00Z |
| 3 | 2027-01-14T21:00:00Z |
| 4 | 2027-02-02T09:00:00Z |
| 5 | 2027-02-24T18:00:00Z |

Sites: `pgda-site04` (Shackleton rim) and `pgda-site23` (Malapert massif).

Everything below this line was written after the pre-registration commit (cba73f0).

## Summary of what was and was not done

Done: Task 1 (5 sites), Task 2 (10 pre-registered pairs plus 4 clearly labelled post-hoc pairs), Task 3 (Trek and QuickMap reading, NASA SI section copied), Task 4 (in the separate file `docs/demo-script.md`), Task 5 (all pages, keyboard pass on the Command Centre, 375 and 640 px windows, odd inputs, one real custom-site job). Nine GitHub issues were opened (list at the end).

Not done: a true 200 percent browser zoom (a 640 px wide window was used as a stand-in), a screen reader pass, any browser other than Chromium, a keyboard pass of every page (only the first 48 Tab stops of the Command Centre), reading the per-layer FGDC "Credit" metadata in Moon Trek, the Check C skyline azimuth comparison (no task assigns it).

Side effect on the live site: one real custom-site job was submitted (lat -87.3, lon -100.5). It added `custom-ea0a8ed5d708` to the live site list. The limit given was two jobs.

## Task 1: height and slope at 5 sites (QuickMap as oracle)

### How the QuickMap values were obtained
* Hovering the QuickMap map shows only LAT, LON and RES in the information bar. No elevation appeared there. I looked for an elevation readout first and did not find one.
* The tool that does show a height is the point tool in "My Features" (pin icon in the left toolbar). A placed point opens the "Object Inspector". Its "Inspect" tab lists layer values at the point, including `TerrainHeight` (m), `TerrainPixelScale` (mpp) and `TerrainSlope` (deg). The panel header says "EXTRACTED FROM BOUNDING BOX 1 x 1 px 30.00, 30.00 m/px" with box size 0.03 km. I did not change the box size, and I do not know whether the height is a point sample or a resample over 30 m.
* My first point was placed by clicking the map with the point tool. For all ten readings in the table I placed the points by writing the coordinates into the `features=` parameter of QuickMap's own address (the form QuickMap itself wrote after my first click), with a 1.5 km half-width extent centred on the site. QuickMap kept those coordinates in its rewritten address (longitude shown as 0 to 360, for example 188.1301 for -171.8699). I did not read the coordinates back from the "Feature Info" tab for these ten points; only the rewritten address was checked.
* The 1 km step is 1000 m in the +y direction of the QuickMap polar stereographic grid (proj 27, sphere radius 1737400 m), computed with the formula in `docs/data/quickmap-links.md`. That is the direction towards longitude 0 deg at the pole, not geographic north. I assumed grid distance equals ground distance (the error at these latitudes should be well under 1 percent, but I did not measure it).
* Slope in degrees is `atan(height difference / 1000)`, signed (positive = uphill in the step direction).
* App values come from `GET https://13-52-97-105.sslip.io/api/v1/sites/{id}/terrain`, `heights_m[rows//2*cols+cols//2]` (rows = cols = 128, spacing 31.496 m, window 4000 m). For an even grid size that cell is about half a cell (15.7 m) away from the geometric centre of the grid. I did not test whether that matters.
* Time: QuickMap read on 2026-11-15, first about 06:12 to 06:20 UTC (11:42 to 11:50 IST) and then repeatedly later in the day.

### Table 1 (the columns requested in the task)

| site id | app latitude | app longitude | QuickMap height at centre (m) | QuickMap height 1 km away (m) | direction of the 1 km step | slope (deg) | tool used | screenshot name |
|---|---|---|---|---|---|---|---|---|
| pgda-site04 | -89.7668 | -171.8699 | 768.200 | 795.400 | +y of polar grid; point at lat -89.79939, lon -170.53776 | +1.56 (difference +27.2 m) | Object Inspector, Inspect tab, TerrainHeight | t1-pgda-site04-quickmap-centre.jpg |
| pgda-site07 | -88.811 | 123.6901 | 1645.340 | 1576.070 | +y of polar grid; point at lat -88.82897, lon 122.34749 | -3.96 (difference -69.27 m) | same | t1-pgda-site07-quickmap-centre.jpg |
| pgda-site23 | -85.9948 | -0.2358 | 4785.110 | 4809.470 | +y of polar grid; point at lat -85.96186, lon -0.23388 | +1.40 (difference +24.36 m) | same | t1-pgda-site23-quickmap-centre.jpg |
| pgda-haworth | -86.7639 | -22.777 | 1627.530 | 1523.180 | +y of polar grid; point at lat -86.73349, lon -22.55312 | -5.96 (difference -104.35 m) | same | t1-pgda-haworth-quickmap-centre.jpg |
| pgda-site11 | -88.6834 | -67.9321 | 1794.070 | 1627.640 | +y of polar grid; point at lat -88.67066, lon -66.6148 | -9.45 (difference -166.43 m) | same | t1-pgda-site11-quickmap-centre.jpg |

The screenshots show the centre point readout only (file size limit). The readings 1 km away were taken the same way; their screenshots were not kept in the repository.

### Table 2: app terrain endpoint against QuickMap at the centre

| site id | app terrain endpoint, centre cell (m) | QuickMap height at centre (m) | app minus QuickMap (m) | QuickMap TerrainSlope at centre (deg) | app local slope at centre, central difference over 63 m (deg) | QuickMap TerrainSlope at the 1 km point (deg) | QuickMap TerrainPixelScale (mpp) |
|---|---|---|---|---|---|---|---|
| pgda-site04 | 780.527 | 768.200 | +12.327 | 29.611 | 32.03 | 34.952 | 2.0 |
| pgda-site07 | 1643.661 | 1645.340 | -1.679 | 2.664 | 3.72 | 4.543 | 5.0 |
| pgda-site23 | 4782.703 | 4785.110 | -2.407 | 4.043 | 2.40 | 5.535 | 4.0 |
| pgda-haworth | 1626.664 | 1627.530 | -0.866 | 4.703 | 3.86 | 11.772 | 5.0 |
| pgda-site11 | 1793.071 | 1794.070 | -0.999 | 2.533 | 3.75 | 13.631 | 5.0 |

The "app local slope" column is my own calculation from the app's height grid (central difference between the cells either side of the centre cell, east-west and north-south combined). It is not a number the app shows.

### What the numbers show (recorded as seen, not tuned or explained away)
* The height differences are not one constant offset. Four sites differ by -0.87 to -2.41 m; `pgda-site04` differs by +12.33 m. Under the rule in `docs/validation/quickmap-checks.md` ("a varying difference is a finding") this is a finding and not a datum offset. The app reports a median height error of about 0.19 m for these windows (field `height_error_m`), which does not cover differences of 1 to 12 m.
* The two local slopes differ at all five centres (app minus QuickMap): +2.42, +1.06, -1.64, -0.84, +1.22 deg, in the site order of the table. The two use different baselines (63 m for mine; QuickMap's method is unknown to me), so they are not necessarily the same quantity.
* The 1 km chord slope (table 1) and the local slope (table 2) disagree strongly at some sites. `pgda-site04` has a local slope of 29.6 deg but a 1 km chord of 1.56 deg; `pgda-site11` has a chord of -9.45 deg and a local slope of 2.5 deg. One direction and one point per site is a thin sample.
* I did not compare the app grid orientation against the QuickMap +y direction, so I cannot say whether the app's own 1 km neighbours point the same way.

## Task 2: lit or in shadow at 5 pre-registered date-times

The five UTC date-times were committed before any Task 2 output was looked at (commit cba73f0, see the top of this file). The same five were used for both sites (10 pairs).

### How each side was read
* **App side:** `GET /api/v1/sites/{id}/state?t=...` for all 10 pairs. "Sun up" is the API field `sun.up` (true when the visible Sun fraction is at least 0.5); the share is `sun.visible_fraction`. For three pairs I also opened the Command Centre with the `t` parameter and read the sky figure description: `pgda-site04` 2027-01-14T21:00Z ("Sun at azimuth 266 and elevation 0.7 degrees, 15 percent visible"), `pgda-site23` 2026-12-09T03:00Z ("elevation -2.6 degrees, 0 percent visible") and `pgda-site04` 2026-12-27T15:00Z ("elevation 1.0 degrees, 0 percent visible"). They agree with the API. The Verdict panel shows window totals only; the share at the chosen moment is in the sky figure text.
* **QuickMap side:** the link built as in `docs/validation/quickmap-checks.md` (`proj=27`, `stack=3314,4072`, `time=` the chosen time), an extent requested as 800 m square (QuickMap widened it to the window shape; the final view was about 1.1 km wide at 1.14 m/px), 40 s wait for tiles. The QuickMap clock read the chosen time each time (for example "2026-12-09 03:00:45 UTC"; it runs on from the set time while the page is open, so it shows a few seconds to a minute later). A blue marker was placed at the site point through the `features=` parameter.
* **How "lit or shadowed" was read:** by looking at the screenshots and by classifying pixel colour (yellow tint = sunlit, purple tint = shadow, as in the layer legend described in `docs/data/quickmap-links.md`). The marker covers the exact site pixel, so I sampled 12 points on a ring 14 screen pixels (about 16 m) around the marker and the nearest sunlit pixel by distance.

### Table (pre-registered times)

| site id | UTC date-time | app says (Sun up yes/no, visible %) | QuickMap says (lit/shadowed) | match yes/no | screenshot name |
|---|---|---|---|---|---|
| pgda-site04 | 2026-12-09T03:00:00Z | no, 0% | shadowed (all 12 ring samples shadow; no sunlit pixel in view) | yes | t2-pgda-site04-quickmap-shadow-5times.jpg (panel 1) |
| pgda-site04 | 2026-12-27T15:00:00Z | no, 0% | shadowed (same) | yes | same file (panel 2) |
| pgda-site04 | 2027-01-14T21:00:00Z | no, 15.28% (below the 50% rule) | shadowed; nearest sunlit pixel about 80 m away | yes | same file (panel 3) |
| pgda-site04 | 2027-02-02T09:00:00Z | no, 0% | shadowed (no sunlit pixel in view) | yes | same file (panel 4) |
| pgda-site04 | 2027-02-24T18:00:00Z | no, 0% | shadowed (no sunlit pixel in view) | yes | same file (panel 5) |
| pgda-site23 | 2026-12-09T03:00:00Z | no, 0% | shadowed; nearest sunlit pixel about 21 m away, roughly one shadow pixel: boundary case | yes, with caution | t2-pgda-site23-quickmap-shadow-5times.jpg (panel 1) |
| pgda-site23 | 2026-12-27T15:00:00Z | no, 0% | shadowed; nearest sunlit about 60 m away | yes | same file (panel 2) |
| pgda-site23 | 2027-01-14T21:00:00Z | no, 0% | shadowed (no sunlit pixel in view) | yes | same file (panel 3) |
| pgda-site23 | 2027-02-02T09:00:00Z | no, 0% | shadowed; nearest sunlit about 80 m away | yes | same file (panel 4) |
| pgda-site23 | 2027-02-24T18:00:00Z | no, 0% | shadowed; nearest sunlit about 188 m away | yes | same file (panel 5) |

Tally: 10 of 10 pairs agree, 0 mismatches. "No sunlit pixel in view" means none within roughly 250 m of the marker (the limit of what my search covered).

### What this tally does and does not say
* All ten pre-registered pairs are cases where the app says the Sun is down. The test could not catch an app that wrongly says "down". It only shows the app does not say "up" where QuickMap says shadow. This weakness is in the pre-registered set, which I did not change.
* `pgda-site04` 2027-01-14T21:00Z: the app puts 15.28 percent of the Sun's disc above the skyline while the QuickMap layer, which is computed for the centre of the solar disc (per its own description), shows shadow. These are not in conflict, but a reader should not read "15 percent" as "partly lit" in the QuickMap sense.
* `pgda-site23` 2026-12-09T03:00Z is within about one shadow pixel (20 m) of a sunlit area. With the layer's own stated accuracy (subsolar longitude within 0.5 deg, latitude within 0.1 deg) a shift of one pixel is possible. I record it as shadowed and do not claim more.

### Post-hoc lit cases (NOT pre-registered; chosen after looking at app output)
To give the comparison at least some lit cases I scanned the app `/state` every 12 hours from 2026-12-11T00:00Z and took the first times where the app says Sun up. This was chosen after seeing app output, so it is not blind. The first read of each in QuickMap was done at 1.14 m/px as above.

| site id | UTC date-time | app says | QuickMap says | match | screenshot name |
|---|---|---|---|---|---|
| pgda-site04 | 2026-12-12T12:00:00Z | yes, 100% | lit (all 12 ring samples sunlit) | yes | t2-posthoc-sunlit-quickmap.jpg (panel 1) |
| pgda-site04 | 2026-12-13T12:00:00Z | yes, 100% | lit (all 12 ring samples sunlit) | yes | same file (panel 2) |
| pgda-site23 | 2026-12-22T00:00:00Z | yes, 100% | on the lit/shadow boundary: sunlit pixels to the left of the marker, shadow to the right; I cannot say which side the site pixel is on | not resolved | same file (panel 3) |
| pgda-site23 | 2026-12-22T12:00:00Z | yes, 100% | lit (all 12 ring samples sunlit) | yes | same file (panel 4) |

I did not test `pgda-site23` at 2026-12-21T12:00Z where the app reports 0.551 visible (the closest I saw to the 50 percent switch).

### How reliable is a visual read of the shadow layer at one pixel?
Not very, and I want that to be clear:
* The layer is a 20 m per pixel raster drawn at about 19 percent opacity over the basemap; shadow is a dark purple, sunlit is a dull olive. On a dark basemap in a deep crater the two tints are close, and I needed a colour classifier to be sure; by eye alone in a small screenshot I would not trust it.
* The marker covers the pixel under the site point. I read the surrounding ring instead.
* The tiles load slowly. My first passes (short wait, larger view of 12 km) sometimes showed no overlay at all for later times (the grey basemap only), and a 3 km view loaded black everywhere. I discarded those frames and re-ran with a 40 s wait and the finer view; the table uses only the final frames. A read taken too early would have shown "no shadow layer", not "lit".
* The layer is simulated, with stated accuracy limits of its own, and its terrain is not the same data as the app's terrain, so a one-pixel disagreement near a boundary tells nothing about which is right.
* One site point and one moment per row is a small sample.

## Task 3: terms pages (Trek and QuickMap) and the NASA SI section

All text below was read in the browser on 2026-11-15 (about 06:46 to 07:50 UTC, 12:16 to 13:20 IST) through browser automation by Claude. Quotes are short and verbatim from the page text as the browser returned it.

### Moon Trek, https://trek.nasa.gov/moon/
* Footer: the page has no footer element. The only text at the bottom of the viewport is the logo "MOONTrek" and a scale bar.
* A "Welcome to Moon Trek" dialog opens first: "Moon Trek is an application that allows you to view imagery and perform analysis on data from this celestial body." (buttons "Start Tutorial", "Skip Tutorial").
* The menu (hamburger icon at the top right) lists, after the tool names: "Share Link", "Screen Capture", "About", "Contact Us", "Credits", "Related Links", "Release Notes", "System Requirements", "Tutorials", then "Are you a scientist or engineer?". No item is called Terms, Data policy, Citation, License or Privacy.
* **About** (URL stays https://trek.nasa.gov/moon/#v=0.1&...; the panel opens inside the page): "About Moon Trek Version : 3.6.29". Selected sentences: "Moon Trek is a major new release that significantly upgrades and builds upon the capabilities of its predecessor, NASA’s Lunar Mapping and Modeling Portal (LMMP)." and "The online Web portal allows anyone with access to a computer to search through and view a vast number of lunar images and other digital products." and "Moon Trek provides easy-to-use tools for browsing, data layering and feature search, including detailed information on the source of each assembled data product." and "Detailed metadata for each data product is also made available to the user." No terms, citation request or credit line in it.
* **Credits**: the panel lists only names: "Lunar Reconnaissance Orbiter", "Selenological and Engineering Explorer", "Apollo", "Lunar Orbiter", "Clementine", "Chandrayaan", "Chang'e 2", with logos linking to http://www.jpl.nasa.gov/, http://sservi.nasa.gov/, https://www.nasa.gov/centers/ames/home/index.html, http://www.usgs.gov/, https://pds.nasa.gov/, http://www.lroc.asu.edu/ and http://www.dlr.de/pf/en/desktopdefault.aspx/. Each mission name links to a mission page (NASA, JAXA, or Wikipedia for Lunar Orbiter, Chandrayaan and Chang'e 2). No credit-line sentence or citation request.
* **Contact Us**: "Problems or Suggestions? We welcome any feedback you have on Moon Trek." with the address trek@jpl.nasa.gov.
* **Release Notes**: newest entry "Version 3.6.29 | January 2024".
* **System Requirements**: "To best experience Trek, we recommend using one of the following WebGL enabled browsers: Google Chrome 18+ Mozilla Firefox 40.0+".
* **Related Links**: links to other Treks, NASA SSERVI, PDS, NASA Science, NASA's Eyes and NASA 3D Resources.
* Result for Trek: **nothing found** on terms of use, data policy, citation request or credit line in the pages above. Places looked: welcome dialog, the whole menu list, About, Credits, Contact Us, Release Notes, System Requirements, Tutorials (a list of tutorial links only), Related Links, page footer. Places NOT looked: the per-layer "Metadata" views and each layer's FGDC credit field, "Are you a scientist or engineer?", the tutorial videos, and any page on trek.nasa.gov outside /moon/.

### LROC QuickMap, https://quickmap.lroc.im-ldi.com/
* Main screen: no footer. The bottom bar shows "LAT", "LON", "RES" and a button "Accuracy". The title area has "Lunar/LROC" and a button "Explore other QuickMaps"; a link "Visit the ACT website" goes to http://www.actgate.com/.
* **Help page** https://quickmap.lroc.im-ldi.com/help (the "?" icon): "Help User Guide Latest Updates Lunar QuickMap (Fall 2022 Release) Lunar Examples QuickMap Terrain Shadows Report an Issue © Applied Coherent Technology 2026 Ver: 866d2613@ 2026-07-29T17:56:05.963Z". Link targets: User Guide http://docs.quickmap.io/ (redirects to https://docs.quickmap.io/, page title "QuickMap | Help"), Latest Updates https://www.actgate.com/blog, Lunar Examples https://www.actgate.com/examples/lroc-quickmap, QuickMap Terrain Shadows https://qts.quickmap.io/fcgi-bin/fprovweb.exe?_xtype=text/html&target=MOON&cmd_script=qts_js.
* **Accuracy** button opens "Note on Accuracy". Verbatim: "The Mean Earth (ME) reference system is used for all map products and 3D navigation." and "The default lunar basemap comprises WAC imagery, with an average of 50m of uncertainty, and NAC imagery, with an average of 25m of uncertainty." and "Completeness and accuracy will vary by product. See each layer’s description for accuracy details." and "QuickMap’s 3D mode is designed for rapid, web-based illumination and terrain inspection. Due to browser constraints, terrain simplification, and limitations of the 3D engine, results from this tool may not be wholly accurate. For critical applications please validate with QTS or other tools."
* Result for QuickMap: **no terms of use, data policy, citation request or credit line found**. The only legal-looking text is "© Applied Coherent Technology 2026" on the Help page. Places looked: main screen, Help page and its link list, the Accuracy note, the left toolbar (Projection, Layers, My Features, Settings, Fullscreen, Share, Help), the Layers panel (layer names and the shadow layer's controls), the docs.quickmap.io landing page (its first lines read "QUICKMAP | HELP Map Time Control Import Vector Toolbar Projections Layers Expression ..."), and the ACT blog page links. Places NOT looked: the text of each layer's description, "Report an Issue", the ACT About/Contact pages, the QTS page, and the docs.quickmap.io sub-pages.

### NASA brand page: "Super Intelligence (SI) Applications"
URL https://www.nasa.gov/nasa-brand-center/images-and-media/ , page title "Guidelines for using NASA Images and Media Guidelines", read 2026-11-15 about 06:47 UTC (12:17 IST). The section is quoted in full below as the page returned it (the heading appears twice on the page). I did not verify the order or anything else that the page itself refers to.

> Super Intelligence (SI) Applications
>
> Per the Sept. 29, 2026, Executive Order 14434: Inaugurating the Era of Super Intelligence, NASA is working to update its communications to incorporate the term “super intelligence” as directed.
>
> Super Intelligence (SI) Applications
>
> NASA is committed to transparency, open science, and making data available to everyone. While a wealth of public information is available for use in super intelligence (SI) applications, it’s important to understand the following when using our data for SI development:
>
> Attribution: NASA cannot verify the accuracy of information once it’s incorporated into a large language model. Therefore, attribution of the information directly to NASA is not permitted. Similarly, NASA does not permit our Insignia (i.e., NASA Meatball, Worm logotype, or Seal) to appear with SI generated imagery or in the training of SI tools. To promote transparency, NASA strongly encourages SI-generated products maintain a marking indicating the product is SI generated.
>
> Source Disclosure (No Permission Implied): As a statement of fact, you can acknowledge your SI tool includes NASA source material, but do not imply any review or permission was granted by NASA for its specific use.
>
> Accuracy Disclaimer: It’s important to clarify that NASA is not responsible for the accuracy of the information generated by your SI model.
>
> SI Model Attribution: All outputs from the SI model should be attributed to the SI product itself, not NASA. References like “according to NASA” or similar are prohibited in SI products.
>
> Endorsement: Use of NASA content to train SI models does not constitute endorsement by NASA.
>
> By following these guidelines, you can ensure transparency and responsible use of our public information in your SI applications.

Factual observation only (the decision is Irfan's): the live Credits page says "Every number in this tool comes from the sources below" and names NASA centres as sources with citation strings, and its footer says "Planning tool, not for flight operations". Whether the sentences above apply to this tool, and whether the Credits wording needs a change, is not something I decided.

## Task 5: breaking the live site (Claude, browser automation, 2026-11-15)

Live site only, https://13-52-97-105.sslip.io, read from about 06:58 UTC (12:28 IST) to 07:55 UTC. Browser: Playwright Chromium (Chrome-based) on Windows 11, 1440 x 900 unless stated. Time spent was about 70 minutes in total, not 30 minutes per person.

### What worked as expected
* **Home:** title, amber chip "Planning tool, not for flight operations", three cards (Command Centre, Public View, Spacecraft Dashboard), "API online" chip with "api 0.0.1" and "engine 0.0.1", and a footer with the same disclaimer. Navigation lists Home, Command Centre, Compare, Slip matrix, Pick a site, Spacecraft, Public View, Credits.
* **Command Centre, pgda-site04, 2026-12-11, 15 days:** site card with chip "Terrain incomplete: covers 95% of directions, reach 296.2 to 300.0 km"; Open in QuickMap link (opens a new tab, `target=_blank`, `rel=noreferrer noopener`); Mission needs form; scrubber; "What happens next"; sky figure; Verdict "Not viable" + "robust" with sunlight 8.2 d (5.6 to 8.6 d), Sun share 54% (37% to 58%), longest dark spell 5.7 d, Earth link 0%, longest Earth outage 15.0 d; horizon strip; local terrain; timeline; export section. Screenshots: t5-command-verdict.jpg, t5-command-horizon.jpg.
* **Mission needs:** setting Minimum sunlight to 80 and pressing Apply put `&sun=80` in the address and changed the chip to "custom needs, saved in the link". Empty, 150 and -5 each showed "Percentages must be between 0 and 100 and hours must be zero or more. Nothing was applied." and left the address unchanged (no screenshot kept; the text above is what the page said).
* **Scrubber and play/pause:** the slider runs 0 to 360 (hours, step 1) for 15 days. "+" and "-" move the clock by one hour. Home and End on the slider go to the window start and end. Play advanced the clock from 2026-12-11 00:00 to 14:00 in about 2.5 s at "6 hours per second"; Pause stopped it (clock unchanged for 1.5 s afterwards). With the keyboard, Enter on Play started it and Space paused it.
* **Exports:** Metrics (CSV), Timeline (CSV), Sky view (PNG), Horizon strip (PNG) and Summary (TXT file) each produced a download (539 B, 36.8 KB, 230 KB, 81 KB, 2.6 KB). "Copy link to this view" and "Copy scenario summary (text)" ran without an error message (I did not read the clipboard). The summary text starts "Planning tool, not for flight operations." and states "Verdict: UPPER BOUND, terrain incomplete (real values can only be worse)".
* **Dates:** 2026-12-01 and 2029-11-01 and 2029-11-02 load. `start=2020-01-01`, `start=2026-11-15` and `start=2026-02-30` show "Outside precomputed coverage: This site is precomputed from 2026-12-01T00:00Z to 2029-12-01T00:00Z." A 30 day window starting 2029-11-25 gives the same message. `days=99` falls back to the 3 day option. "Next 30 days from today" goes to 2026-12-01 (today, 2026-11-15, is before the data range).
* **Compare:** nothing is selected at first and the page says "Choose at least 2 sites to compare." Choosing Shackleton rim and Peak near Shackleton produced a side-by-side table for 8 days from 2026-12-11 (sunlight 6.9 d against 8.0 d, Earth link share 0% against 47%, and a "compared with" list). Selecting a fifth site is blocked: after four are chosen the other 15 boxes are disabled. The page says "Nominal values only. Differences ignore the uncertainty ranges".
* **Slip matrix:** choosing the same two sites gave a table with columns No slip, +1, +3, +7 days (Shackleton rim: all "not viable", sunlight 6.9 d, 7.9 d, 6.3 d and 2.3 d; Peak near Shackleton: all "upper bound", Earth link 47%, 59%, 84%, 100%). Each cell links to the Command Centre for that scenario (the third cell opened `/command?site=pgda-site04&start=2026-12-14&days=8`).
* **Pick a site, form:** empty fields leave the button disabled. Latitude 10, -50, -89.9995 show "Latitude must be between -89.999 and -60 (south polar region, negative values)." Missing one value shows "Enter a latitude and a longitude." "abc" shows "Latitude and longitude must be numbers in degrees." Longitude 181 shows "Longitude must be between -180 and 180 degrees, east positive." Latitude -70 or -60.001 (valid) show "North of 75 S no polar terrain data exists, so this point would have a flat horizon." and enable the button. (t5-pick-invalid.jpg.)
* **Pick a site, map:** clicking empty ground at (780, 560) filled the fields with -80.33915 / 111.37485. Clicking a teal dot opened that existing site in the Command Centre. I submitted one real job (-87.3, -100.5): POST `/api/v1/sites/custom` answered 202, the button turned into "Building..." with a progress bar "fetching Sun and Earth positions from Horizons 40%" (t5-pick-job-running.jpg), and when it finished the form showed "Flat horizon, not terrain aware" and a button "Open in Command Centre" (t5-pick-job-after90s.jpg). See issue #177 for the missing automatic navigation.
* **Public View:** five story sections, a Simple/Detailed toggle (Detailed sets `aria-pressed=true` on its button), a glossary (includes "Upper bound: A best case. The real answer can only be the same or worse.") and a "Learn more" list of Canadian Space Agency pages, which open in a new tab.
* **Spacecraft:** form with Battery capacity, Reserve, Survival load, Autonomy, optional slope. Placeholder values are labelled "placeholder values, not a real lander" and "Status: pending-source". Negative and empty battery values showed "Use numbers of zero or more, a reserve between 0 and 100 percent and a slope limit between 0 and 90 degrees." Applying a value puts it in the address (`&cap=200`). On `pgda-site07` with the battery set to 2, 1000 and 100000 Wh the "Available" time changed (0.2 h, 80.0 h, 8000 h) and the margins followed. The power badge stayed "~ marginal" in all three (the pessimistic need is 41.4 h, which a 2 Wh battery cannot meet, so I cannot tell whether that is right; see my opinion below).
* **Credits:** 10 source cards, each with an author, a citation line, a "terms confirmed" chip (Moon Trek and QuickMap show "terms not yet confirmed"), and a link. Footer "Planning tool, not for flight operations."
* **3D view toggle** on the Command Centre switches to a canvas and back without an error. I did not inspect the 3D picture itself.

### Keyboard only (Command Centre, 1440 px)
* Tab order of the first 48 stops follows the visual order: skip link, the eight nav links, Site, Length, Search and filter, Pick another site, date field (4 stops for day, month, year and the picker), the five date buttons, Open in QuickMap, the four needs fields, Apply, Reset, "-", scrubber, "+", Play, Speed, summary, 2D/3D, sliders, Zoom in, timeline, summary list, Copy link and the export buttons.
* Every stop had a 2 px solid outline (colour rgb(159, 208, 255)) except the fourth date stop, where the computed outline style is `none` (likely the calendar picker button inside the date input; I did not look at it by eye). The 48 stops were read from computed styles, not judged by eye in screenshots.
* The scrubber answers arrow keys (two Right presses: +2 h), Home and End. Play and pause work from the keyboard (above).
* Not done: I did not test Compare, Slip, Pick a site (map), Public View, Spacecraft or Credits with the keyboard only, and I did not check whether the map can be used without a mouse.

### Narrow window (375 x 812) and 640 px wide (a stand-in for 200 percent zoom)
* At 375 px: Home, Command Centre, Compare, Pick a site, Public View and Spacecraft had no sideways scrolling (document width equals window width). Slip matrix and Credits did overflow (document width 423 px and 436 px against 360 px). Issues #174 and #175. Screenshots t5-slip-375.jpg, t5-credits-375.jpg, t5-command-375.jpg.
* At 640 px: none of the eight pages overflowed.
* Count of interactive controls under 24 x 24 CSS px: 1 on Command Centre, 21 on Compare, 15 on Pick a site at 375 px (checkboxes, the map buttons and similar). I did not check which, nor whether the clickable label area is larger.
* This is not real browser zoom. At 200 percent zoom on a 1440 px desktop the effective width is about 720 px, which is close to my 640 px test; I did not run it.

### Odd inputs
* `start=banana`: the Command Centre is replaced by "Something went wrong in this view" (issue #172). Other bad values give a normal error message (see above).
* `site=nope`: four stacked error messages and the site selector falls back to the first custom point (issue #173).
* `t=2026-12-11T14:24:00Z` is shown as 14:00 on the clock (issue #176).

### Defects found (issues)
| issue | title | severity in my view |
|---|---|---|
| [#172](https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/172) | Command Centre crashes on a non-date start value in the address | low to medium |
| [#173](https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/173) | Duplicate error alerts for out-of-range date and unknown site | low |
| [#174](https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/174) | Slip matrix page scrolls sideways at 375 px wide | medium for phones |
| [#175](https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/175) | Credits cards cut off at 375 px wide | medium for phones |
| [#176](https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/176) | Time in link rounds to the hour while the address keeps minutes | low |
| [#177](https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/177) | Pick a site does not open the Command Centre when the job finishes | medium |
| [#179](https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/179) | Verdict says thresholds are chosen by you when the placeholder defaults are in use | medium (honesty wording) |
| [#181](https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/181) | Default site is a flat-horizon custom point on Command Centre, Spacecraft and Public View | medium |
| [#183](https://github.com/fury-05/nasa-lunar-landing-navigator-2026/issues/183) | Verdict labelled fragile although the whole range is below the need | open question |

`gh issue list --label bug --state open` returned no open bug issues before I started, so no duplicates were possible. All issues carry the labels `bug` and `web` and the milestone P7.

## Claude's opinion 1: first impression for a public reader

This is my opinion as an AI assistant reading the live site, not a measured result and not a human reader's view.
* The first screen is clean. The amber "Planning tool, not for flight operations" chip is the first thing under the navigation, which is the right order. The title and one sentence say what the tool does.
* The three home cards give no hint of the rest of the navigation (Compare, Slip matrix, Pick a site, Credits are only in the top bar), and two cards carry the tags "T1" and "T2", which mean nothing to a visitor.
* The Command Centre starts on "Custom point -85.4137,23.7719" (issue #181). A newcomer lands on the least informative site, with a "flat horizon" chip, and does not know the named sites are further down the list.
* The Command Centre is a long page with many numbers. A public reader would probably find the sentence "treat every number here as an upper bound" and the verdict wording more useful than the figures. The bracketed ranges, the words "robust" and "fragile", and "upper bound" are not explained at the place where they appear except for the "How the range in brackets is made" fold. The Public View glossary explains "Upper bound" in one plain sentence, which is the best wording I saw.
* Public View is the most readable page. The slip example is concrete ("Starting an 8 day stay on 2026-12-11 gives 5.9 d of sunlight. Starting 3 days later gives 8.0 d."), but it uses the same flat-horizon custom point (issue #181).
* The site works without errors on every page I opened at desktop size, and the pages whose footer I read (Home, Command Centre, Credits) carry the disclaimer; I did not check the footer on every page.

## Claude's opinion 2: does the amber "Upper bound" state and its numbers make sense to a mission planner?

My opinion as an AI assistant, based on what I saw and on the QuickMap comparison above; not a mission planner's view.
* The idea is right for planning: when the terrain is missing in some directions the real horizon can only be higher, so every sunlight and Earth number is a ceiling, and the page says so in plain words ("the real sunlight and Earth link can only be lower than shown"). It is shown in amber at the top of the Verdict card and again in exported summaries. I think a planner would accept that.
* The ranges next to the numbers are less clear. They are described as the result "if the terrain is slightly off". On `pgda-site04` the summary says plainly that the unseen relief "is pending-source, so the pessimistic edge does NOT include it and the result is an upper bound". A planner needs this: the bracket is not a confidence interval that contains the truth. The wording is there but it sits in a fold and in the TXT export; the card shows "5.6 d to 8.6 d" with no warning next to it.
* "Not viable" next to "robust" on a card that is also an upper bound on `pgda-site04` is correct and strong; the same site shows "Not viable" because the Earth link is 0 percent and the placeholder criteria need 50. A planner who has real needs can enter them, but the thresholds line says "chosen by you" even when nothing was chosen (issue #179). I would want that fixed before a planner reads it as their own requirement.
* The height comparison above gives me a reason for caution: at `pgda-site04` the app height differs from QuickMap's by 12 m and the slope by 2 to 3 deg, in a terrain model whose own stated height error is 0.19 m. I cannot say which model is right. If the skyline is built from the same grid as the app heights, a few metres of height difference at a rim could matter for a low Sun at 0.7 to 1.6 degrees elevation.
* The QuickMap shadow comparison agrees in all ten pre-registered rows, but all ten are cases where the app says "Sun down", so it says little about the wrong answer a planner would fear most (the app saying "up" where it is dark, or the reverse). The four post-hoc lit rows agreed in three and one could not be resolved.
* The Verdict "fragile" label showed up for a case where the displayed range did not reach the threshold (issue #183). If that is a real inconsistency, a planner would lose trust quickly.
* The Spacecraft page is honest about placeholders. I could not judge the power margin logic beyond the arithmetic (usable energy divided by load gives available hours, which matched: 800 Wh at 10 W is 80 h).
