import { NextResponse } from "next/server";
import { getPatientQuestionnaireContent } from "@/lib/patient-questionnaire-db";
import { questionnaireDefinition } from "@/lib/questionnaire";

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
  void request;
  return NextResponse.json(
    { ok: false, message: "Questionnaire builder is disabled." },
    { status: 410 },
  );
}