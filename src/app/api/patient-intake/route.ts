import { NextResponse } from "next/server";
import { patientIntakeSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = patientIntakeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    record: {
      ...parsed.data,
      id: crypto.randomUUID(),
      submittedAt: new Date().toISOString(),
    },
  }, { status: 201 });
}