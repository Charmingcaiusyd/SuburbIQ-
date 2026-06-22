import { AdminActionForm } from "../_action-form";
import { AdminPageHeader, AdminTable, ShortId, StatusPill } from "../_components";
import { listAdminCoupons } from "@/server/services/admin-service";

export default async function AdminCouponsPage() {
  const coupons = await listAdminCoupons();

  return (
    <>
      <AdminPageHeader
        title="Coupons"
        description="Super admin coupon creation and review. Provider redemption is wired in a later commerce phase."
        action={
          <AdminActionForm
            endpoint="/api/admin/coupons"
            fields={[
              { name: "code", label: "Code", placeholder: "WELCOME10" },
              { name: "discount_type", label: "Type", placeholder: "percent" },
              { name: "value", label: "Value", type: "number", defaultValue: "10" },
              { name: "usage_limit", label: "Limit", type: "number", defaultValue: "100" },
              { name: "active_flag", label: "Active", type: "checkbox", defaultChecked: true },
              { name: "reason", label: "Reason", placeholder: "Launch promotion" }
            ]}
            submitLabel="Create"
          />
        }
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "code", label: "Code" },
          { key: "type", label: "Type" },
          { key: "value", label: "Value" },
          { key: "limit", label: "Limit" },
          { key: "active", label: "Active" }
        ]}
        rows={coupons.map((coupon) => ({
          id: <ShortId value={coupon.id} />,
          code: coupon.code,
          type: coupon.discountType,
          value: coupon.value,
          limit: coupon.usageLimit ?? "n/a",
          active: <StatusPill value={coupon.activeFlag ? "active" : "inactive"} />
        }))}
      />
    </>
  );
}
