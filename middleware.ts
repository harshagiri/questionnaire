import { NextRequest, NextResponse } from "next/server";
import { routeRoleMap, roleHomePath } from "@/lib/auth";

const publicPaths = ["/", "/access", "/api/health", "/api/session"];

function getRequiredRole(pathname: string) {
  return routeRoleMap.find((item) => pathname.startsWith(item.prefix))?.role;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const requiredRole = getRequiredRole(pathname);
  if (!requiredRole) {
    return NextResponse.next();
  }

  const role = request.cookies.get("se_role")?.value;
  if (!role) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    loginUrl.searchParams.set("role", requiredRole);
    return NextResponse.redirect(loginUrl);
  }

  if (role !== requiredRole) {
    const home = roleHomePath[role] ?? "/";
    const redirectUrl = new URL(home, request.url);
    redirectUrl.searchParams.set("reason", "role-mismatch");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};