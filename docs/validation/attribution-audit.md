# Attribution audit (P7-05)

Date: 2026-11-15. Performed by Claude (SI assistant) from the repository and the live site. Planning tool, not for flight operations. A person has not yet reviewed this audit.

## Method
1. List every external origin the web app and the Caddy config reference (`grep` over `apps/web/src`, `apps/web/index.html`, `infra/Caddyfile`).
2. List every committed binary asset (images, fonts, video) outside `docs/validation/evidence`.
3. List every data file the engine reads or the repo ships, from `data/MANIFEST.json`, `data/MANIFEST.far.json` and `data/content`.
4. Check each against `data/attribution.json` (the registry served by `GET /api/v1/attribution` and shown on `/credits`), and check the credit text shown beside the map.

## Findings
| Item | Where used | Registry id | Credit shown | Result |
|---|---|---|---|---|
| ssd.jpl.nasa.gov (Horizons API) | engine ephemeris client, recorded fixtures | horizons | Credits page; suggested citation recorded | covered |
| trek.nasa.gov tiles `LRO_WAC_Mosaic_SPole60_100m_v02` | site picker map | trek-moon | Map credit "The LROC Team, via NASA Moon Trek" (layer metadata credit is "The LROC Team"); caption under the map | covered; terms text pending-source |
| quickmap.lroc.im-ldi.com | outbound links only, no data copied | quickmap | Credits page | covered; terms pending-source |
| PGDA products 78, 81, 90 (LOLA DEM, ERR, EFFRES, mosaic) | engine terrain, `/terrain` endpoint | lola-dem, lola-dem-wide, lola-dem-87s | Credits page with Barker et al. citations | covered |
| PGDA product 69 | cross-check script only, not shipped | lola-illum | Credits page | covered |
| NSSDC Apollo table | landing coordinates and times in `data/sites.json` and validation tests | nssdc-apollo | Credits page | covered |
| NASA CLPS page | CLPS entries in `data/sites.json` | nasa-clps | Credits page | covered |
| CSA Moon exploration pages | Public View blurbs in `data/content/csa.json` (paraphrased, linked) | csa-moon | "Credit: Canadian Space Agency" beside the blurbs | covered; fit with CSA non-commercial terms needs human confirmation (A7) |
| Fonts Sora and IBM Plex Mono via `@fontsource` | UI | not data | listed in `NOTICE` and `docs/THIRD_PARTY_LICENSES.md` (OFL-1.1) | covered |
| Committed images, fonts files, video | none found outside validation evidence | n/a | n/a | none to credit |
| NASA logo or insignia | none found in `apps/web` | n/a | n/a | compliant with NASA media guidelines |
| Phrases such as "according to NASA" | none found in `apps/web/src`, `docs`, `README.md`, `NOTICE`, `data/content` | n/a | n/a | none found |

## Registry and notice consistency
* `python scripts/build_attribution.py --check` and `python scripts/build_notice.py --check` pass: `data/attribution.json` and the data section of `NOTICE` are generated from `docs/ATTRIBUTION.md`.
* `python scripts/gen_licenses.py --check` covers third-party software (393 packages at the last run).
* Usage terms were read on 2026-11-15 for Horizons, PGDA, NASA media rules, CSA, NSSDC and CLPS and recorded in `docs/ATTRIBUTION.md`. Moon Trek and QuickMap are the two sources that remain `pending-source` (listed in `unconfirmed_terms` by the API).

## Open points
1. NASA media guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media/) contain a section on AI ("Super Intelligence") products. Claude has only a summary, not the verbatim text. Irfan decides whether to add a line to the Credits page and README saying the product is not reviewed or endorsed by NASA (todo/APPROVALS.md A11). Nothing was changed.
2. The CSA non-commercial reading needs a human (A7).
3. The Moon Trek and QuickMap terms need a person with a browser (docs/luz-and-afreen-tasks.md, Task 3).
4. Not checked: tile images that Moon Trek serves beyond the one layer in use; layer credit for NAC or LOLA shading layers, which the app does not use.

## Result
No uncredited data source or asset was found. Two sources have unconfirmed terms and are flagged as such in the app. This audit is a repository and live-site review by Claude; it is not a legal opinion.
