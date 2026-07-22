import { NextResponse } from "next/server";
import { resolveAppUrl } from "@/lib/app-url";
import { extractMagicLinkToken } from "@/lib/magic-link-token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = extractMagicLinkToken(url);
  const baseUrl = resolveAppUrl(request);
  const target = new URL(`/api/patient-magic-link/consume?token=${encodeURIComponent(token)}`, baseUrl);
  return NextResponse.redirect(target);
}
