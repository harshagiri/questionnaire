import { NextResponse } from "next/server";

function clearAuthCookies(response: NextResponse, request: Request) {
  const protoHeader = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const isSecureRequest = protoHeader === "https" || new URL(request.url).protocol === "https:";

  const clearOptions = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0, secure: isSecureRequest };
  response.cookies.set("se_role", "", clearOptions);
  response.cookies.set("se_name", "", clearOptions);
  response.cookies.set("se_demo_otp", "", clearOptions);
}

export async function POST(request: Request) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);
  clearAuthCookies(response, request);
  return response;
}

export async function GET(request: Request) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);
  clearAuthCookies(response, request);
  return response;
}
