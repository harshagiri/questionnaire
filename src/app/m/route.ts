import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("t") ?? "";
  const target = new URL(`/api/patient-magic-link/consume?token=${encodeURIComponent(token)}`, request.url);
  return NextResponse.redirect(target);
}
