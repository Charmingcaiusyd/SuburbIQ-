import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/reports/{id}/feedback",
  auth: "user",
  phase: "Phase 7",
  purpose: "Submit report-linked support ticket."
});
