import { createStubRoute } from "@/server/api/stub-route";

export const GET = createStubRoute({
  method: "GET",
  path: "/report-jobs/{id}",
  auth: "user",
  phase: "Phase 6",
  purpose: "Read report job status and progress."
});
