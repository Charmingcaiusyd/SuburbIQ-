import { apiOk } from "@/server/api/response";
import { AUTH_COOKIE_NAME } from "@/server/auth/token";

export async function POST() {
  const response = apiOk({
    success: true
  });

  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}
