import { createStubRoute } from "@/server/api/stub-route";

export const PUT = createStubRoute({
  method: "PUT",
  path: "/admin/report-templates/{id}",
  auth: "super_admin",
  phase: "Phase 7",
  purpose: "Edit versioned report template.",
  audit: true
});
