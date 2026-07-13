import { NextResponse } from "next/server";
import { z } from "zod";
import { getSavedDoctorQuestionnaire, saveDoctorQuestionnaireToDatabase } from "@/lib/doctor-questionnaire-db";

const answerValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

const doctorQuestionnaireSaveSchema = z.object({
  consultSessionId: z.string().min(1),
  answers: z.record(z.string(), answerValueSchema),
  stepIndex: z.coerce.number().int().min(0),
  submitted: z.coerce.boolean(),
  patientName: z.string().optional(),
  patientPhone: z.string().optional(),
  appointmentTime: z.string().optional(),
  appointmentType: z.string().optional(),
  appointmentStatus: z.string().optional(),
  updatedAt: z.string().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const consultSessionId = searchParams.get("consultSessionId") ?? undefined;

  if (!consultSessionId) {
    return NextResponse.json({ ok: false, message: "consultSessionId is required" }, { status: 400 });
  }

  const record = await getSavedDoctorQuestionnaire({ consultSessionId });

  return NextResponse.json({
    ok: true,
    record,
    storage: record?.source ?? "none",
  });
}

export async function POST(request: Request) {
  const parsed = doctorQuestionnaireSaveSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await saveDoctorQuestionnaireToDatabase(parsed.data);
    const statusCode = parsed.data.submitted ? 201 : 200;

    if (!result.ok) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error("Could not save doctor questionnaire", error);
    const details = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        message: "Could not save doctor questionnaire",
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status: 500 },
    );
  }
}
