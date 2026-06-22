import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/admin/data/uploads",
  auth: "super_admin",
  phase: "Phase 8",
  purpose: "Upload data file and start validation/change-report workflow.",
  audit: true
});
