import { NextResponse } from "next/server";

function getPublicOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const protocol = forwardedProto === "https" ? "https:" : "http:";

  if (host) {
    return `${protocol}//${host}`;
  }

  return new URL(request.url).origin;
}

function clearAuthCookies(response: NextResponse, request: Request) {
  const protoHeader = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const isSecureRequest = protoHeader === "https" || new URL(request.url).protocol === "https:";

  const clearOptions = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0, secure: isSecureRequest };
  response.cookies.set("se_role", "", clearOptions);
  response.cookies.set("se_name", "", clearOptions);
  response.cookies.set("se_avatar", "", clearOptions);
  response.cookies.set("se_demo_otp", "", clearOptions);
}

export async function POST(request: Request) {
  const redirectUrl = new URL("/", getPublicOrigin(request));
  const response = NextResponse.redirect(redirectUrl);
  clearAuthCookies(response, request);
  return response;
}

export async function GET(request: Request) {
  const redirectUrl = new URL("/", getPublicOrigin(request));
  const response = NextResponse.redirect(redirectUrl);
  clearAuthCookies(response, request);
  return response;
}
