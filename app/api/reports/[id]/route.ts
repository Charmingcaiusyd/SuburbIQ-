import { createStubRoute } from "@/server/api/stub-route";

export const GET = createStubRoute({
  method: "GET",
  path: "/reports/{id}",
  auth: "user",
  phase: "Phase 6",
  purpose: "Open login-protected HTML report for owner/entitled user."
});
