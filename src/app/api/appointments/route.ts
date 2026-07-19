import { NextResponse } from "next/server";
import { z } from "zod";
import { computePromScore, extractDoctorPromSummary, getPromSummaryFromAudit, type PromDisplaySummary } from "@/lib/prom-scoring";
import { prisma } from "@/lib/prisma";
import { formatDoctorDisplayName } from "@/lib/doctor-display";

const appointmentStatuses = ["draft", "booked", "waiting", "submitted", "cancelled", "follow_up"] as const;

const appointmentCreateSchema = z.object({
  patientName: z.string().min(2),
  patientPhone: z.string().min(8),
  doctorId: z.string().min(1),
  appointmentDate: z.string().min(10),
  appointmentTime: z.string().min(2),
  appointmentType: z.string().min(2),
  consultSessionId: z.string().min(8),
  consultId: z.string().optional(),
  videoConsultLink: z.string().optional(),
  preConsultLink: z.string().optional(),
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
  consultId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  status: (typeof appointmentStatuses)[number];
  notes: string;
  videoConsultLink?: string;
  preConsultLink?: string;
  promSummary?: PromDisplaySummary;
  createdAt: string;
  updatedAt: string;
};

type StoredAnswerValue = string | number | boolean | string[];

type AppointmentTx = Parameters<NonNullable<typeof prisma>['$transaction']>[0] extends (transaction: infer Transaction, ...args: never[]) => unknown
  ? Transaction
  : never;

function toAppointmentPayload(appointment: {
  id: string;
  consultSessionId: string | null;
  consultId?: string | null;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: Date;
  appointmentTime: string;
  appointmentType: string;
  status: string;
  notes: string | null;
  videoConsultLink?: string | null;
  preConsultLink?: string | null;
  promSummary?: PromDisplaySummary;
  createdAt: Date;
  updatedAt: Date;
}): AppointmentPayload {
  const sessionId = appointment.consultSessionId ?? appointment.id;
  return {
    id: appointment.id,
    consultSessionId: sessionId,
    consultId: appointment.consultId ?? sessionId,
    patientName: appointment.patientName,
    patientPhone: appointment.patientPhone,
    doctorId: appointment.doctorId,
    doctorName: formatDoctorDisplayName(appointment.doctorName),
    appointmentDate: appointment.appointmentDate.toISOString().slice(0, 10),
    appointmentTime: appointment.appointmentTime,
    appointmentType: appointment.appointmentType,
    status: appointment.status as AppointmentPayload["status"],
    notes: appointment.notes ?? "",
    videoConsultLink: appointment.videoConsultLink ?? undefined,
    preConsultLink: appointment.preConsultLink ?? undefined,
    promSummary: appointment.promSummary,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}

async function loadPromSummaryBySessionId(sessionIds: string[]) {
  if (!prisma || sessionIds.length === 0) {
    return new Map<string, PromDisplaySummary>();
  }

  const uniqueSessionIds = Array.from(new Set(sessionIds.filter((value) => value.trim().length > 0)));
  const doctorSessionIds = uniqueSessionIds.map((sessionId) => `${sessionId}:doctor`);

  const submissions = await prisma.questionnaireSubmission.findMany({
    where: { sessionId: { in: [...uniqueSessionIds, ...doctorSessionIds] } },
    include: { answers: true },
  });

  const patientBySession = new Map<string, Record<string, unknown>>();
  const doctorBySession = new Map<string, Record<string, StoredAnswerValue>>();

  for (const submission of submissions) {
    const isDoctor = submission.sessionId.endsWith(":doctor");
    const baseSessionId = isDoctor ? submission.sessionId.slice(0, -7) : submission.sessionId;
    const answers = submission.answers;

    if (isDoctor) {
      doctorBySession.set(
        baseSessionId,
        Object.fromEntries(
          answers
            .filter((item) => !item.key.startsWith("__"))
            .map((item) => [item.key, item.value as StoredAnswerValue]),
        ),
      );
      continue;
    }

    const auditValue = answers.find((item) => item.key === "__promAutoAudit")?.value;
    const auditSummary = getPromSummaryFromAudit(auditValue);
    if (auditSummary) {
      patientBySession.set(baseSessionId, {
        __summary: auditSummary,
      });
      continue;
    }

    const rawAnswers = Object.fromEntries(
      answers
        .filter((item) => !item.key.startsWith("__"))
        .map((item) => [item.key, item.value as unknown]),
    );

    const computed = computePromScore(rawAnswers);
    if (computed.percent !== null) {
      patientBySession.set(baseSessionId, {
        __summary: {
          instrument: computed.instrument,
          percent: computed.percent,
          severity: computed.severity,
          source: "patient-auto",
        } satisfies PromDisplaySummary,
      });
    }
  }

  const summaryBySession = new Map<string, PromDisplaySummary>();

  for (const sessionId of uniqueSessionIds) {
    const patientSummary = patientBySession.get(sessionId)?.__summary as PromDisplaySummary | undefined;
    const doctorAnswers = doctorBySession.get(sessionId);
    const doctorSummary = doctorAnswers
      ? extractDoctorPromSummary(doctorAnswers, patientSummary?.instrument)
      : null;

    if (doctorSummary) {
      summaryBySession.set(sessionId, doctorSummary);
    } else if (patientSummary) {
      summaryBySession.set(sessionId, patientSummary);
    }
  }

  return summaryBySession;
}

function toConsultLink(consultSessionId: string | null, appointmentId: string) {
  return `/access?role=patient&next=/patient/${consultSessionId ?? appointmentId}`;
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

function normalizePhone(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

async function createOrUpdatePatientUser(
  tx: AppointmentTx,
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

async function resolveDoctor(tx: AppointmentTx, doctorId: string) {
  const doctor = await tx.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!doctor) {
    throw new Error("Doctor not found");
  }

  return doctor;
}

async function listDatabaseAppointments(phone?: string | null, date?: string | null) {
  const database = prisma;
  if (!database) {
    return [];
  }

  const normalizedPhone = normalizePhone(phone ?? null);
  const normalizedDate = date?.trim() ?? "";

  const appointments = await database.$queryRaw<
    Array<{
      id: string;
      consultSessionId: string | null;
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
    }>
  >`
    SELECT
      id,
      "consultSessionId",
      "patientName",
      "patientPhone",
      "doctorId",
      "doctorName",
      "appointmentDate",
      "appointmentTime",
      "appointmentType",
      status,
      notes,
      "createdAt",
      "updatedAt"
    FROM "Appointment"
    ORDER BY "updatedAt" DESC
  `;

  const filteredAppointments = appointments.filter((appointment) => {
    const matchesPhone = normalizedPhone ? normalizePhone(appointment.patientPhone) === normalizedPhone : true;
    const matchesDate = normalizedDate ? appointment.appointmentDate.toISOString().slice(0, 10) === normalizedDate : true;

    return matchesPhone && matchesDate;
  });

  const promBySession = await loadPromSummaryBySessionId(
    filteredAppointments.map((appointment) => appointment.consultSessionId ?? appointment.id),
  );

  return filteredAppointments.map((appointment) =>
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
      promSummary: promBySession.get(appointment.consultSessionId ?? appointment.id),
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    }),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");
  const date = searchParams.get("date");
  const consultSessionId = searchParams.get("consultSessionId") ?? searchParams.get("sessionId");
  const doctorEmail = searchParams.get("doctorEmail");
  const doctorProfileId = searchParams.get("doctorProfileId");

  if (!prisma) {
    return NextResponse.json({ ok: true, appointments: [], storage: "no-db" });
  }

  try {
    let appointments;

    if (consultSessionId) {
      const raw = await prisma.appointment.findMany({
        where: { consultSessionId },
        orderBy: { updatedAt: "desc" },
      });

      appointments = raw.map((a) =>
        toAppointmentPayload({
          ...a,
          appointmentDate: a.appointmentDate,
        }),
      );
    } else if (doctorEmail || doctorProfileId) {
      // Doctor-filtered view: resolve doctorId from email if needed
      let resolvedDoctorUserId: string | undefined;

      if (doctorEmail) {
        const doctorUser = await prisma.user.findUnique({
          where: { email: doctorEmail.toLowerCase() },
          select: { id: true },
        });
        resolvedDoctorUserId = doctorUser?.id;
      } else if (doctorProfileId) {
        const profile = await prisma.doctorProfile.findUnique({
          where: { id: doctorProfileId },
          select: { userId: true },
        });
        resolvedDoctorUserId = profile?.userId;
      }

      if (!resolvedDoctorUserId) {
        return NextResponse.json({ ok: true, appointments: [], storage: "database" });
      }

      const raw = await prisma.appointment.findMany({
        where: { doctorId: resolvedDoctorUserId },
        orderBy: { updatedAt: "desc" },
      });

      appointments = raw.map((a) =>
        toAppointmentPayload({
          ...a,
          appointmentDate: a.appointmentDate,
        }),
      );
    } else {
      appointments = await listDatabaseAppointments(phone, date);
    }

    const promBySession = await loadPromSummaryBySessionId(
      appointments.map((appointment) => appointment.consultSessionId || appointment.id),
    );

    return NextResponse.json({
      ok: true,
      appointments: appointments.map((appointment) => ({
        ...appointment,
        promSummary: promBySession.get(appointment.consultSessionId || appointment.id),
      })),
      storage: "database",
    });
  } catch {
    return NextResponse.json({ ok: true, appointments: [], storage: "error" });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = appointmentCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  if (!prisma) {
    // No DB: return a local-only success so client can save to localStorage
    return NextResponse.json({
      ok: true,
      appointment: {
        id: parsed.data.consultSessionId,
        consultSessionId: parsed.data.consultSessionId,
        consultId: parsed.data.consultId ?? parsed.data.consultSessionId,
        patientName: parsed.data.patientName,
        patientPhone: parsed.data.patientPhone,
        doctorId: parsed.data.doctorId,
        doctorName: "",
        appointmentDate: parsed.data.appointmentDate,
        appointmentTime: parsed.data.appointmentTime,
        appointmentType: parsed.data.appointmentType,
        status: parsed.data.status,
        notes: parsed.data.notes ?? "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      consultLink: toConsultLink(parsed.data.consultSessionId, parsed.data.consultSessionId),
      storage: "local",
    }, { status: 201 });
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

      const appointmentData = {
        consultSessionId: input.consultSessionId,
        consultId: input.consultId ?? input.consultSessionId,
        patientId: patient.id,
        patientName: input.patientName,
        patientPhone: input.patientPhone,
        doctorId: doctor.user.id,
        doctorName: doctor.name,
        appointmentDate: appointmentDateTime,
        appointmentTime: input.appointmentTime.trim(),
        appointmentType: input.appointmentType.trim(),
        status: input.status as never,
        notes: input.notes?.trim() || null,
        videoConsultLink: input.videoConsultLink ?? null,
        preConsultLink: input.preConsultLink ?? null,
      } as const;

      return tx.appointment.create({ data: appointmentData as never });
    });

    const createdAppointment = created as unknown as {
      id: string;
      consultSessionId: string | null;
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
    };

    return NextResponse.json(
      {
        ok: true,
        appointment: toAppointmentPayload({
          id: createdAppointment.id,
          consultSessionId: createdAppointment.consultSessionId,
          patientName: createdAppointment.patientName,
          patientPhone: createdAppointment.patientPhone,
          doctorId: createdAppointment.doctorId,
          doctorName: createdAppointment.doctorName,
          appointmentDate: createdAppointment.appointmentDate,
          appointmentTime: createdAppointment.appointmentTime,
          appointmentType: createdAppointment.appointmentType,
          status: createdAppointment.status,
          notes: createdAppointment.notes,
          createdAt: createdAppointment.createdAt,
          updatedAt: createdAppointment.updatedAt,
        }),
        consultLink: toConsultLink(createdAppointment.consultSessionId, createdAppointment.id),
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
      data: { status: parsed.data.status as never },
    });

    const updatedAppointment = updated as unknown as {
      id: string;
      consultSessionId: string | null;
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
    };

    return NextResponse.json({
      ok: true,
      appointment: toAppointmentPayload({
        id: updatedAppointment.id,
        consultSessionId: updatedAppointment.consultSessionId,
        patientName: updatedAppointment.patientName,
        patientPhone: updatedAppointment.patientPhone,
        doctorId: updatedAppointment.doctorId,
        doctorName: updatedAppointment.doctorName,
        appointmentDate: updatedAppointment.appointmentDate,
        appointmentTime: updatedAppointment.appointmentTime,
        appointmentType: updatedAppointment.appointmentType,
        status: updatedAppointment.status,
        notes: updatedAppointment.notes,
        createdAt: updatedAppointment.createdAt,
        updatedAt: updatedAppointment.updatedAt,
      }),
      storage: "database",
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not update appointment" }, { status: 404 });
  }
}
