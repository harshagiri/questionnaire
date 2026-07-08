import { NextResponse } from "next/server";
import { questionnaireDefinition } from "@/lib/questionnaire";
import { questionnaireBuilderSchema } from "@/lib/schemas";

export async function GET() {
  return NextResponse.json({ questionnaire: questionnaireDefinition });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = questionnaireBuilderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({ ok: true, questionnaire: parsed.data }, { status: 201 });
}