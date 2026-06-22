import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/admin/coupons",
  auth: "super_admin",
  phase: "Phase 7",
  purpose: "Create coupon or discount configuration.",
  audit: true
});
