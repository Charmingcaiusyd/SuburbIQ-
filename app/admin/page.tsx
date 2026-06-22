import { AdminPageHeader, AdminTable, MetricCard, StatusPill } from "./_components";
import { getAdminDashboard } from "@/server/services/admin-service";

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboard();
  const metrics = [
    ["Users", dashboard.kpis.users],
    ["Orders", dashboard.kpis.orders],
    ["Pending payments", dashboard.kpis.pending_payments],
    ["Failed jobs", dashboard.kpis.failed_report_jobs],
    ["Open tickets", dashboard.kpis.open_support_tickets],
    ["Reports", dashboard.kpis.reports]
  ] as const;

  return (
    <>
      <AdminPageHeader
        title="Admin Dashboard"
        description="Operational snapshot for users, commerce, report jobs, support and data releases."
      />
      <section className="metric-grid">
        {metrics.map(([label, value]) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </section>
      <section className="admin-section">
        <h2>Recent Data Releases</h2>
        <AdminTable
          columns={[
            { key: "release", label: "Release" },
            { key: "city", label: "City" },
            { key: "status", label: "Status" },
            { key: "published", label: "Published" }
          ]}
          rows={dashboard.recent_data_releases.map((release) => ({
            id: release.id,
            release: release.release_key,
            city: release.city,
            status: <StatusPill value={release.status} />,
            published: release.published_at ?? "n/a"
          }))}
        />
      </section>
    </>
  );
}
