import { createStubRoute } from "@/server/api/stub-route";

export const GET = createStubRoute({
  method: "GET",
  path: "/admin/users/{id}/profile",
  auth: "admin",
  phase: "Phase 7",
  purpose: "View full buyer profile questionnaire.",
  audit: true
});
