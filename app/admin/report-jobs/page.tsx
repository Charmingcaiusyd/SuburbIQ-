import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import { listReportJobs } from "@/server/services/admin-service";

export default async function AdminReportJobsPage() {
  const jobs = await listReportJobs();

  return (
    <>
      <AdminPageHeader
        title="Report Jobs"
        description="Track queued, processing, retry, fallback, completed and failed report jobs."
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "user", label: "User" },
          { key: "suburb", label: "Suburb" },
          { key: "status", label: "Status" },
          { key: "attempts", label: "Attempts" },
          { key: "fallback", label: "Fallback" },
          { key: "created", label: "Created" }
        ]}
        rows={jobs.map((job) => ({
          id: <ShortId value={job.id} />,
          user: job.user_email,
          suburb: job.suburb,
          status: <StatusPill value={job.status} />,
          attempts: job.attempts,
          fallback: job.fallback_used ? "yes" : "no",
          created: job.created_at
        }))}
      />
    </>
  );
}
