# Phase 6 Report Job Queue, LLM Generation and Fallback

Implemented in this phase:

- `POST /api/reports/generate` now creates database-backed `report_jobs`.
- Paid generation validates:
  - authenticated user
  - buyer profile completeness >= 60
  - database-confirmed suburb/postcode relationship
  - active published scoring/data release
  - `report_generation_allowed_flag`
  - low-confidence acknowledgement
  - selected entitlement: credit, subscription or paid order
- Credit entitlement is held when the job is created.
- Paid order entitlement moves from `paid` to `report_generating`.
- Subscription entitlement is reserved and quota is captured when the report completes.
- `GET /api/report-jobs/[id]` returns job status, suburb, postcode and generated report/file metadata.
- `POST /api/report-jobs/[id]/process` simulates the queue worker for local development.
- Worker state flow follows V1.3:
  - `queued`
  - `processing`
  - `llm_generation_started`
  - `llm_retry_1`
  - `llm_retry_2`
  - `llm_retry_3`
  - `fallback_template_used`
  - `rendering_html`
  - `rendering_pdf`
  - `completed` or compensation state
- Mock LLM output is validated for required section structure.
- If mock LLM fails three times, deterministic fallback output is used.
- If fallback fails, held credit is released or order is marked failed.
- Completed reports create immutable `reports` records.
- HTML/PDF mock files are recorded in `report_files`.
- PDF metadata is marked watermarked.
- Completion creates an inbox notification.
- `GET /api/reports`, `/api/reports/[id]` and `/api/reports/[id]/download` now read generated report records.
- `POST /api/reports/free-preview` returns a preview-only report response without paid prediction data or PDF.

Deferred:

- Real BullMQ/Redis worker.
- Real OpenAI API integration.
- Real HTML/PDF renderer.
- Real S3-compatible file upload.
- Admin retry controls.
- Public share links.

Worker smoke examples:

```bash
curl -X POST http://localhost:3000/api/report-jobs/<job_id>/process \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{}"
```

Force LLM failure but fallback success:

```bash
curl -X POST http://localhost:3000/api/report-jobs/<job_id>/process \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{\"force_llm_failure\":true}"
```

Force LLM and fallback failure:

```bash
curl -X POST http://localhost:3000/api/report-jobs/<job_id>/process \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d "{\"force_llm_failure\":true,\"force_fallback_failure\":true}"
```
