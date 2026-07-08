import { NextResponse } from "next/server";
import { appointmentSchema } from "@/lib/schemas";

export async function GET() {
  return NextResponse.json({
    ok: true,
    appointments: [
      {
        id: crypto.randomUUID(),
        patientName: "Ritika Sharma",
        doctorName: "Aarav Mehta",
        appointmentDate: "2026-07-08",
        appointmentSlot: "10:30 AM",
        status: "submitted",
      },
    ],
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = appointmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json({ ok: true, appointment: { id: crypto.randomUUID(), ...parsed.data } }, { status: 201 });
}