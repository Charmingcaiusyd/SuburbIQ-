import { createStubRoute } from "@/server/api/stub-route";

export const GET = createStubRoute({
  method: "GET",
  path: "/reports",
  auth: "user",
  phase: "Phase 6",
  purpose: "List completed historical reports for the authenticated user."
});
