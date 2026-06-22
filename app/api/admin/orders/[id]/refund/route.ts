import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/admin/orders/{id}/refund",
  auth: "admin",
  phase: "Phase 7",
  purpose: "Process refund and coordinate payment/order state.",
  audit: true
});
