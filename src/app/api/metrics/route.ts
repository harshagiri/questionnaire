import { NextResponse } from "next/server";
import { getAdminSummary, getUsageMetrics } from "@/lib/metrics";

export async function GET() {
  const [summary, usage] = await Promise.all([getAdminSummary(), getUsageMetrics()]);

  return NextResponse.json({
    ok: true,
    metrics: {
      summary,
      usage,
    },
  });
}