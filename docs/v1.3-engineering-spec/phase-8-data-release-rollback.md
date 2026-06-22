# Phase 8 Data Upload, Release and Rollback

Implemented scope:

- Super Admin data upload metadata registration with optional inline JSON scoring rows.
- Upload validation for required scoring columns, duplicate SAL codes, unknown SAL codes and active suburb key relationships.
- Change report generation with changed, added, removed, affected suburb/postcode counts, critical warnings and sample diffs.
- Release candidate creation for `data_releases`, `scoring_releases` and `suburb_scoring_records` when validation passes.
- Publish workflow that activates candidate data/scoring releases and updates active map-layer release references.
- Rollback workflow that marks the published release and associated scoring releases as rolled back, restores map-layer release references to the previous published release, and keeps generated reports/report jobs intact.
- Data quality dashboard for freshness, row counts, blocked-report rows and confidence/data-quality flags.
- Template rollback endpoint for report template version rollback.
- Audit logging and Super Admin inbox notification on validation failure.

Local-first constraints:

- The current upload payload accepts JSON rows through the admin API/UI. CSV, Excel, Parquet, GeoJSON and object-storage ingestion are intentionally left for later storage/parser integration.
- Failed validation never publishes a candidate and the previous approved scoring table remains active.
- Existing generated reports stay locked to their original `data_release_id`, `scoring_release_id`, template versions and profile snapshot.

Key endpoints:

- `POST /api/admin/data/uploads`
- `POST /api/admin/data/uploads/[id]/validate`
- `GET /api/admin/data/quality`
- `POST /api/admin/data/releases/[id]/publish`
- `POST /api/admin/data/releases/[id]/rollback`
- `POST /api/admin/report-templates/[id]/rollback`
