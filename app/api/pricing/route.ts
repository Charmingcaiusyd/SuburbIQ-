import { apiOk } from "@/server/api/response";
import { getStubProducts } from "@/server/services/catalog-service";

export async function GET() {
  return apiOk({
    products: getStubProducts(),
    source: "stub"
  });
}
