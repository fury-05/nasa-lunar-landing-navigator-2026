# QuickMap deep links (P1-06)

Source id: `quickmap`. Observed 2026-11-14 on https://quickmap.lroc.im-ldi.com/ with a real browser session. We do not scrape QuickMap and we do not call private tile endpoints; links only open the public viewer.

## What is verified
* The site rewrites its own address bar. Opening the bare address produced this query (values shortened): `?prjExtent=-3681959.0551181,-1737400,3681959.0551181,1737400&earthShadowEnabled=true&proj=10&stack=3314&defs=N4IgzGCM...`
* `proj=10` is the default global view (the extent is 7363918 m wide by 3474800 m tall, which fits a whole-Moon equirectangular view). `proj=7` is also accepted and changes the view (the screenshot shows a different, regional-looking view); we have not identified what it is.
* `prjExtent` is four numbers `minX,minY,maxX,maxY` in the metres of the active projection. QuickMap adjusts it to the window aspect ratio (a request for a 200000 m square became 423847 m by 200000 m).
* `defs` is a compressed blob of layer definitions. We do not decode or generate it.
* The page script itself only reads one query flag directly: `fullscreen`.
* The search box is labelled "Type a lat,lon(,height) or search...". Our automated attempt to type coordinates into it (five tries) left the URL on the default view. That attempt did not prove the box ignores coordinates; the automation may simply not have triggered it, so how it works is unknown.

## What is NOT verified
* The `proj` value that selects the south polar stereographic view. We tried ids 1 to 12 in the URL; only 7 and 10 were kept, and neither was confirmed as south polar.
* A link that centres on a given latitude and longitude. Without the polar id and projection parameters we cannot compute `prjExtent` for a site.

Therefore the app must not generate coordinate-specific QuickMap links yet. Until the steps below are done, the "Open in QuickMap" button opens the plain viewer address and says so.

## Steps for Luz (human check, about 10 minutes)
1. Open https://quickmap.lroc.im-ldi.com/ and use the projection control in the left toolbar to choose the South Polar view.
2. Copy the address from the browser bar. Paste the full URL into this file under "Recorded permalinks" together with what it shows.
3. Search a known place (for example Shackleton crater) and paste the resulting URL too.
4. Note the `proj` value and the `prjExtent` numbers. We will use them to build links, checking that a link built from the pole tile centres in `data/sites.json` lands on the same place.

## Recorded permalinks
None yet (pending-source).
