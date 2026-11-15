# Performance and quality audit of the web app (P7-02, issue #91)

Measured 2026-11-15 with Lighthouse 13.6.0 (mobile preset, simulated throttling, its defaults) driving Playwright's headless Chromium on the developer's Windows machine. Every number below is a measurement from that run, with the number of runs stated. Planning tool, not for flight operations.

## How it was measured, and what is not trustworthy

* Tool: `lighthouse@13.6.0`, installed in a scratch folder outside the repo (no dependency added). Browser: the `chrome-headless-shell` that Playwright installs.
* **The live site could only be measured intermittently.** Against `https://13-52-97-105.sslip.io` the Performance category failed with `NO_NAVSTART` (Lighthouse could not record the trace) in about 13 of every 14 attempts, on `/` and on `/command`. The same failure happens occasionally against a local server and against `example.com`, so it is a property of this Windows and Chromium setup and not of the site, but it means the live performance rows are **one run each**, not medians. The accessibility, best-practices and SEO categories ran fine on the live site.
* For before and after comparisons the built `dist` folders were served from a tiny local static server with gzip and the same cache headers as `infra/Caddyfile`, so the only difference between two runs is the code. Those rows are the median of 3 good runs. A local server has no network latency, so these are better than what a visitor on the internet sees; use them to compare builds, not as absolute numbers.
* Scores move by a few points between runs. A difference of 2 to 3 points between two builds is inside the noise.

## Live site (https://13-52-97-105.sslip.io), before any change in this task

| Page | Performance | Accessibility | Best practices | SEO | Runs |
|---|---|---|---|---|---|
| `/` | 93 | 100 | 100 | 91 | performance 1 run; the other three categories 1 run |
| `/command?site=pgda-site04` | 87 | 100 | 100 | 91 | performance 1 run; the other three categories 1 run |

Live performance detail (single runs):

| Page | FCP | LCP | TBT | CLS | Speed Index | TTI |
|---|---|---|---|---|---|---|
| `/` | 0.82 s | 0.82 s | 265 ms | 0.002 | 3.6 s | 1.6 s |
| `/command` | 0.78 s | 0.78 s | 459 ms | 0.057 | 3.3 s | 1.8 s |

The one failing audit outside performance, on both pages: **SEO `robots-txt`**. The live server answered `/robots.txt` with the app's `index.html` (the single page fallback), which Lighthouse rejects as an invalid robots file. Fixed in this task (see below); it needs a deploy to show on the live site.

Performance findings on the home page: unused JavaScript, estimated 70 KiB of the 114 KiB main script (the first bundle contained every screen), and one render-blocking stylesheet (6 KiB).

## Changes made in apps/web

1. **Route code splitting.** Home and the Command Centre stay in the first bundle. Credits, Compare, Slip, Spacecraft, Public and the site picker load on demand. Initial JavaScript went from **115.8 kB to 105.6 kB gzipped**.
2. **`public/robots.txt`** (allow all, disallow `/api/`), so the fallback no longer answers for it.
3. **Heading order on `/command`** (a Lighthouse accessibility audit, `heading-order`): the "Mission needs" and "What happens next" panels were `h3` directly under the page `h1`. They are now `h2`. After the fix `/command` scores 100 on accessibility.

### Something that was tried and rejected, with the numbers

Making the Command Centre lazy as well looked like a free win. It was measured and it was not: with the Command Centre as its own on-demand chunk, `/command` largest contentful paint rose from **0.77 s to 2.74 s** (median of 3, local server) because the page now waited for a second round trip before it could draw anything. It was put back in the first bundle. The comment in `src/App.tsx` records this so nobody redoes it.

## Before and after, same machine, same server, median of 3 good runs (local static server)

| Build | Page | Performance (3 runs) | FCP | LCP | TBT | CLS | JS transferred |
|---|---|---|---|---|---|---|---|
| before | `/` | 98, 95, 96 | 764 ms | 764 ms | 211 ms | 0.058 | 112.3 KiB |
| after | `/` | 100, 99, 98 | 755 ms | 755 ms | 123 ms | 0.055 | 102.4 KiB |
| before | `/command` | 98, 98, 94 | 769 ms | 769 ms | 121 ms | 0.083 | 112.3 KiB |
| after | `/command` | 95, 96, 93 | 783 ms | 783 ms | 218 ms | 0.083 | 102.4 KiB |
| rejected variant (Command Centre lazy) | `/command` | 90, 95, 93 | 762 ms | **2744 ms** | 186 ms | 0.052 | 106.4 KiB |

Reading it honestly:

* The home page improved a little (TBT 211 to 123 ms, JavaScript 10 KiB lighter). The scores are within a few points of each other and the runs overlap, so call it a small gain, not a proven one.
* **`/command` did not improve and may be slightly worse** (95, 96, 93 against 98, 98, 94; TBT 121 to 218 ms). Its score is within run-to-run noise, but there is no evidence of a gain. The split saves JavaScript for the other screens, and the Command Centre is the heavy one that stays in the first bundle.
* The Total Blocking Time on `/command` is the number to watch. It is a few hundred milliseconds of script on a page that draws a lot of SVG. Not addressed in this task.

## Accessibility, best practices and SEO per route (final build, local server, 1 run each)

| Route | Accessibility | Best practices | SEO | Failing audits |
|---|---|---|---|---|
| `/` | 100 | 100 | 100 | none |
| `/command?site=pgda-site04` | 100 | 100 | 100 | none (after the heading fix) |
| `/compare` | 100 | 100 | 100 | none |
| `/slip` | 100 | 100 | 100 | none |
| `/sites/pick` | 100 | 100 | 100 | none |
| `/spacecraft` | 100 | 100 | 100 | none |
| `/public` | 100 | 100 | 100 | none |
| `/credits` | 100 | 100 | 100 | none |

These were run against the API-less static build, so pages that need data show their loading or error states. Lighthouse therefore did not audit the results panels, the verdict chips, the timeline or the terrain view. The Playwright axe suite (`e2e/a11y.spec.ts`, 9 routes with mocked data) covers those, with zero serious or critical findings. The two together are the evidence; either one alone is not.

SEO 100 on the final build includes the new `robots.txt`. The live site still shows 91 until this is deployed.

## Bundle sizes (`npm run build`, final)

| File | Size | Gzipped |
|---|---|---|
| `index-*.js` (first load: Home, Command Centre, shell, router, API client) | 331.95 kB | **105.60 kB** |
| `PolarMap-*.js` (OpenLayers and proj4; only on `/sites/pick`) | 313.71 kB | 92.38 kB |
| `SitePicker-*.js` | 138.94 kB | 46.84 kB |
| `Public-*.js` | 13.74 kB | 4.98 kB |
| `Spacecraft-*.js` | 12.53 kB | 3.89 kB |
| `Slip-*.js` | 8.20 kB | 2.98 kB |
| `TerrainView-*.js` | 8.08 kB | 3.21 kB |
| `Compare-*.js` | 7.68 kB | 2.78 kB |
| `Credits-*.js` | 1.51 kB | 0.65 kB |
| `index-*.css` | 29.15 kB | 6.21 kB |
| `PolarMap-*.css` | 5.26 kB | 1.35 kB |

Against the budget in `docs/06-frontend-spec.md` ("route chunks under 250 KB gzipped except the 3D chunk"): every chunk is under 250 kB gzipped; the largest, `PolarMap`, is 92 kB. The first load, 105.6 kB gzipped, is the only chunk a visitor to `/` or `/command` downloads.

## Not done, and not verified

* No measured Lighthouse **performance** median for the live site. Single runs only, because of the `NO_NAVSTART` failures described above. The honest live performance figure is "87 to 93 on mobile emulation in the runs that completed".
* The spec target "first contentful paint under 2 s on a mid laptop on broadband" is met in every run here (about 0.8 s), but those runs used Lighthouse's throttling model, not a real mid laptop.
* The "Lighthouse accessibility at least 95" quality gate is met on every route audited (100), with the data-dependent panels covered by axe instead.
* `robots.txt` and the heading change are in the code but **not deployed**; the live scores above are from before them.
* Fonts: no change was made. Lighthouse's `font-display` insight passed (score 1) on the live home page, so there is no finding to act on.
* One render-blocking stylesheet (6 KiB gzipped, score 0.5 on the render-blocking insight) was reported on the live home page and left alone; inlining it was not tried.
* Total Blocking Time on `/command` (about 120 to 460 ms across runs) is unaddressed.
