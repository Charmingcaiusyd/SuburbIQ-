import { createStubRoute } from "@/server/api/stub-route";

export const GET = createStubRoute({
  method: "GET",
  path: "/reports/{id}/download",
  auth: "user",
  phase: "Phase 6",
  purpose: "Download watermarked PDF without consuming another credit."
});
