import { createStubRoute } from "@/server/api/stub-route";

export const GET = createStubRoute({
  method: "GET",
  path: "/admin/report-jobs",
  auth: "admin",
  phase: "Phase 7",
  purpose: "Search and inspect report jobs."
});
