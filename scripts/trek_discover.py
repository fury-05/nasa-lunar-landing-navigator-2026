"""Re-runnable Moon Trek discovery (P1-04). Lists south pole layers and flags elevation candidates.

Uses only the endpoints the official Trek API page (https://trek.nasa.gov/tiles/apidoc/) itself calls.
Usage: uv run python scripts/trek_discover.py > trek_layers_summary.txt
"""

import collections
import json
import urllib.request

BASE = "https://trek.nasa.gov/moon/TrekServices/ws/index/polar/listVisibleLayers"
SP = "urn:ogc:def:crs:IAU2000::30120"
URL = f"{BASE}?proj={SP}&start=0&rows=2147483647"

req = urllib.request.Request(URL, headers={"User-Agent": "LunarLandingSiteNavigator/0.0.1 (NASA Space Apps 2026)"})
docs = json.load(urllib.request.urlopen(req, timeout=60))["response"]["docs"]
products = [d for d in docs if d.get("itemType") == "product"]
print("layers listed:", len(docs), "products:", len(products))
print("by category:", dict(collections.Counter(d.get("productCat1") for d in products)))
print("by raster type and depth:", dict(collections.Counter((d.get("RASTER_TYPE"), d.get("PIXEL_DEPTH")) for d in products)))
print("\nTopography products (label | raster type | depth | resolution m/px):")
for d in sorted(products, key=lambda x: x["productLabel"]):
    if d.get("productCat1") == "Topography":
        print(f"  {d['productLabel']} | {d.get('RASTER_TYPE')} | {d.get('PIXEL_DEPTH')} | {d.get('resolution')}")
