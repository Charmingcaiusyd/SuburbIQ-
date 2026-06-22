import { createStubRoute } from "@/server/api/stub-route";

export const POST = createStubRoute({
  method: "POST",
  path: "/reports/free-preview",
  auth: "user",
  phase: "Phase 6",
  purpose: "Generate preview-only free report without prediction data or PDF."
});
