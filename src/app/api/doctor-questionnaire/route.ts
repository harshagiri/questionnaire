import { NextResponse } from "next/server";
import { getDoctorQuestionnaireContent } from "@/lib/doctor-questionnaire-db";

export async function GET() {
  const questionnaire = await getDoctorQuestionnaireContent();
  return NextResponse.json({ ok: true, questionnaire, storage: questionnaire.source });
}
