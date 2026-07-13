import { prisma } from "@/lib/prisma";

export type AdminSummary = {
  totalPatients: number;
  completedPatients: number;
  completionRate: number;
  averageBmi: number;
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
    return 0;
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
    return 0;
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
      return diffMs > 0 ? diffMs / 60000 : null;
    })
    .filter((value): value is number => value !== null);

  if (durations.length === 0) {
    return 0;
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
    };
  }

  const [totalPatients, completedPatients, bmiAggregate] = await Promise.all([
    prisma.appointment.count(),
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
  ]);

  const completionRate = totalPatients > 0 ? Math.round((completedPatients / totalPatients) * 100) : 0;
  const averageBmi = Number((bmiAggregate._avg.bmi ?? 0).toFixed(1));

  return {
    totalPatients,
    completedPatients,
    completionRate,
    averageBmi,
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

  const [durationAggregate, weeklySubmissions, totalSubmissions, resumedSubmissions, doctorReviewLatencyMinutes] =
    await Promise.all([
      prisma.questionnaireSubmission.aggregate({
        where: {
          status: "submitted",
          sessionId: { not: { contains: ":doctor" } },
        },
        _avg: { durationSeconds: true },
      }),
      prisma.questionnaireSubmission.count({
        where: {
          status: "submitted",
          sessionId: { not: { contains: ":doctor" } },
          createdAt: { gte: weekAgo },
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

  const averageDurationSeconds = Math.round(durationAggregate._avg.durationSeconds ?? 0);
  const autosaveResumeRate = totalSubmissions > 0 ? Math.round((resumedSubmissions / totalSubmissions) * 100) : 0;

  return [
    {
      label: "Average completion time",
      value: formatDuration(averageDurationSeconds),
      note: "Average across submitted patient flows",
      progress: Math.min(100, Math.max(0, 100 - Math.round(averageDurationSeconds / 6))),
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
      value: `${doctorReviewLatencyMinutes}m`,
      note: "Patient submit to doctor submit (average)",
      progress: Math.min(100, Math.max(0, 100 - doctorReviewLatencyMinutes * 4)),
    },
  ];
}