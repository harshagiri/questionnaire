import { NextResponse } from "next/server";
import { resolveAppUrl } from "@/lib/app-url";
import { sanitizeMagicLinkToken } from "@/lib/magic-link-token";

type RouteContext = {
  params: Promise<{
    token?: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const normalizedToken = sanitizeMagicLinkToken(token);
  const baseUrl = resolveAppUrl(request);
  const target = new URL(`/api/patient-magic-link/consume?token=${encodeURIComponent(normalizedToken)}`, baseUrl);
  return NextResponse.redirect(target);
}
