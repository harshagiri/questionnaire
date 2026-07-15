import { NextResponse } from "next/server";
import { z } from "zod";
import { getSavedPatientQuestionnaire, savePatientQuestionnaireToDatabase } from "@/lib/patient-questionnaire-db";

const answerValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

const patientQuestionnaireSaveSchema = z.object({
  sessionId: z.string().min(1),
  patientPhone: z.string().optional(),
  answers: z.record(z.string(), answerValueSchema),
  sectionIndex: z.coerce.number().int().min(0),
  questionIndex: z.coerce.number().int().min(-1),
  submitted: z.coerce.boolean(),
  updatedAt: z.string().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") ?? undefined;
  const phone = searchParams.get("phone") ?? undefined;

  if (!sessionId && !phone) {
    return NextResponse.json({ ok: false, message: "sessionId or phone is required" }, { status: 400 });
  }

  const record = await getSavedPatientQuestionnaire({ sessionId, phone });

  return NextResponse.json({
    ok: true,
    record,
    storage: record?.source ?? "none",
  });
}

export async function POST(request: Request) {
  const parsed = patientQuestionnaireSaveSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await savePatientQuestionnaireToDatabase(parsed.data);

    return NextResponse.json(result, { status: parsed.data.submitted ? 201 : 200 });
  } catch (error) {
    console.error("Could not save patient questionnaire", error);
    return NextResponse.json({ ok: false, message: "Could not save patient questionnaire" }, { status: 500 });
  }
}