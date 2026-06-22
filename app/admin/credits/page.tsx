import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import { listAdminCredits } from "@/server/services/admin-service";

export default async function AdminCreditsPage() {
  const credits = await listAdminCredits();

  return (
    <>
      <AdminPageHeader
        title="Report Credits"
        description="Latest report credit ledger entries across available, held, captured, released and expired states."
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "user", label: "User" },
          { key: "status", label: "Status" },
          { key: "order", label: "Order" },
          { key: "job", label: "Held job" },
          { key: "report", label: "Report" },
          { key: "created", label: "Created" }
        ]}
        rows={credits.map((credit) => ({
          id: <ShortId value={credit.id} />,
          user: credit.user_email,
          status: <StatusPill value={credit.status} />,
          order: <ShortId value={credit.source_order_id} />,
          job: <ShortId value={credit.held_by_report_job_id} />,
          report: <ShortId value={credit.captured_by_report_id} />,
          created: credit.created_at
        }))}
      />
    </>
  );
}
