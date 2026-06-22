import { AdminActionForm } from "../_action-form";
import { AdminPageHeader, AdminTable, Money, ShortId, StatusPill } from "../_components";
import { listAdminOrders } from "@/server/services/admin-service";

export default async function AdminOrdersPage() {
  const orders = await listAdminOrders();

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Review order, payment and GST state. Refund is mocked but stateful and audited."
      />
      <AdminTable
        columns={[
          { key: "id", label: "ID" },
          { key: "user", label: "User" },
          { key: "product", label: "Product" },
          { key: "status", label: "Order" },
          { key: "payment", label: "Payment" },
          { key: "amount", label: "Amount" },
          { key: "created", label: "Created" },
          { key: "action", label: "Refund" }
        ]}
        rows={orders.map((order) => ({
          id: <ShortId value={order.id} />,
          user: order.user_email,
          product: order.product_name,
          status: <StatusPill value={order.status} />,
          payment: <StatusPill value={order.payment_status} />,
          amount: <Money cents={order.amount_cents} />,
          created: order.created_at,
          action: (
            <AdminActionForm
              endpoint={`/api/admin/orders/${order.id}/refund`}
              fields={[{ name: "reason", label: "Reason", placeholder: "Customer support refund" }]}
              submitLabel="Refund"
            />
          )
        }))}
      />
    </>
  );
}
