# Web app (apps/web)

React, Vite, Tailwind, React Router. Talks to the API through a typed client generated from the
OpenAPI contract. Planning tool, not for flight operations.

## Checks

Run from `apps/web`:

```
npx eslint .
npx tsc -b --noEmit
npx vitest run
npm run build            # e2e runs against dist, so rebuild before every e2e run
npx playwright test
```

## Typed API fixtures for the e2e tests

The Playwright tests never call a real API. They answer each `/api/v1/...` request with a fixture.
All fixtures live in `e2e/fixtures.ts`, and each builder returns a type taken from the GENERATED
OpenAPI types:

```ts
import type { components } from "../src/api/schema";
type S = components["schemas"];

export const assessOut = (over: Partial<S["AssessOut"]> = {}): S["AssessOut"] => ({ ... });
```

Rules:

1. A spec never writes an API payload by hand. It calls a builder (`assessOut()`,
   `siteSummary("alpha")`, `timelineOut({ ... })`, and so on) and passes overrides as a `Partial` of
   the same schema type.
2. Responses go through `json(route, body, status)`, whose body type is whatever the builder
   returned, so a wrong shape is a compile error.
3. No `as` casts on a response payload. A cast is how a stale mock stays green. (The only casts
   are on request bodies read back from Playwright, see Known limits.)
4. `tsc -b` includes `e2e/` (see `tsconfig.json`), so a fixture that no longer matches the schema
   fails the same build step as the app code.

### What this protects against

When the API changes, regenerate the types:

```
cd packages/contracts
npm run generate        # writes apps/web/src/api/schema.d.ts from openapi.json
```

Then run `npx tsc -b --noEmit` in `apps/web`. A field that was added, removed or renamed in the
schema now breaks `e2e/fixtures.ts` at the exact builder that needs updating, and the app code that
reads the field, instead of leaving a hand-written mock that still passes. This was checked by
renaming `verdict_conclusive` in the schema: the build failed in `fixtures.ts` and in
`Metrics.tsx`.

### Known limits

- Fields the web reads that the schema does not have yet are added in one visible place in the test
  that needs them. Today that is `horizons_degraded` on `/ready` and `/version` (issue #151), added
  by `withHorizons` in `e2e/smoke.spec.ts`. Remove it when the API publishes the field.
- The PNG map tiles from Moon Trek are image bytes, not an API payload, so they stay a plain
  Playwright `fulfill`. Request bodies the tests read back (`postDataJSON`) are cast to the
  matching request schema (`S["SlipIn"]`, `S["CompareIn"]`, `S["LanderIn"]`). That cast is the one
  place a type is asserted rather than checked, because Playwright returns `unknown` there.
- Fixtures check shape, not meaning. A fixture can be well typed and still describe an impossible
  situation. The tests that matter for honesty (amber upper bound, terrain incomplete, null cells)
  build those states explicitly with `upperBound()` and `terrainOut({ complete: false })`.

## Live check of the terrain endpoint

```
node --experimental-strip-types scripts/live-terrain-check.mts https://<host>
```

Fetches every site's terrain from a deployed API and runs the app's own validation and shading code
on it. Not part of CI (it needs the network).
