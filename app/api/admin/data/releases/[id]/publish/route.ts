import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/admin/data/releases/{id}/publish",
  auth: "super_admin",
  phase: "Phase 8",
  purpose: "Publish validated data/scoring release.",
  audit: true
});
