import { NextResponse } from "next/server";
import { getPatientQuestionnaireContent } from "@/lib/patient-questionnaire-db";
import { questionnaireDefinition } from "@/lib/questionnaire";
import { questionnaireBuilderSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const audience = searchParams.get("audience");

  if (!audience || audience === "patient") {
    const questionnaire = await getPatientQuestionnaireContent();
    return NextResponse.json({ ok: true, questionnaire, storage: questionnaire.source });
  }

  return NextResponse.json({ ok: true, questionnaire: questionnaireDefinition, storage: "local" });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = questionnaireBuilderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({ ok: true, questionnaire: parsed.data }, { status: 201 });
}