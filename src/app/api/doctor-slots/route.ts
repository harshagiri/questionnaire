import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const slotSchema = z.object({
  doctorProfileId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDurationMinutes: z.number().int().min(15).max(120).default(30),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorProfileId = searchParams.get("doctorProfileId");

  if (!doctorProfileId) {
    return NextResponse.json({ ok: false, message: "doctorProfileId is required" }, { status: 400 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: true, slots: [], source: "no-db" });
  }

  try {
    const slots = await prisma.doctorAvailabilitySlot.findMany({
      where: { doctorProfileId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return NextResponse.json({ ok: true, slots });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("P1001") || msg.includes("ECONNREFUSED") || msg.includes("Can't reach database server")) {
      return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, slots: [] });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, message: "Invalid body" }, { status: 400 });

  const parsed = slotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
  }

  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id: parsed.data.doctorProfileId },
      select: { id: true },
    });

    if (!doctorProfile) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Doctor profile is not in the database. Switch DOCTORS_STORAGE_MODE to auto/database and re-create or migrate this doctor before adding slots.",
        },
        { status: 400 },
      );
    }

    const slot = await prisma.doctorAvailabilitySlot.create({ data: parsed.data });
    return NextResponse.json({ ok: true, slot }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create slot";

    if (msg.includes("P1001") || msg.includes("ECONNREFUSED") || msg.includes("Can't reach database server")) {
      return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
    }

    if (msg.includes("Unique constraint") || msg.includes("doctorProfileId_dayOfWeek_startTime")) {
      return NextResponse.json(
        { ok: false, message: "This slot already exists for the selected day and time." },
        { status: 409 },
      );
    }

    if (msg.includes("Foreign key") || msg.includes("P2003")) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Doctor profile reference is invalid in the database. Re-create/migrate this doctor in DB first, then add slots.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: false, message: `Could not create slot right now. ${msg}` }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ ok: false, message: "id is required" }, { status: 400 });
  if (!prisma) return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });

  try {
    await prisma.doctorAvailabilitySlot.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Slot not found" }, { status: 404 });
  }
}
