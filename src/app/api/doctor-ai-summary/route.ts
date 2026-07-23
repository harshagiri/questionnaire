import { NextResponse } from "next/server";
import { z } from "zod";
import { getSavedDoctorPostConsultSummary, saveDoctorPostConsultSummary } from "@/lib/doctor-questionnaire-db";

const saveDoctorAiSummarySchema = z.object({
  consultSessionId: z.string().min(1),
  summary: z.string().min(1),
  generatedAt: z.string().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const consultSessionId = searchParams.get("consultSessionId") ?? undefined;

  if (!consultSessionId) {
    return NextResponse.json({ ok: false, message: "consultSessionId is required" }, { status: 400 });
  }

  try {
    const record = await getSavedDoctorPostConsultSummary({ consultSessionId });

    return NextResponse.json({
      ok: true,
      record,
      storage: record ? "database" : "none",
    });
  } catch (error) {
    console.error("Could not load doctor AI summary", error);
    const details = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        ok: false,
        message: "Could not load doctor AI summary",
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const parsed = saveDoctorAiSummarySchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await saveDoctorPostConsultSummary(parsed.data);

    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Could not save doctor AI summary", error);
    const details = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        ok: false,
        message: "Could not save doctor AI summary",
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status: 500 },
    );
  }
}
