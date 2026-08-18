import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeCarePlan, type CarePlan, type CarePlanRecord } from "@/lib/care-plan";

const carePlanAnswerKeys = {
  plan: "__visitCarePlan",
  generatedAt: "__visitCarePlanGeneratedAt",
  updatedAt: "__visitCarePlanUpdatedAt",
  edited: "__visitCarePlanEditedByDoctor",
} as const;

export type CarePlanVisitRecord = CarePlanRecord & {
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
};

function doctorSessionId(consultSessionId: string) {
  return `${consultSessionId}:doctor`;
}

function readCarePlanFromAnswers(answers: Array<{ key: string; value: unknown }>) {
  const plan = normalizeCarePlan(answers.find((answer) => answer.key === carePlanAnswerKeys.plan)?.value);
  if (!plan) {
    return null;
  }

  const readString = (key: string) => {
    const value = answers.find((answer) => answer.key === key)?.value;
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  };

  return {
    plan,
    generatedAt: readString(carePlanAnswerKeys.generatedAt),
    updatedAt: readString(carePlanAnswerKeys.updatedAt),
    editedByDoctor: answers.find((answer) => answer.key === carePlanAnswerKeys.edited)?.value === true,
  };
}

export async function getCarePlan(consultSessionId: string): Promise<CarePlanRecord | null> {
  if (!prisma) {
    return null;
  }

  const submission = await prisma.questionnaireSubmission.findFirst({
    where: { sessionId: { in: [doctorSessionId(consultSessionId), consultSessionId] } },
    include: { answers: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!submission) {
    return null;
  }

  const stored = readCarePlanFromAnswers(submission.answers);
  if (!stored) {
    return null;
  }

  return { consultSessionId, ...stored };
}

export async function listCarePlansByPhone(patientPhone: string): Promise<CarePlanVisitRecord[]> {
  const normalizedPhone = patientPhone.replace(/\D/g, "");
  if (!prisma || normalizedPhone.length < 8) {
    return [];
  }

  const submissions = await prisma.questionnaireSubmission.findMany({
    where: {
      patientPhone: normalizedPhone,
      answers: { some: { key: carePlanAnswerKeys.plan } },
    },
    include: { answers: true, appointment: true },
    orderBy: { updatedAt: "desc" },
  });

  const records: CarePlanVisitRecord[] = [];

  for (const submission of submissions) {
    const stored = readCarePlanFromAnswers(submission.answers);
    if (!stored) {
      continue;
    }

    records.push({
      consultSessionId: submission.sessionId.replace(/:doctor$/, ""),
      ...stored,
      doctorName: submission.appointment.doctorName,
      appointmentDate: submission.appointment.appointmentDate.toISOString().slice(0, 10),
      appointmentTime: submission.appointment.appointmentTime,
    });
  }

  return records;
}

export async function saveCarePlan(input: {
  consultSessionId: string;
  plan: CarePlan;
  editedByDoctor: boolean;
  generatedAt?: string;
}) {
  if (!prisma) {
    return { ok: false as const, message: "Care plan storage is not configured" };
  }

  const submission = await prisma.questionnaireSubmission.findFirst({
    where: { sessionId: { in: [doctorSessionId(input.consultSessionId), input.consultSessionId] } },
    select: { id: true, answers: { where: { key: carePlanAnswerKeys.generatedAt }, select: { value: true } } },
    orderBy: { updatedAt: "desc" },
  });

  if (!submission) {
    return { ok: false as const, message: "Consultation record not found for this visit" };
  }

  const existingGeneratedAt = submission.answers[0]?.value;
  const generatedAt =
    input.generatedAt ??
    (typeof existingGeneratedAt === "string" && existingGeneratedAt.trim().length > 0
      ? existingGeneratedAt
      : new Date().toISOString());
  const updatedAt = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    await tx.questionnaireAnswer.deleteMany({
      where: {
        submissionId: submission.id,
        key: { in: Object.values(carePlanAnswerKeys) },
      },
    });

    await tx.questionnaireAnswer.createMany({
      data: [
        { submissionId: submission.id, key: carePlanAnswerKeys.plan, value: input.plan as unknown as Prisma.InputJsonValue },
        { submissionId: submission.id, key: carePlanAnswerKeys.generatedAt, value: generatedAt },
        { submissionId: submission.id, key: carePlanAnswerKeys.updatedAt, value: updatedAt },
        { submissionId: submission.id, key: carePlanAnswerKeys.edited, value: input.editedByDoctor },
      ],
    });
  });

  return {
    ok: true as const,
    record: {
      consultSessionId: input.consultSessionId,
      plan: input.plan,
      generatedAt,
      updatedAt,
      editedByDoctor: input.editedByDoctor,
    } satisfies CarePlanRecord,
  };
}
