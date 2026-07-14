import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { defaultStaffAccounts } from "@/lib/staff-auth";

// GET  ?receptionistId=   → list doctor assignments for a receptionist
// GET  ?doctorProfileId=  → list receptionists for a doctor
// POST { receptionistId, doctorProfileId } → create assignment
// DELETE ?receptionistId=&doctorProfileId= → remove assignment

const assignSchema = z.object({
  receptionistId: z.string().min(1).optional(),
  receptionistEmail: z.string().email().optional(),
  doctorProfileId: z.string().min(1),
}).refine((d) => d.receptionistId || d.receptionistEmail, {
  message: "receptionistId or receptionistEmail is required",
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receptionistId = searchParams.get("receptionistId");
  const receptionistEmail = searchParams.get("receptionistEmail");
  const doctorProfileId = searchParams.get("doctorProfileId");

  if (!prisma) {
    return NextResponse.json({ ok: true, assignments: [], source: "no-db" });
  }

  try {
    // Resolve receptionistId from email if provided
    let resolvedReceptionistId = receptionistId;
    if (!resolvedReceptionistId && receptionistEmail) {
      const user = await prisma.user.findUnique({
        where: { email: receptionistEmail.toLowerCase() },
        select: { id: true },
      });
      resolvedReceptionistId = user?.id ?? null;
    }

    if (resolvedReceptionistId) {
      const assignments = await prisma.receptionistDoctorAssignment.findMany({
        where: { receptionistId: resolvedReceptionistId },
        include: {
          doctorProfile: {
            select: { id: true, name: true, registrationNumber: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ ok: true, assignments });
    }

    if (doctorProfileId) {
      const assignments = await prisma.receptionistDoctorAssignment.findMany({
        where: { doctorProfileId },
        include: {
          receptionist: {
            select: { id: true, email: true, displayName: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ ok: true, assignments });
    }

    return NextResponse.json({ ok: false, message: "receptionistId, receptionistEmail, or doctorProfileId is required" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: true, assignments: [] });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
  }

  try {
    // Resolve receptionistId from email if needed
    let resolvedReceptionistId = parsed.data.receptionistId;
    if (!resolvedReceptionistId && parsed.data.receptionistEmail) {
      const normalizedEmail = parsed.data.receptionistEmail.toLowerCase();
      let user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (!user) {
        // Auto-provision demo account into DB if it exists in defaults
        const demoAccount = defaultStaffAccounts.find(
          (a) => a.email === normalizedEmail && a.role === "receptionist",
        );
        if (demoAccount) {
          const created = await prisma.user.create({
            data: {
              email: normalizedEmail,
              passwordHash: demoAccount.passwordHash,
              role: "receptionist",
              displayName: demoAccount.displayName,
              photoUrl: demoAccount.photoUrl ?? "",
            },
            select: { id: true },
          });
          user = created;
        }
      }

      if (!user) {
        return NextResponse.json({ ok: false, message: "Receptionist not found" }, { status: 404 });
      }
      resolvedReceptionistId = user.id;
    }

    if (!resolvedReceptionistId) {
      return NextResponse.json({ ok: false, message: "Could not resolve receptionist" }, { status: 400 });
    }

    const assignment = await prisma.receptionistDoctorAssignment.upsert({
      where: {
        receptionistId_doctorProfileId: {
          receptionistId: resolvedReceptionistId,
          doctorProfileId: parsed.data.doctorProfileId,
        },
      },
      create: { receptionistId: resolvedReceptionistId, doctorProfileId: parsed.data.doctorProfileId },
      update: {},
    });
    return NextResponse.json({ ok: true, assignment }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create assignment";
    return NextResponse.json({ ok: false, message: msg }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const receptionistId = searchParams.get("receptionistId");
  const receptionistEmail = searchParams.get("receptionistEmail");
  const doctorProfileId = searchParams.get("doctorProfileId");

  if (!doctorProfileId) {
    return NextResponse.json({ ok: false, message: "doctorProfileId is required" }, { status: 400 });
  }
  if (!prisma) {
    return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
  }

  try {
    let resolvedReceptionistId = receptionistId;
    if (!resolvedReceptionistId && receptionistEmail) {
      const user = await prisma.user.findUnique({
        where: { email: receptionistEmail.toLowerCase() },
        select: { id: true },
      });
      resolvedReceptionistId = user?.id ?? null;
    }

    if (!resolvedReceptionistId) {
      return NextResponse.json({ ok: false, message: "Receptionist not found" }, { status: 404 });
    }

    await prisma.receptionistDoctorAssignment.delete({
      where: {
        receptionistId_doctorProfileId: { receptionistId: resolvedReceptionistId, doctorProfileId },
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Assignment not found" }, { status: 404 });
  }
}
