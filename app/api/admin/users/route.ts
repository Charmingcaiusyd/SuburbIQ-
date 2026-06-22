import { createStubRoute } from "@/server/api/stub-route";

export const GET = createStubRoute({
  method: "GET",
  path: "/admin/users",
  auth: "admin",
  phase: "Phase 7",
  purpose: "Search users for admin support workflows."
});
