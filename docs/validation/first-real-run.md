# First real run (P2-09), site pgda-site04, 30 days from 2026-12-01

Not a validation. This is what the pipeline produced on real inputs the first time, kept so reviewers can see numbers before any claim is made. Real inputs: Horizons API 1.2 Sun and Earth series at 10 minute steps for the tile centre (-89.7668, -171.8699), and the PGDA 5 m height tile (sha256 38ff70db...). Built 2026-11-14T20:02:41Z by `scripts/precompute_sites.py`.

## What the engine reported
* Terrain: the site ground is 769.7 m above the reference sphere. Skyline over 1440 azimuths: minimum -0.06, mean 12.28, maximum 32.39 degrees. Rays reached 7995 to 11285 m; no azimuth reached the 16 km request, because the tile ends first.
* Sun (disc centre) stays between 0.94 and 1.67 degrees elevation for the whole 30 days, and its azimuth sweeps all around.
* Earth rises to at most 6.13 degrees, azimuth 164 to 179. The skyline at those azimuths is 3.5 to 12.2 degrees. Best margin of Earth over the skyline is -2.15 degrees, so the Earth link is never available in this month at this point.
* Eight day windows: days 0 to 8 give 0.0 sunlight hours, days 10 to 18 give 180.4 h (band 178.9 to 181.8), days 20 to 28 give 28.3 h. Longest dark spans 192 h, 11.6 h and 163.7 h.

## How to read it, and what it does NOT show
* Plausible in kind: low Sun, long shadows and strong date dependence are what the challenge describes for the pole. The values are NOT validated: no comparison with QuickMap illumination or an independent skyline has been done (tasks P2-10, P2-11).
* The tile centre is a derived point, not a landing site, and may sit on a crater floor or in a wall shadow. The result is for that point and a 1 m eye only.
* Terrain beyond about 8 to 11 km is missing (approval A2). Missing distant terrain can only make the true skyline higher, so the true Sun and Earth numbers can only be equal or lower than reported.
* The Earth result could hinge on the 0.2 degree skyline error assumption only if the margin were small; here it is 2.15 degrees, so the "never visible" outcome is not a band edge effect.
* Sun threshold 0.5 of the disc and Earth mask 0 degrees are defaults. Viability labels use placeholder criteria (approval A8) and mean nothing yet.
