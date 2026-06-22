import { NextResponse } from "next/server";
import type { ApiErrorCode } from "@/domain/errors";

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function apiAccepted<T>(data: T) {
  return apiOk(data, { status: 202 });
}

export function apiCreated<T>(data: T) {
  return apiOk(data, { status: 201 });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status = 400,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details
      }
    },
    { status }
  );
}
