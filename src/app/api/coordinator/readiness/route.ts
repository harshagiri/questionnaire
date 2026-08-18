import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const paymentStatusSchema = z.enum(["pending", "paid", "failed", "waived"]);

const paymentUpdateSchema = z.object({
  appointmentId: z.string().min(1),
  status: paymentStatusSchema,
  amountPaise: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

type ReadinessRow = {
  appointmentId: string;
  consultSessionId: string;
  patientName: string;
  patientPhone: string;
  patientId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  appointmentStatus: string;
  doctorName: string;
  doctorEmail: string;
  doctorPhotoUrl: string;
  checks: {
    profileComplete: boolean;
    paymentComplete: boolean;
    questionnaireComplete: boolean;
  };
  payment: {
    status: "pending" | "paid" | "failed" | "waived";
    paidAt: string | null;
  };
  redFlag: boolean;
  overallComplete: boolean;
};

const urgentRedFlagKeys = [
  "redFlagBladderBowel",
  "redFlagRapidWeakness",
  "redFlagFever",
  "redFlagTrauma",
  "redFlagCancer",
  "redFlagWeightLoss",
] as const;

function hasText(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function hasPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isProfileComplete(record: {
  patientId?: string | null;
  fullName?: string | null;
  age?: number | null;
  gender?: string | null;
  region?: string | null;
  preferredLanguage?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
} | null) {
  if (!record) {
    return false;
  }

  return (
    hasText(record.patientId) &&
    hasText(record.fullName) &&
    hasPositiveNumber(record.age) &&
    hasText(record.gender) &&
    hasText(record.region) &&
    hasText(record.preferredLanguage) &&
    hasPositiveNumber(record.heightCm) &&
    hasPositiveNumber(record.weightKg)
  );
}

function normalizeDateParam(value: string | null) {
  if (!value) {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

function dayRange(dateValue: string) {
  const start = new Date(`${dateValue}T00:00:00.000`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function isAllowedCoordinatorSession(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const roleCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("se_role="));

  return roleCookie === "se_role=coordinator" || roleCookie === "se_role=admin";
}

function boolFromAnswer(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes" || normalized === "1") {
      return true;
    }
  }

  return false;
}

export async function GET(request: Request) {
  if (!isAllowedCoordinatorSession(request)) {
    return NextResponse.json({ ok: false, message: "Coordinator access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const selectedDate = normalizeDateParam(searchParams.get("date"));

  if (!prisma) {
    return NextResponse.json({
      ok: true,
      selectedDate,
      summary: {
        total: 0,
        complete: 0,
        pending: 0,
        redFlags: 0,
      },
      rows: [] as ReadinessRow[],
      storage: "no-db",
    });
  }

  const { start, end } = dayRange(selectedDate);

  const appointments = await prisma.appointment.findMany({
    where: {
      appointmentDate: {
        gte: start,
        lt: end,
      },
      status: {
        not: "cancelled",
      },
    },
    orderBy: [{ appointmentTime: "asc" }, { createdAt: "asc" }],
    include: {
      doctor: {
        select: {
          displayName: true,
          email: true,
          photoMimeType: true,
        },
      },
      patientRecord: {
        select: {
          patientId: true,
          fullName: true,
          age: true,
          gender: true,
          region: true,
          preferredLanguage: true,
          heightCm: true,
          weightKg: true,
        },
      },
      payment: {
        select: {
          status: true,
          paidAt: true,
        },
      },
    },
  });

  const appointmentIds = appointments.map((item) => item.id);
  const patientSubmissions = appointmentIds.length
    ? await prisma.questionnaireSubmission.findMany({
        where: {
          appointmentId: { in: appointmentIds },
          NOT: {
            sessionId: { contains: ":doctor" },
          },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          answers: {
            where: {
              key: {
                in: [...urgentRedFlagKeys],
              },
            },
          },
        },
      })
    : [];

  const latestSubmissionByAppointmentId = new Map<string, (typeof patientSubmissions)[number]>();
  for (const submission of patientSubmissions) {
    if (!latestSubmissionByAppointmentId.has(submission.appointmentId)) {
      latestSubmissionByAppointmentId.set(submission.appointmentId, submission);
    }
  }

  const rows: ReadinessRow[] = appointments.map((appointment) => {
    const latestSubmission = latestSubmissionByAppointmentId.get(appointment.id);
    const profileComplete = isProfileComplete(appointment.patientRecord);
    const paymentStatus = appointment.payment?.status ?? "pending";
    const paymentComplete = paymentStatus === "paid" || paymentStatus === "waived";
    const questionnaireComplete = Boolean(
      latestSubmission && latestSubmission.status === "submitted" && latestSubmission.completionPct >= 100,
    );
    const urgentClinicalRedFlag = Boolean(
      latestSubmission?.answers.some((answer) => boolFromAnswer(answer.value)),
    );

    const overallComplete = profileComplete && paymentComplete && questionnaireComplete;

    const doctorName = appointment.doctor.displayName?.trim() || appointment.doctorName;
    const doctorEmail = appointment.doctor.email.trim().toLowerCase();
    const doctorPhotoUrl = appointment.doctor.photoMimeType
      ? `/api/uploads/staff-photo?role=doctor&email=${encodeURIComponent(doctorEmail)}&v=${Date.now()}`
      : "";

    return {
      appointmentId: appointment.id,
      consultSessionId: appointment.consultSessionId ?? appointment.id,
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      patientId: appointment.patientRecord?.patientId ?? "",
      appointmentDate: appointment.appointmentDate.toISOString().slice(0, 10),
      appointmentTime: appointment.appointmentTime,
      appointmentType: appointment.appointmentType,
      appointmentStatus: appointment.status,
      doctorName,
      doctorEmail,
      doctorPhotoUrl,
      checks: {
        profileComplete,
        paymentComplete,
        questionnaireComplete,
      },
      payment: {
        status: paymentStatus,
        paidAt: appointment.payment?.paidAt?.toISOString() ?? null,
      },
      redFlag: urgentClinicalRedFlag,
      overallComplete,
    };
  });

  const complete = rows.filter((item) => item.overallComplete).length;
  const pending = rows.length - complete;
  const redFlags = rows.filter((item) => item.redFlag).length;

  return NextResponse.json({
    ok: true,
    selectedDate,
    summary: {
      total: rows.length,
      complete,
      pending,
      redFlags,
    },
    rows,
    storage: "database",
  });
}

export async function PATCH(request: Request) {
  if (!isAllowedCoordinatorSession(request)) {
    return NextResponse.json({ ok: false, message: "Coordinator access required" }, { status: 403 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
  }

  const parsed = paymentUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid payment payload" }, { status: 400 });
  }

  const { appointmentId, status, amountPaise, notes } = parsed.data;

  const existingAppointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true },
  });

  if (!existingAppointment) {
    return NextResponse.json({ ok: false, message: "Appointment not found" }, { status: 404 });
  }

  const payment = await prisma.appointmentPayment.upsert({
    where: { appointmentId },
    create: {
      appointmentId,
      status,
      amountPaise,
      notes,
      paidAt: status === "paid" ? new Date() : null,
    },
    update: {
      status,
      amountPaise,
      notes,
      paidAt: status === "paid" ? new Date() : null,
    },
    select: {
      appointmentId: true,
      status: true,
      paidAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    payment: {
      appointmentId: payment.appointmentId,
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() ?? null,
      updatedAt: payment.updatedAt.toISOString(),
    },
  });
}
