import { prisma } from "@/lib/prisma";

export type AdminSummary = {
  totalPatients: number;
  completedPatients: number;
  completionRate: number;
  averageBmi: number;
  totalDoctors: number;
  totalRegionsServed: number;
};

export type UsageMetric = {
  label: string;
  value: string;
  note: string;
  progress: number;
};

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
}

async function getDoctorReviewLatencyMinutes() {
  if (!prisma) {
    return null;
  }

  const doctorSubmissions = await prisma.questionnaireSubmission.findMany({
    where: {
      status: "submitted",
      sessionId: { contains: ":doctor" },
    },
    select: {
      appointmentId: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });

  if (doctorSubmissions.length === 0) {
    return null;
  }

  const patientSubmissionByAppointmentId = new Map(
    (
      await prisma.questionnaireSubmission.findMany({
        where: {
          status: "submitted",
          sessionId: { not: { contains: ":doctor" } },
          appointmentId: { in: doctorSubmissions.map((item) => item.appointmentId) },
        },
        select: {
          appointmentId: true,
          updatedAt: true,
        },
      })
    ).map((item) => [item.appointmentId, item.updatedAt]),
  );

  const durations = doctorSubmissions
    .map((doctorItem) => {
      const patientUpdatedAt = patientSubmissionByAppointmentId.get(doctorItem.appointmentId);
      if (!patientUpdatedAt) {
        return null;
      }

      const diffMs = doctorItem.updatedAt.getTime() - patientUpdatedAt.getTime();
      return diffMs >= 0 ? diffMs / 60000 : null;
    })
    .filter((value): value is number => value !== null);

  if (durations.length === 0) {
    return null;
  }

  const total = durations.reduce((sum, value) => sum + value, 0);
  return Math.round(total / durations.length);
}

export async function getAdminSummary(): Promise<AdminSummary> {
  if (!prisma) {
    return {
      totalPatients: 0,
      completedPatients: 0,
      completionRate: 0,
      averageBmi: 0,
      totalDoctors: 0,
      totalRegionsServed: 0,
    };
  }

  const [totalPatients, completedPatients, bmiAggregate, totalDoctors, regionRows] = await Promise.all([
    prisma.questionnaireSubmission.count({
      where: {
        sessionId: { not: { contains: ":doctor" } },
      },
    }),
    prisma.questionnaireSubmission.count({
      where: {
        status: "submitted",
        sessionId: { not: { contains: ":doctor" } },
      },
    }),
    prisma.questionnaireSubmission.aggregate({
      where: {
        status: "submitted",
        sessionId: { not: { contains: ":doctor" } },
        bmi: { not: null },
      },
      _avg: { bmi: true },
    }),
    prisma.doctorProfile.count(),
    prisma.patientRecord.findMany({
      where: {
        region: {
          not: null,
        },
      },
      select: {
        region: true,
      },
    }),
  ]);

  const completionRate = totalPatients > 0 ? Math.round((completedPatients / totalPatients) * 100) : 0;
  const averageBmi = Number((bmiAggregate._avg.bmi ?? 0).toFixed(1));
  const totalRegionsServed = new Set(
    regionRows
      .map((row) => row.region?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  ).size;

  return {
    totalPatients,
    completedPatients,
    completionRate,
    averageBmi,
    totalDoctors,
    totalRegionsServed,
  };
}

export async function getUsageMetrics(): Promise<UsageMetric[]> {
  if (!prisma) {
    return [
      {
        label: "Average completion time",
        value: "0m 00s",
        note: "Median across completed patient flows",
        progress: 0,
      },
      {
        label: "Weekly submissions",
        value: "0",
        note: "Submitted in last 7 days",
        progress: 0,
      },
      {
        label: "Autosave resume rate",
        value: "0%",
        note: "Users continue from the last saved step",
        progress: 0,
      },
      {
        label: "Doctor review latency",
        value: "0m",
        note: "Patient submit to doctor submit (average)",
        progress: 0,
      },
    ];
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [submittedRows, weeklySubmissions, totalSubmissions, resumedSubmissions, doctorReviewLatencyMinutes] =
    await Promise.all([
      prisma.questionnaireSubmission.findMany({
        where: {
          status: "submitted",
          sessionId: { not: { contains: ":doctor" } },
        },
        select: {
          durationSeconds: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.questionnaireSubmission.count({
        where: {
          status: "submitted",
          sessionId: { not: { contains: ":doctor" } },
          updatedAt: { gte: weekAgo },
        },
      }),
      prisma.questionnaireSubmission.count({
        where: {
          sessionId: { not: { contains: ":doctor" } },
        },
      }),
      prisma.questionnaireSubmission.count({
        where: {
          sessionId: { not: { contains: ":doctor" } },
          questionIndex: { gt: 0 },
        },
      }),
      getDoctorReviewLatencyMinutes(),
    ]);

  const submissionDurations = submittedRows
    .map((row) => {
      if (row.durationSeconds > 0) {
        return row.durationSeconds;
      }

      // Fallback for older rows that saved with durationSeconds=0.
      const derived = Math.round((row.updatedAt.getTime() - row.createdAt.getTime()) / 1000);
      return derived > 0 ? derived : null;
    })
    .filter((value): value is number => value !== null);

  const averageDurationSeconds =
    submissionDurations.length > 0
      ? Math.round(submissionDurations.reduce((sum, value) => sum + value, 0) / submissionDurations.length)
      : 0;
  const autosaveResumeRate = totalSubmissions > 0 ? Math.round((resumedSubmissions / totalSubmissions) * 100) : 0;

  return [
    {
      label: "Average completion time",
      value: averageDurationSeconds > 0 ? formatDuration(averageDurationSeconds) : "—",
      note: "Average across submitted patient flows",
      progress: averageDurationSeconds > 0 ? Math.min(100, Math.max(0, 100 - Math.round(averageDurationSeconds / 6))) : 0,
    },
    {
      label: "Weekly submissions",
      value: String(weeklySubmissions),
      note: "Submitted in last 7 days",
      progress: Math.min(100, weeklySubmissions),
    },
    {
      label: "Autosave resume rate",
      value: `${autosaveResumeRate}%`,
      note: "Users continue from the last saved step",
      progress: Math.min(100, autosaveResumeRate),
    },
    {
      label: "Doctor review latency",
      value: typeof doctorReviewLatencyMinutes === "number" ? `${doctorReviewLatencyMinutes}m` : "—",
      note: "Patient submit to doctor submit (average)",
      progress:
        typeof doctorReviewLatencyMinutes === "number"
          ? Math.min(100, Math.max(0, 100 - doctorReviewLatencyMinutes * 4))
          : 0,
    },
  ];
}