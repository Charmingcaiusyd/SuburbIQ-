import { AdminPageHeader, AdminTable, ShortId } from "../_components";
import { listAuditLogs } from "@/server/services/admin-service";

export default async function AdminAuditLogsPage() {
  const logs = await listAuditLogs();

  return (
    <>
      <AdminPageHeader
        title="Audit Logs"
        description="Immutable admin access and mutation trail for refunds, profile access, templates, releases and settings."
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "actor", label: "Actor" },
          { key: "role", label: "Role" },
          { key: "action", label: "Action" },
          { key: "target", label: "Target" },
          { key: "reason", label: "Reason" },
          { key: "created", label: "Created" }
        ]}
        rows={logs.map((log) => ({
          id: <ShortId value={log.id} />,
          actor: log.actor_email ?? "system",
          role: log.actor_role,
          action: log.action_type,
          target: `${log.target_type}:${log.target_id?.slice(0, 8) ?? "n/a"}`,
          reason: log.reason ?? "n/a",
          created: log.created_at
        }))}
      />
    </>
  );
}
