import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/admin/data/releases/{id}/rollback",
  auth: "super_admin",
  phase: "Phase 8",
  purpose: "Rollback data/scoring/map/template release without mutating old reports.",
  audit: true
});
