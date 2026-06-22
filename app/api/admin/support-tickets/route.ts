import { createStubRoute } from "@/server/api/stub-route";

export const GET = createStubRoute({
  method: "GET",
  path: "/admin/support-tickets",
  auth: "admin",
  phase: "Phase 7",
  purpose: "List and filter support tickets."
});
