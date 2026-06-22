import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/admin/support-tickets/{id}/reply",
  auth: "admin",
  phase: "Phase 7",
  purpose: "Reply to support ticket.",
  audit: true
});
