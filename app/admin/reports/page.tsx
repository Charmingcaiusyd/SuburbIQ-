import { AdminActionForm } from "../_action-form";
import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import { listAdminReports } from "@/server/services/admin-service";

export default async function AdminReportsPage() {
  const reports = await listAdminReports();

  return (
    <>
      <AdminPageHeader
        title="Reports"
        description="Review generated reports and resend report links into the user's inbox."
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "title", label: "Title" },
          { key: "user", label: "User" },
          { key: "suburb", label: "Suburb" },
          { key: "status", label: "Status" },
          { key: "files", label: "Files" },
          { key: "action", label: "Resend" }
        ]}
        rows={reports.map((report) => ({
          id: <ShortId value={report.id} />,
          title: report.title,
          user: report.user_email,
          suburb: report.suburb,
          status: <StatusPill value={report.status} />,
          files: report.files_count,
          action: (
            <AdminActionForm
              endpoint={`/api/admin/reports/${report.id}/resend`}
              fields={[{ name: "reason", label: "Reason", placeholder: "Customer requested link" }]}
              submitLabel="Resend"
            />
          )
        }))}
      />
    </>
  );
}
