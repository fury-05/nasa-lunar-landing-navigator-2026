# Roadmap (T3, not in the checklist)

Start only after the P7 gate passes. Each item gets its own issue, ADR and attribution entry.
1. Transfer module: Earth departure windows and lunar arrival, planning grade, using Horizons vector tables; feeds landing date and surface window.
2. DSN station visibility: Moon elevation from Earth stations via Horizons, combined with the lunar-side Earth visibility.
3. SPICE fallback engine behind a feature flag (NAIF kernels, last resort source) for offline resilience and an independent cross-check.
4. SI explainer for the Public View, text only, numbers always from the engine, clearly labelled.
5. Terrain-aware slope and hazard overlay at finer resolution for selected sites.
6. Saved workspaces, comments and sharing for science and engineering teams.
7. Additional languages for the Public View.
8. Moon globe with Trek equirectangular tiles and real Sun and Earth directions (was P5-03, ADR-0008).
9. Sky dome first-person view with skyline and discs (was P5-05, ADR-0008).
10. Mission objective presets, science versus engineering constraints (was P6-05, ADR-0008).
11. Saved scenarios and brief export: permalink, PNG, summary text (was P6-06, ADR-0008).
