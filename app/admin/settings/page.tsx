import { AdminActionForm } from "../_action-form";
import { AdminPageHeader } from "../_components";

export default function AdminSettingsPage() {
  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Super admin feature flags and report display controls with audited setting changes."
      />
      <section className="admin-section">
        <h2>Prediction Display</h2>
        <p className="muted">
          Submit indicator visibility as JSON booleans. The API writes an audit record now; persistent settings storage
          can be promoted in a later polish phase.
        </p>
        <AdminActionForm
          endpoint="/api/admin/settings/prediction-display"
          method="PUT"
          fields={[
            {
              name: "indicators",
              label: "Indicators",
              type: "json",
              defaultValue: JSON.stringify(
                {
                  growth_score: true,
                  rental_yield_score: true,
                  risk_score: true,
                  confidence_band: true
                },
                null,
                2
              )
            },
            { name: "reason", label: "Reason", placeholder: "Adjust public report indicators" }
          ]}
          submitLabel="Save setting"
        />
      </section>
    </>
  );
}
