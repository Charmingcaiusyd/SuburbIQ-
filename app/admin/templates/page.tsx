import { AdminActionForm } from "../_action-form";
import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import { listAdminReportTemplates } from "@/server/services/admin-service";

export default async function AdminTemplatesPage() {
  const templates = await listAdminReportTemplates();

  return (
    <>
      <AdminPageHeader
        title="Report Templates"
        description="Inspect and update report template versions. LLM prompt editing remains separate from this Phase 7 surface."
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "key", label: "Template" },
          { key: "version", label: "Version" },
          { key: "active", label: "Active" },
          { key: "action", label: "Update" }
        ]}
        rows={templates.map((template) => ({
          id: <ShortId value={template.id} />,
          key: template.templateKey,
          version: template.version,
          active: <StatusPill value={template.activeFlag ? "active" : "inactive"} />,
          action: (
            <AdminActionForm
              endpoint={`/api/admin/report-templates/${template.id}`}
              method="PUT"
              fields={[
                {
                  name: "template_json",
                  label: "JSON",
                  type: "json",
                  defaultValue: JSON.stringify(template.templateJson, null, 2)
                },
                { name: "active_flag", label: "Active", type: "checkbox", defaultChecked: template.activeFlag },
                { name: "reason", label: "Reason", placeholder: "Template correction" }
              ]}
              submitLabel="Save"
            />
          )
        }))}
      />
    </>
  );
}
