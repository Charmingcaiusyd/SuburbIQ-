import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/admin/users/{id}/credits",
  auth: "admin",
  phase: "Phase 7",
  purpose: "Add or return report credit.",
  audit: true
});
