import { NextResponse } from "next/server";
import { getAdminSummary } from "@/lib/metrics";

export async function GET() {
  return NextResponse.json({ ok: true, metrics: getAdminSummary() });
}