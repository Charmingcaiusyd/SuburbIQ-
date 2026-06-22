import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/admin/subscriptions/{id}/extend",
  auth: "admin",
  phase: "Phase 7",
  purpose: "Extend subscription period.",
  audit: true
});
