# User guide

Live app: https://13-52-97-105.sslip.io

**Planning tool, not for flight operations.** Read every number together with its uncertainty and its terrain warning.

## What the tool answers
For a site near the lunar south pole and a time window: how much of the time is the Sun above the local skyline (power), and how much of the time is Earth above it (direct-to-Earth line of sight)? "Skyline" means the real horizon made of hills and crater rims, not a flat line.

## Where things are
The top bar has: Home, Command Centre, Pick a site, Spacecraft, Public View and Credits. New to the Moon? Start with the Public View. Planning? Use the Command Centre.

## Command Centre (`/command`)

### Choose what to look at
* **Site**: pick from the list. Sites named "pgda-..." are derived tile centres from NASA LOLA south pole products, not landing sites. "custom-..." entries are points someone built with the site picker.
* **Start date (UTC)**: 2026-12-01 to 2029-11-01. All times in the app are UTC.
* **Length**: 3, 8, 15 or 30 days.
* **Pick another site on the map** opens the site picker.
The choices are stored in the address, so you can share the link and the same view opens.

### Site facts and the terrain chip
The header card shows the site id, latitude (negative is south), longitude (east positive), where the coordinates came from, the tile coverage radius and the terrain reach. The chip next to the name says what terrain data exists:
* "Terrain available, extends X km in every direction" means the height data reaches at least that far all around.
* "Terrain incomplete: covers N% of directions, reach A to B km" means the height data ends before the distance the check needs. Hills farther away are missing, so the horizon drawn can only be too low.
* "Flat horizon, not terrain aware" means no height data covers the site at all.

### The verdict
The Verdict panel gives one label and a robust or fragile tag:
* **Viable**, **Marginal** and **Not viable** compare the results with your mission needs (below). The default needs are placeholders, not mission requirements; the panel says "default placeholders" until you change them.
* **Robust** means the label stays the same when the skyline is moved slightly up and down. **Fragile** means it changes inside that range. A fragile card says which measure does it, under "Why is this fragile?". The verdict has two lines for each need, the need itself and a marginal line (the need relaxed by 20 percent), so a result can be below the need in every run and still be fragile when the range crosses the marginal line.
* **Upper bound, terrain incomplete** (amber, with a "!" mark) replaces a good result when terrain is missing. It means: the true sunlight and Earth link can only be lower than shown, so do not read it as a pass. No robust or fragile tag is given then. A "Not viable" result stays "Not viable" even with missing terrain, because missing terrain can only make things worse.

The state is never shown by colour alone: each chip carries a symbol and words.

### Metrics and the range in brackets
Each row shows a nominal value and, when it differs, a range in brackets.
* **Sunlight**: hours with at least half of the Sun's disc above the skyline. **Sun share** is that as a share of the window.
* **Longest dark spell**: longest unbroken stretch with less than half of the Sun visible.
* **Earth link share**: share of the window with Earth's centre above the skyline. Line of sight only: antennas, radio power and ground stations are not modelled.
* **Longest Earth outage**: longest unbroken stretch with Earth hidden.
* **Sun elevation** (min, mean, max): angle of the Sun's centre above the flat horizon.
Open "How the range in brackets is made" for the basis. The range repeats the calculation with the skyline shifted up and down by an assumed error (the engine specification starts at not less than 0.1 degrees until validated). It does not include terrain that is missing; that is what the upper bound state is for. The "Read this first" box above the panels lists any warnings from the server.

### Mission needs
Four editable thresholds: minimum sunlight (% of window), maximum dark spell (hours), minimum Earth link (% of window), and an optional maximum Earth outage (hours; empty means no limit). Change them and apply; the verdict and the link update. Defaults are placeholders (50 percent, 100 hours, 50 percent, none) until a mission sets real ones.

### The time scrubber and countdown chips
Drag the scrubber, or focus it and use the arrow keys (one timeline sample, which is 60 minutes in the Command Centre) and Page Up or Page Down (one day). The views follow the selected time. The chips show "Sunset in ..." or "Sunrise in ..." and the same for Earth, with the UTC time. Sunrise and sunset mean half of the Sun's disc crossing the skyline.

### Sky from the site
A polar plot looking up: north at the top, east on the left (as when you lie on your back and look at the sky). Grey is terrain. The amber disc is the Sun and the blue disc is Earth, both drawn larger than true size. A faded disc is hidden behind terrain. Rings are at 10 and 20 degrees of elevation.

### Horizon strip
Azimuth (compass direction) runs left to right: north, east, south, west. Elevation is shown from 0 to 15 degrees. The grey shape is the skyline. The amber line is the Sun's track and the dashed blue line is Earth's track over the whole window; the discs mark the selected time. Where a track runs below the grey shape, that body is hidden. This is the most direct picture of why a site gets or loses light.

### Local terrain
A tile of height data around the site, shaded by the real Sun direction at the scrubber time. Two modes: "2D shaded map" and "3D view" (a tilted drawing on a canvas, with a rotation control). Vertical exaggeration is labelled ("heights drawn N times too tall") and exists only to make relief visible. If no tile exists for the site you see a message instead, and an optional preview of a synthetic surface that is clearly marked as not real terrain and not to be used for any decision.

### Timeline
Four strips over the window: Sun up, Earth link, Sun dark and Earth outage, with a marker at the scrubber time. Each strip has a text alternative for screen readers, and its colour is also named in the row label.

### Open in QuickMap
Each site card has "Open in QuickMap at this site and time (new tab)". It opens the public LROC QuickMap south polar view at the site and the selected time. Use it to compare our lit or shadowed state with QuickMap's terrain shadow layer. Our points are derived tile centres and the QuickMap view is a window of a few kilometres around them. The link is built by the API and checked against QuickMap's own address format ([docs/data/quickmap-links.md](data/quickmap-links.md)). QuickMap is a separate service with its own terms and accuracy.

## Pick a site (`/sites/pick`)
Shows the Moon Trek wide angle mosaic in a south polar view (60 S to the pole). Click an existing marker to open that site in the Command Centre. Click empty ground, or type a latitude and longitude, to build a custom site. Rules: latitude from -89.999 to -60, longitude from -180 to 180 with east positive. The server runs a job (Horizons plus terrain), shows progress, and the new site then opens. A custom site only has terrain if its point falls inside a downloaded height tile; otherwise it is flat-horizon and says so.

## Public View (`/public`)
A short story: why the pole is hard, what Sun and Earth do there, how a ridge hides the Sun, why a three day slip matters (with a live example from the same engine), a glossary, and links to Canadian Space Agency pages. The Simple and Detailed buttons change the amount of explanation. The same upper bound label appears when terrain is incomplete.

## Spacecraft Dashboard (`/spacecraft`)
Compares a site's longest dark spell and longest Earth outage with four lander assumptions: battery capacity, reserve kept unused, constant dark-period load, and autonomy without contact. **The default values are made-up placeholders** (1000 Wh, 20 percent, 10 W, 48 h) and the page says so. Replace them with your own figures. The arithmetic is a flat energy sum with no charging, temperature or ageing. It is not a battery simulation.

## Credits (`/credits`)
Lists every data source with publisher, credit text, usage statement and whether its terms are confirmed. "pending-source" means a person has not yet read and confirmed the terms.

## Reading uncertainty honestly
1. **Terrain incomplete** is the biggest limit today. The terrain now reaches about 146 to 300 km depending on the direction, but never the full 300 km in every direction, so the chip still says incomplete. Check it first.
2. **The range in brackets** covers an assumed skyline error, not every error. The skyline error and the Moon orientation (frame) error used are assumptions in the specification, not measurements.
3. **Derived points.** Curated PGDA sites are tile centres, which may sit on a crater floor or a wall shadow.
4. **Line of sight only.** An "Earth link" is geometry, not a communications budget.
5. **Validation is partial.** Sun direction was compared with NASA's printed Apollo landing values and illumination with a PGDA map on a few points, and the findings are in docs/validation/REPORT.md. Height, slope and lit or shadowed checks against QuickMap by a person are not yet recorded. Treat results as planning-grade.

## Keyboard and accessibility
All controls are reachable with Tab. Controls have visible focus rings and labels. The scrubber answers to arrow and Page keys. Charts have text descriptions. Automated accessibility checks (axe, WCAG 2 A and AA) pass on every page; no screen reader test has been done by a person, so report problems as GitHub issues.

## Glossary
* **Azimuth**: compass direction, 0 degrees north, 90 east, 180 south, 270 west.
* **Elevation**: angle above the horizontal.
* **Skyline**: the highest elevation of terrain in each direction, as seen from the site.
* **UTC**: Coordinated Universal Time, used everywhere in the app.
* **Dark spell**: unbroken period with less than half of the Sun's disc visible.
* **Earth outage**: unbroken period with Earth hidden below the skyline.
* **Upper bound**: a value the truth can only match or fall below.
