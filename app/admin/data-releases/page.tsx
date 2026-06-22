import { AdminActionForm } from "../_action-form";
import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import {
  listAdminDataUploads,
  listDataReleases
} from "@/server/services/admin-service";

export default async function AdminDataReleasesPage() {
  const [{ data_releases: dataReleases, scoring_releases: scoringReleases }, uploads] =
    await Promise.all([listDataReleases(), listAdminDataUploads()]);

  return (
    <>
      <AdminPageHeader
        title="Data Releases"
        description="Review release state, publish or rollback releases, and register uploads for Phase 8 validation."
        action={
          <AdminActionForm
            endpoint="/api/admin/data/uploads"
            fields={[
              { name: "file_name", label: "File", placeholder: "sydney_suburbs_2026.csv" },
              { name: "file_type", label: "Type", placeholder: "suburb_metrics" },
              { name: "reason", label: "Reason", placeholder: "June data refresh" }
            ]}
            submitLabel="Register upload"
          />
        }
      />
      <section className="admin-section">
        <h2>Data Releases</h2>
        <AdminTable
          columns={[
            { key: "id", label: "ID" },
            { key: "key", label: "Release" },
            { key: "city", label: "City" },
            { key: "status", label: "Status" },
            { key: "publish", label: "Publish" },
            { key: "rollback", label: "Rollback" }
          ]}
          rows={dataReleases.map((release) => ({
            id: <ShortId value={release.id} />,
            key: release.releaseKey,
            city: release.city,
            status: <StatusPill value={release.status} />,
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
            { key: "status", label: "Status" }
          ]}
          rows={scoringReleases.map((release) => ({
            id: <ShortId value={release.id} />,
            key: release.releaseKey,
            model: release.modelRegistryVersion,
            table: release.scoringTableVersion,
            status: <StatusPill value={release.status} />
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
            { key: "actor", label: "Uploaded by" }
          ]}
          rows={uploads.map((upload) => ({
            id: <ShortId value={upload.id} />,
            file: upload.file_name,
            type: upload.file_type,
            status: <StatusPill value={upload.status} />,
            actor: upload.uploaded_by
          }))}
        />
      </section>
    </>
  );
}
