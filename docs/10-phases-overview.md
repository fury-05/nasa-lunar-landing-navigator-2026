# Phases and time boxes

T0 is the time the start gate passes. Times are targets for two collaborators working in parallel. Cut line: P0 to P5 must be DONE by T0+30h; P6 and P7 fill the rest; freeze features at T0+36h; submit with margin before the deadline (submission closes 15 November 2026 11:59 PM local time).

| Phase | Name | Window | Tier | Track A (Irfan) | Track B (Afreen) | Track C (Member 3) |
|---|---|---|---|---|---|---|
| P0 | Foundations and walking skeleton | T0 to +1.5h | T1 | repo, CI, VM, deploy | tooling, design tokens, shell | onboarding, ATTRIBUTION seed review |
| P1 | Data access and catalogue | +1.5 to +5h | T1 | Horizons client, DEM, manifests | site catalogue | Trek discovery, QuickMap links, CSA content |
| P2 | Engine and validation | +4 to +14h | T1 | skyline, visibility, events, metrics | validation suite code, fixtures | human QuickMap and Trek spot checks |
| P3 | API and jobs | +8 to +15h | T1 | routes, DB, queue, deploy | OpenAPI contract review, client generation | API docs review |
| P4 | Command Centre | +6 to +22h | T1 | API support | all UI against mock then real API | usability testing notes |
| P5 | Visualisations | +16 to +28h | T1 | terrain and tile APIs | polar map, local 3D, mission clock | globe, sky dome, 3D performance |
| P6 | Spacecraft Dashboard, Public View, lander | +22 to +33h | T1/T2 | lander engine, saved scenarios | Spacecraft Dashboard | Public View story, objective presets |
| P7 | Hardening and submission | +30h to end | T1 | drills, security, ops, final deploy | accessibility, performance | attribution audit, docs, demo assets |
Parallel rule: web work starts from the OpenAPI contract with mock data as soon as P3-01 publishes it. Sync points are merges to main and UPDATES.md.
Gates: phase ends only when all its rows are DONE, CI is green, the VM has the deployed build, and a tag is pushed.
Stretch (ROADMAP.md) starts only after the P7 gate passes.
