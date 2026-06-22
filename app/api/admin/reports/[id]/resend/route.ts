import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/admin/reports/{id}/resend",
  auth: "admin",
  phase: "Phase 7",
  purpose: "Resend report link to user.",
  audit: true
});
