import { NextResponse } from "next/server";

function clearAuthCookies(response: NextResponse) {
  response.cookies.set("se_role", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set("se_name", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set("se_demo_otp", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function POST(request: Request) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);
  clearAuthCookies(response);
  return response;
}

export async function GET(request: Request) {
  const redirectUrl = new URL("/", request.url);
  const response = NextResponse.redirect(redirectUrl);
  clearAuthCookies(response);
  return response;
}
