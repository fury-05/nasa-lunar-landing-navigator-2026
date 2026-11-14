# Engine specification (planning grade, deterministic)

Constants: lunar reference radius R = 1737.4 km (the sphere Horizons uses for the Moon). Sun radius 695700 km. Earth radius 6371.0 km for the disc. Solar constant 1361 W/m2 at 1 AU, scaled by 1/delta^2.

## 1. Ephemeris layer (Horizons)
Request per site, per body (Sun id 10, Earth id 399), in chunks of at most 30 days at 10 min steps:
`COMMAND='10'|'399'`, `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='<lon_east>,<lat>,<alt_km>'`, `EPHEM_TYPE='OBSERVER'`, `START_TIME`, `STOP_TIME`, `STEP_SIZE='10m'`, `QUANTITIES` including apparent azimuth and elevation, observer range and target angular diameter (confirm the quantity codes in the Horizons manual and record them in ADR-0004), `CSV_FORMAT='YES'`, `TIME_DIGITS='SECONDS'`, `APPARENT='AIRLESS'`, `format='json'`.
Rules: check `signature.version` equals the version recorded in the manifest; parse only between `$$SOE` and `$$EOE`; treat any error text in the payload as failure even with HTTP 200; URL length under about 2000 characters (use the POST file API otherwise); retries with backoff on 500 and 503; idempotent cache key = sha256 of the normalised request.
Frame check (ADR-0004): read the header lines about the center body pole and frame in the first response and store them in provenance. Horizons and LOLA products may use different lunar frames (principal axis versus mean Earth); record the assumption and the resulting position uncertainty (order of 0.03 degrees of orientation) in the error budget. Never silently assume.
Convention tests (must pass before any other engine work): east versus west longitude (a site at 30 E has Earth to the west, azimuth near 270; at 30 W near 90); Earth elevation near the zenith at the sub-Earth point; Sun elevation range at the poles within a few degrees.

## 2. Terrain layer (skyline)
Input DEM in polar stereographic (mean Earth frame) as a COG pyramid: near tier to 20 km at the finest available resolution, mid tier to 100 km, far tier to 400 km. Heights are relative to the R sphere.
For observer eye height H0 = z0 + h (h default 1.0 m for arrays, 5.0 m for antennas) and azimuth a (0 to 360 step 0.25 degrees, north 0 clockwise), cast a ray. For each sample at great-circle distance d with terrain height zp and theta = d/R:
`elev = atan2((R+zp)*cos(theta) - (R+H0), (R+zp)*sin(theta))`
Skyline(a) = max over samples, floored by the sphere dip `-acos(R/(R+H0))`. Sample spacing never exceeds the pixel size of the tier in use; use bilinear interpolation; flag voids. Record per azimuth the maximum range reached and mark sectors where DEM coverage ended before the geometric limit (provenance `skyline_extent_km`). Typical limits: peaks 100 km away at 3 km height still reach about 0.07 degrees, which matters at the pole, so far tiers are mandatory.
Implementation: numba JIT with parallel azimuths. Targets: precomputed lookup under 5 ms; cold custom site under 3 s on 4 vCPU.

## 3. Disc visibility
Sun and Earth are discs, not points. Angular radius rho = asin(Rbody / distance). Visible fraction = area of the disc above the skyline divided by disc area, integrated over azimuth offsets x in [-rho, rho] with skyline h(x) (at least 33 slices): visible height at x = clamp((el_c + s) - max(h(x), el_c - s), 0, 2s) with s = sqrt(rho^2 - x^2). No refraction (airless). Cross-check angular sizes against the Horizons angular diameter quantity.

## 4. Time series and events
Unwrap azimuth, interpolate 10 min samples with cubic Hermite (Catmull-Rom derivatives) to 1 min; refine events by bisection to 1 s. Events per site: sunrise (fraction crosses 0.01 upward), sunset, Earthrise, Earthset, plus intervals: Sun only, Earth only, both, neither. Time remaining = next downward crossing minus now.

## 5. Metrics (per site, window, height)
- Sun: visible-time share (disc fraction at least 0.5 by default, configurable), sunlight hours, longest dark interval, elevation min, mean and max.
- Power index per array mode: horizontal deck `f*max(sin(el),0)`, vertical sun tracking `f*cos(el)` for el in [0,90], both scaled by 1361/delta^2. Report as relative index and, with lander parameters, watts.
- Earth: visible share, windows list, longest outage. Direct-to-Earth available when the Earth disc centre is above skyline plus a mask angle (default 0 degrees, user adjustable). The DSN station layer is roadmap.
- Slope statistics inside a user radius when a slope grid exists.

## 6. Sensitivity band
Every metric is computed three times with skyline offsets of minus, zero and plus delta. Default delta = sqrt(skyline_error^2 + frame_error^2) from the error budget, never below 0.1 degrees until validated. The UI shows nominal and band. A verdict is "robust" only if the band does not change it.

## 7. Error budget (fill with measured values in docs/validation/REPORT.md)
| Source | Initial assumption | How to measure |
|---|---|---|
| Ephemeris geometry | below 0.01 deg | Compare cached series with a fresh Horizons call |
| Frame and site position | up to 0.03 deg | ADR-0004 evidence |
| DEM resolution and vertical error | 0.05 to 0.2 deg | Compare skylines using two resolutions |
| Time step interpolation | below 0.005 deg | Compare 10 min Hermite against 1 min Horizons |
| Disc model | none (exact) | Analytic test cases |

## 8. Validation suite (required, automated where possible)
1. Convention and frame tests (above).
2. Flat-horizon sunrise and sunset versus Horizons RTS with `STEP_SIZE='1m RAD'`: agreement within 2 minutes.
3. Published mission landing conditions from NASA records for Apollo sites (cite the NASA page): Sun elevation at landing within 0.5 degrees.
4. Terrain: at 5 sites compare height and slope with the QuickMap Object Inspector; at 3 sites compare three skyline azimuths with Trek elevation profiles. Record permalinks and screenshots in docs/validation/quickmap-checks.md (human step, Claude prepares the checklist).
5. Illumination: at 5 date-time pairs compare lit or shadowed state at a site with the QuickMap illumination layer.
6. Property tests (hypothesis): skyline never below sphere dip; raising h never lowers visibility; visible fraction in [0,1]; rotation of azimuth by 360 returns same value.
7. Analytic disc tests: horizon through centre gives 0.5; fully above gives 1.
8. Golden regression files with data versions; any drift needs an ADR.
Report: docs/validation/REPORT.md with method, numbers, limits. No claim of accuracy without it.
