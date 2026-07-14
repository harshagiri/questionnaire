import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const MAX_SLOTS = 5;

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
  } catch {
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
    const existing = await prisma.doctorAvailabilitySlot.count({
      where: { doctorProfileId: parsed.data.doctorProfileId },
    });

    if (existing >= MAX_SLOTS) {
      return NextResponse.json(
        { ok: false, message: `Maximum ${MAX_SLOTS} slots per doctor allowed.` },
        { status: 400 },
      );
    }

    const slot = await prisma.doctorAvailabilitySlot.create({ data: parsed.data });
    return NextResponse.json({ ok: true, slot }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create slot";
    return NextResponse.json({ ok: false, message: msg }, { status: 409 });
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
