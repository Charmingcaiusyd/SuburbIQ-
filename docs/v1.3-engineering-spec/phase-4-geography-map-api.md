# Phase 4 Suburb/Postcode Search and Map Data API

Implemented in this phase:

- `GET /api/suburbs/search?q=...` reads confirmed `suburb_postcode_relationships`.
- Search only returns rows where relationship, suburb and postcode are active/selectable.
- Suburb-name search uses case-insensitive `sal_name` matching.
- Postcode search uses postcode prefix matching for 3-4 digit input.
- Search results include report availability from the active published scoring release.
- `GET /api/suburbs/[suburbId]/preview` returns public/free-safe preview data.
- Preview excludes `prediction_json` so paid prediction data is not leaked.
- `GET /api/map/layers` returns database-backed map layer metadata by entitlement.
- Anonymous users receive public layers.
- Logged-in non-subscribers receive public/free layers.
- Logged-in active subscribers receive public/free/paid layers.
- Seed data now includes Sydney / 2000, one published data/scoring release and base/free/paid map layers.

Deferred:

- Mapbox/deck.gl UI rendering.
- Geometry/tile serving.
- Data upload and release management UI.
- Paid report generation from selected relationship.

Smoke checks after local setup:

```bash
curl "http://localhost:3000/api/suburbs/search?q=Sydney"
curl "http://localhost:3000/api/suburbs/search?q=200"
curl "http://localhost:3000/api/map/layers"
```
