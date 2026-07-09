import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { demoAppointments } from "@/lib/workflow-data";

const appointmentStatuses = ["draft", "booked", "waiting", "submitted", "cancelled", "follow_up"] as const;

const appointmentCreateSchema = z.object({
  patientName: z.string().min(2),
  patientPhone: z.string().min(8),
  doctorId: z.string().min(1),
  appointmentDate: z.string().min(10),
  appointmentTime: z.string().min(2),
  appointmentType: z.string().min(2),
  consultSessionId: z.string().min(8),
  status: z.enum(appointmentStatuses).default("booked"),
  notes: z.string().optional().default(""),
});

const appointmentStatusUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(appointmentStatuses),
});

type AppointmentPayload = {
  id: string;
  consultSessionId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  status: (typeof appointmentStatuses)[number];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

function toAppointmentPayload(appointment: {
  id: string;
  consultSessionId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: Date;
  appointmentTime: string;
  appointmentType: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AppointmentPayload {
  return {
    id: appointment.id,
    consultSessionId: appointment.consultSessionId,
    patientName: appointment.patientName,
    patientPhone: appointment.patientPhone,
    doctorId: appointment.doctorId,
    doctorName: appointment.doctorName,
    appointmentDate: appointment.appointmentDate.toISOString().slice(0, 10),
    appointmentTime: appointment.appointmentTime,
    appointmentType: appointment.appointmentType,
    status: appointment.status as AppointmentPayload["status"],
    notes: appointment.notes ?? "",
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}

function toConsultLink(consultSessionId: string) {
  return `/access?role=patient&next=/patient/${consultSessionId}`;
}

function normalizeDateTime(dateValue: string, timeValue: string) {
  const normalizedDate = dateValue.trim();
  const normalizedTime = timeValue.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) || !normalizedTime) {
    return null;
  }

  const parsed = new Date(`${normalizedDate}T${normalizedTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function createOrUpdatePatientUser(
  tx: NonNullable<typeof prisma>,
  patientName: string,
  patientPhone: string,
) {
  const normalizedPhone = patientPhone.replace(/\D/g, "");
  const email = `patient-${normalizedPhone || patientName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "session"}@spinexpert.local`;

  return tx.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: `patient:${normalizedPhone || patientName}`,
      role: "patient",
      displayName: patientName,
    },
    update: {
      displayName: patientName,
    },
  });
}

async function resolveDoctor(tx: NonNullable<typeof prisma>, doctorId: string) {
  const doctor = await tx.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  return doctor;
}

async function listDatabaseAppointments() {
  const appointments = await prisma.appointment.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return appointments.map((appointment) =>
    toAppointmentPayload({
      id: appointment.id,
      consultSessionId: appointment.consultSessionId,
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      appointmentType: appointment.appointmentType,
      status: appointment.status,
      notes: appointment.notes,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    }),
  );
}

export async function GET() {
  if (!prisma) {
    return NextResponse.json({ ok: true, appointments: demoAppointments, storage: "demo" });
  }

  const appointments = await listDatabaseAppointments();
  return NextResponse.json({ ok: true, appointments, storage: "database" });
}

export async function POST(request: Request) {
  if (!prisma) {
    return NextResponse.json({ ok: false, message: "Database is unavailable" }, { status: 503 });
  }

  const body = await request.json();
  const parsed = appointmentCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const appointmentDateTime = normalizeDateTime(input.appointmentDate, input.appointmentTime);

  if (!appointmentDateTime) {
    return NextResponse.json({ ok: false, message: "Invalid appointment date or time" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const patient = await createOrUpdatePatientUser(tx, input.patientName, input.patientPhone);
      const doctor = await resolveDoctor(tx, input.doctorId);

      return tx.appointment.create({
        data: {
          consultSessionId: input.consultSessionId,
          patientId: patient.id,
          patientName: input.patientName,
          patientPhone: input.patientPhone,
          doctorId: doctor.user.id,
          doctorName: doctor.name,
          appointmentDate: appointmentDateTime,
          appointmentTime: input.appointmentTime.trim(),
          appointmentType: input.appointmentType.trim(),
          status: input.status,
          notes: input.notes?.trim() || null,
        },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        appointment: toAppointmentPayload({
          id: created.id,
          consultSessionId: created.consultSessionId,
          patientName: created.patientName,
          patientPhone: created.patientPhone,
          doctorId: created.doctorId,
          doctorName: created.doctorName,
          appointmentDate: created.appointmentDate,
          appointmentTime: created.appointmentTime,
          appointmentType: created.appointmentType,
          status: created.status,
          notes: created.notes,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        }),
        consultLink: toConsultLink(created.consultSessionId),
        storage: "database",
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create appointment";
    return NextResponse.json({ ok: false, message }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  if (!prisma) {
    return NextResponse.json({ ok: false, message: "Database is unavailable" }, { status: 503 });
  }

  const body = await request.json();
  const parsed = appointmentStatusUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await prisma.appointment.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
    });

    return NextResponse.json({
      ok: true,
      appointment: toAppointmentPayload({
        id: updated.id,
        consultSessionId: updated.consultSessionId,
        patientName: updated.patientName,
        patientPhone: updated.patientPhone,
        doctorId: updated.doctorId,
        doctorName: updated.doctorName,
        appointmentDate: updated.appointmentDate,
        appointmentTime: updated.appointmentTime,
        appointmentType: updated.appointmentType,
        status: updated.status,
        notes: updated.notes,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      }),
      storage: "database",
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not update appointment" }, { status: 404 });
  }
}
