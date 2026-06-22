import { AdminActionForm } from "../_action-form";
import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import { listAdminSubscriptions } from "@/server/services/admin-service";

export default async function AdminSubscriptionsPage() {
  const subscriptions = await listAdminSubscriptions();

  return (
    <>
      <AdminPageHeader
        title="Subscriptions"
        description="Monitor subscription quota usage and perform audited manual extensions."
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "user", label: "User" },
          { key: "product", label: "Product" },
          { key: "status", label: "Status" },
          { key: "quota", label: "Quota" },
          { key: "period", label: "Period end" },
          { key: "action", label: "Extend" }
        ]}
        rows={subscriptions.map((subscription) => ({
          id: <ShortId value={subscription.id} />,
          user: subscription.user_email,
          product: subscription.product_name,
          status: <StatusPill value={subscription.status} />,
          quota: `${subscription.reports_used}/${subscription.reports_limit}`,
          period: subscription.billing_period_end,
          action: (
            <AdminActionForm
              endpoint={`/api/admin/subscriptions/${subscription.id}/extend`}
              fields={[
                { name: "days", label: "Days", type: "number", defaultValue: "30" },
                { name: "reason", label: "Reason", placeholder: "Billing support extension" }
              ]}
              submitLabel="Extend"
            />
          )
        }))}
      />
    </>
  );
}
