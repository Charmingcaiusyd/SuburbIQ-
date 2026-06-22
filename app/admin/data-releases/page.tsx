import { AdminActionForm } from "../_action-form";
import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import {
  getDataQualityDashboard,
  listAdminDataUploads,
  listDataReleases
} from "@/server/services/admin-service";

export default async function AdminDataReleasesPage() {
  const [
    { data_releases: dataReleases, scoring_releases: scoringReleases },
    uploads,
    quality
  ] = await Promise.all([
    listDataReleases(),
    listAdminDataUploads(),
    getDataQualityDashboard("Sydney")
  ]);

  return (
    <>
      <AdminPageHeader
        title="Data Releases"
        description="Validate uploaded scoring rows, review change reports, publish approved releases, and rollback without deleting locked reports."
        action={
          <AdminActionForm
            endpoint="/api/admin/data/uploads"
            fields={[
              { name: "file_name", label: "File", placeholder: "sydney_suburbs_2026.csv" },
              { name: "file_type", label: "Type", placeholder: "suburb_metrics" },
              { name: "city", label: "City", defaultValue: "Sydney" },
              {
                name: "rows",
                label: "Rows JSON",
                type: "json",
                placeholder: "[{\"sal_code\":\"SAL123\",\"latest_year\":2026,...}]"
              },
              { name: "reason", label: "Reason", placeholder: "June data refresh" }
            ]}
            submitLabel="Register upload"
          />
        }
      />
      <section className="metric-grid">
        <MetricTile label="Active release" value={quality.active_release_key ?? "n/a"} />
        <MetricTile label="Freshness" value={quality.freshness} />
        <MetricTile label="Rows" value={quality.row_count} />
        <MetricTile label="Blocked" value={quality.report_blocked_count} />
      </section>
      <section className="admin-section">
        <h2>Quality Flags</h2>
        <AdminTable
          columns={[
            { key: "flag", label: "Flag" },
            { key: "count", label: "Count" }
          ]}
          rows={Object.entries(quality.flags).map(([flag, count]) => ({
            id: flag,
            flag,
            count
          }))}
        />
      </section>
      <section className="admin-section">
        <h2>Data Releases</h2>
        <AdminTable
          columns={[
            { key: "id", label: "ID" },
            { key: "key", label: "Release" },
            { key: "city", label: "City" },
            { key: "status", label: "Status" },
            { key: "lineage", label: "Lineage" },
            { key: "publish", label: "Publish" },
            { key: "rollback", label: "Rollback" }
          ]}
          rows={dataReleases.map((release) => ({
            id: <ShortId value={release.id} />,
            key: release.releaseKey,
            city: release.city,
            status: <StatusPill value={release.status} />,
            lineage: `${release._count.scoringReleases} scoring / ${release._count.reportJobs} jobs`,
            publish: (
              <AdminActionForm
                endpoint={`/api/admin/data/releases/${release.id}/publish`}
                fields={[{ name: "reason", label: "Reason", placeholder: "Validated for production" }]}
                submitLabel="Publish"
              />
            ),
            rollback: (
              <AdminActionForm
                endpoint={`/api/admin/data/releases/${release.id}/rollback`}
                fields={[{ name: "reason", label: "Reason", placeholder: "Rollback required" }]}
                submitLabel="Rollback"
              />
            )
          }))}
        />
      </section>
      <section className="admin-section">
        <h2>Scoring Releases</h2>
        <AdminTable
          columns={[
            { key: "id", label: "ID" },
            { key: "key", label: "Release" },
            { key: "model", label: "Model" },
            { key: "table", label: "Table" },
            { key: "status", label: "Status" },
            { key: "rows", label: "Rows" },
            { key: "jobs", label: "Jobs" }
          ]}
          rows={scoringReleases.map((release) => ({
            id: <ShortId value={release.id} />,
            key: release.releaseKey,
            model: release.modelRegistryVersion,
            table: release.scoringTableVersion,
            status: <StatusPill value={release.status} />,
            rows: release._count.scoringRows,
            jobs: release._count.reportJobs
          }))}
        />
      </section>
      <section className="admin-section">
        <h2>Uploads</h2>
        <AdminTable
          columns={[
            { key: "id", label: "ID" },
            { key: "file", label: "File" },
            { key: "type", label: "Type" },
            { key: "status", label: "Status" },
            { key: "validation", label: "Validation" },
            { key: "change", label: "Change report" },
            { key: "actor", label: "Uploaded by" },
            { key: "action", label: "Validate" }
          ]}
          rows={uploads.map((upload) => ({
            id: <ShortId value={upload.id} />,
            file: upload.file_name,
            type: upload.file_type,
            status: <StatusPill value={upload.status} />,
            validation: <StatusPill value={String(upload.validation_status ?? "pending")} />,
            change: `${upload.changed_rows_count ?? 0} changed / ${upload.added_rows_count ?? 0} added / ${upload.removed_rows_count ?? 0} removed`,
            actor: upload.uploaded_by,
            action: (
              <AdminActionForm
                endpoint={`/api/admin/data/uploads/${upload.id}/validate`}
                fields={[
                  { name: "city", label: "City", defaultValue: "Sydney" },
                  {
                    name: "rows",
                    label: "Rows JSON",
                    type: "json",
                    placeholder: "[{\"sal_code\":\"SAL123\",\"latest_year\":2026,...}]"
                  },
                  { name: "reason", label: "Reason", placeholder: "Validate uploaded dataset" }
                ]}
                submitLabel="Validate"
              />
            )
          }))}
        />
      </section>
    </>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
