import { createStubRoute } from "@/server/api/stub-route";

export const GET = createStubRoute({
  method: "GET",
  path: "/admin/data-releases",
  auth: "super_admin",
  phase: "Phase 8",
  purpose: "List data releases and active markers."
});
