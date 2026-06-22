import type { NextRequest } from "next/server";
import { apiOk } from "./response";

export type ApiAuth = "public" | "user" | "admin" | "super_admin" | "provider";

type StubRouteSpec = {
  method: string;
  path: string;
  auth: ApiAuth;
  phase: string;
  purpose: string;
  audit?: boolean;
};

type RouteContext = {
  params?: Record<string, string>;
};

async function readBodyShape(request: NextRequest) {
  if (!["POST", "PUT", "PATCH"].includes(request.method)) {
    return null;
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    return {
      keys: Object.keys(body),
      received: body
    };
  } catch {
    return {
      keys: [],
      received: null
    };
  }
}

export function createStubRoute(spec: StubRouteSpec) {
  return async function handler(request: NextRequest, context?: RouteContext) {
    return apiOk({
      endpoint: spec.path,
      method: spec.method,
      auth: spec.auth,
      phase: spec.phase,
      purpose: spec.purpose,
      auditRequired: spec.audit === true,
      params: context?.params ?? {},
      query: Object.fromEntries(request.nextUrl.searchParams.entries()),
      body: await readBodyShape(request),
      implementation: "stub"
    });
  };
}
