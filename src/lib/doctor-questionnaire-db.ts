import { Prisma } from "@prisma/client";
import { doctorQuestionnaireDefinition } from "@/lib/questionnaire";
import { prisma } from "@/lib/prisma";

export const doctorQuestionnaireSlug = "sei-doctor-consult-v1";

type DoctorAnswerValue = string | number | boolean | string[];

type DoctorQuestionnairePayload = {
  consultSessionId: string;
  answers: Record<string, DoctorAnswerValue>;
  stepIndex: number;
  submitted: boolean;
  patientName?: string;
  patientPhone?: string;
  appointmentTime?: string;
  appointmentType?: string;
  appointmentStatus?: string;
  updatedAt?: string;
};

export type DoctorQuestionnaireRecord = DoctorQuestionnairePayload & {
  source: "database";
};

function answerValue(value: DoctorAnswerValue) {
  return value as Prisma.InputJsonValue;
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeEmailPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "demo";
}

function jsonObject(value: unknown) {
  return value as Prisma.InputJsonObject;
}

function buildDoctorScore(answers: Record<string, DoctorAnswerValue>) {
  const validation = String(answers.summaryValidation ?? "").trim();

  if (validation === "clinically-accurate") {
    return 100;
  }

  if (validation === "partially-accurate") {
    return 70;
  }

  if (validation === "needs-correction") {
    return 40;
  }

  return 0;
}

function getQuestionnaireQuestionData(questionnaireId: string) {
  return doctorQuestionnaireDefinition.questions.map((question, index) => ({
    questionnaireId,
    key: question.id,
    label: question.label,
    type: question.type,
    helpText: question.helpText ?? null,
    sortOrder: index + 1,
    config: jsonObject({
      sectionId: question.sectionId ?? null,
      sectionTitle: question.sectionTitle ?? null,
      required: Boolean(question.required),
      options: question.options ?? [],
      multiSelect: Boolean(question.multiSelect),
      placeholder: question.placeholder ?? null,
      min: question.min ?? null,
      max: question.max ?? null,
      step: question.step ?? null,
    }),
  }));
}

type QuestionShapeRow = {
  key: string;
  label: string;
  type: string;
  helpText: string | null;
  sortOrder: number;
  config: unknown;
};

function normalizeQuestionConfig(config: unknown) {
  const source = (config ?? {}) as {
    sectionId?: string | null;
    sectionTitle?: string | null;
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
    multiSelect?: boolean;
    placeholder?: string | null;
    min?: number | null;
    max?: number | null;
    step?: number | null;
  };

  return {
    sectionId: source.sectionId ?? null,
    sectionTitle: source.sectionTitle ?? null,
    required: Boolean(source.required),
    options: Array.isArray(source.options) ? source.options : [],
    multiSelect: Boolean(source.multiSelect),
    placeholder: source.placeholder ?? null,
    min: source.min ?? null,
    max: source.max ?? null,
    step: source.step ?? null,
  };
}

function hasSameQuestionShape(expected: QuestionShapeRow[], existing: QuestionShapeRow[]) {
  if (expected.length !== existing.length) {
    return false;
  }

  return expected.every((expectedRow, index) => {
    const existingRow = existing[index];
    if (!existingRow) {
      return false;
    }

    return (
      expectedRow.key === existingRow.key &&
      expectedRow.label === existingRow.label &&
      expectedRow.type === existingRow.type &&
      expectedRow.helpText === existingRow.helpText &&
      expectedRow.sortOrder === existingRow.sortOrder &&
      JSON.stringify(normalizeQuestionConfig(expectedRow.config)) ===
        JSON.stringify(normalizeQuestionConfig(existingRow.config))
    );
  });
}

async function ensureDoctorQuestionnaire() {
  if (!prisma) {
    return null;
  }

  const questionnaire = await prisma.questionnaire.upsert({
    where: { slug: doctorQuestionnaireSlug },
    create: {
      slug: doctorQuestionnaireSlug,
      title: doctorQuestionnaireDefinition.title,
      subtitle: doctorQuestionnaireDefinition.subtitle,
      version: 1,
      audience: ["doctor"],
    },
    update: {
      title: doctorQuestionnaireDefinition.title,
      subtitle: doctorQuestionnaireDefinition.subtitle,
      audience: ["doctor"],
    },
  });

    const expectedQuestionData = getQuestionnaireQuestionData(questionnaire.id);
  const existingQuestions = await prisma.questionnaireQuestion.findMany({
    where: { questionnaireId: questionnaire.id },
      select: {
        key: true,
        label: true,
        type: true,
        helpText: true,
        sortOrder: true,
        config: true,
      },
      orderBy: { sortOrder: "asc" },
  });

    const hasCurrentShape = hasSameQuestionShape(expectedQuestionData, existingQuestions);

  if (!hasCurrentShape) {
    await prisma.questionnaireQuestion.deleteMany({ where: { questionnaireId: questionnaire.id } });
      await prisma.questionnaireQuestion.createMany({ data: expectedQuestionData });
  }

  return questionnaire;
}

export async function getDoctorQuestionnaireContent() {
  if (!prisma) {
    return {
      source: "local" as const,
      definition: doctorQuestionnaireDefinition,
    };
  }

  try {
    const questionnaire = await ensureDoctorQuestionnaire();

    if (!questionnaire) {
      return {
        source: "local" as const,
        definition: doctorQuestionnaireDefinition,
      };
    }

    const questions = await prisma.questionnaireQuestion.findMany({
      where: { questionnaireId: questionnaire.id },
      orderBy: { sortOrder: "asc" },
    });

    return {
      source: "database" as const,
      definition: {
        id: doctorQuestionnaireDefinition.id,
        title: questionnaire.title,
        subtitle: questionnaire.subtitle,
        audience: ["doctor"],
        questions: questions.map((question) => {
          const config = question.config as {
            sectionId?: string;
            sectionTitle?: string;
            required?: boolean;
            options?: Array<{ label: string; value: string }>;
            multiSelect?: boolean;
            placeholder?: string;
            min?: number;
            max?: number;
            step?: number;
          };

          return {
            id: question.key,
            label: question.label,
            type: question.type,
            helpText: question.helpText ?? undefined,
              sectionId: typeof config.sectionId === "string" ? config.sectionId : undefined,
              sectionTitle: typeof config.sectionTitle === "string" ? config.sectionTitle : undefined,
            required: Boolean(config.required),
            options: Array.isArray(config.options) ? config.options : undefined,
              multiSelect: Boolean(config.multiSelect),
            placeholder: typeof config.placeholder === "string" ? config.placeholder : undefined,
            min: typeof config.min === "number" ? config.min : undefined,
            max: typeof config.max === "number" ? config.max : undefined,
            step: typeof config.step === "number" ? config.step : undefined,
          };
        }),
      },
    };
  } catch {
    return {
      source: "local" as const,
      definition: doctorQuestionnaireDefinition,
    };
  }
}

export async function getSavedDoctorQuestionnaire(input: { consultSessionId?: string }) {
  if (!prisma || !input.consultSessionId) {
    return null;
  }

  const submissionSessionId = `${input.consultSessionId}:doctor`;

  try {
    const submission = await prisma.questionnaireSubmission.findUnique({
      where: { sessionId: submissionSessionId },
      include: { answers: true },
    });

    if (!submission) {
      return null;
    }

    return {
      source: "database" as const,
      consultSessionId: input.consultSessionId,
      answers: Object.fromEntries(
        submission.answers
          .filter((answer) => answer.key !== "doctorScore")
          .map((answer) => [answer.key, answer.value as DoctorAnswerValue]),
      ),
      stepIndex: submission.questionIndex,
      submitted: submission.status === "submitted",
      updatedAt: submission.updatedAt.toISOString(),
      score: submission.answers.find((answer) => answer.key === "doctorScore")?.value ?? null,
    };
  } catch {
    return null;
  }
}

export async function saveDoctorQuestionnaireToDatabase(record: DoctorQuestionnairePayload) {
  const database = prisma;

  if (!database) {
    return { ok: true as const, storage: "local" as const, persisted: false };
  }

  const questionnaire = await ensureDoctorQuestionnaire();
  if (!questionnaire) {
    return { ok: true as const, storage: "local" as const, persisted: false };
  }

  const status = record.submitted ? "submitted" : "draft";
  const totalQuestions = Math.max(1, doctorQuestionnaireDefinition.questions.length);
  const answeredCount = Object.values(record.answers).filter((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return value !== undefined && value !== null;
  }).length;
  const completionPct = Math.min(100, Math.round((answeredCount / totalQuestions) * 100));
  const doctorScore = buildDoctorScore(record.answers);
  const submissionSessionId = `${record.consultSessionId}:doctor`;

  const saved = await database.$transaction(async (tx) => {
    let appointment = await tx.appointment.findFirst({
      where: {
        OR: [{ consultSessionId: record.consultSessionId }, { id: record.consultSessionId }],
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!appointment) {
      const normalizedPhone = normalizePhone(record.patientPhone || record.consultSessionId);
      const patientDisplayName = String(record.patientName || "Patient").trim() || "Patient";
      const patientEmail = `patient-${normalizedPhone || normalizeEmailPart(record.consultSessionId)}@spinexpert.local`;

      const patientUser = await tx.user.upsert({
        where: { email: patientEmail },
        create: {
          email: patientEmail,
          passwordHash: `patient:${normalizedPhone || record.consultSessionId}`,
          role: "patient",
          displayName: patientDisplayName,
        },
        update: {
          displayName: patientDisplayName,
        },
      });

      const existingDoctor = await tx.doctorProfile.findFirst({
        include: { user: true },
        orderBy: { createdAt: "asc" },
      });

      const doctorUser = existingDoctor
        ? existingDoctor.user
        : await tx.user.upsert({
            where: { email: "doctor-auto-assigned@spinexpert.local" },
            create: {
              email: "doctor-auto-assigned@spinexpert.local",
              passwordHash: "doctor:auto-assigned",
              role: "doctor",
              displayName: "Assigned SpinExpert doctor",
              doctorProfile: {
                create: {
                  name: "Assigned SpinExpert doctor",
                  phone: "not-provided",
                  registrationNumber: "auto-assigned",
                  licenseNumber: "auto-assigned",
                  bio: "",
                },
              },
            },
            update: {
              displayName: "Assigned SpinExpert doctor",
            },
          });

      const appointmentDate = new Date();
      appointment = await tx.appointment.upsert({
        where: { consultSessionId: record.consultSessionId },
        create: {
          consultSessionId: record.consultSessionId,
          patientId: patientUser.id,
          patientName: patientDisplayName,
          patientPhone: normalizedPhone,
          doctorId: doctorUser.id,
          doctorName: doctorUser.displayName,
          appointmentDate,
          appointmentTime: String(record.appointmentTime || "09:00"),
          appointmentType: String(record.appointmentType || "questionnaire"),
          status: "submitted",
          createdBy: "doctor",
          notes: "Auto-created for doctor questionnaire submission",
        } as never,
        update: {
          patientName: patientDisplayName,
          patientPhone: normalizedPhone,
          appointmentTime: String(record.appointmentTime || "09:00"),
          appointmentType: String(record.appointmentType || "questionnaire"),
          status: String(record.appointmentStatus || "submitted"),
          updatedAt: appointmentDate,
        } as never,
      });
    }

    const submission = await tx.questionnaireSubmission.upsert({
      where: { sessionId: submissionSessionId },
      create: {
        questionnaireId: questionnaire.id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        sessionId: submissionSessionId,
        patientPhone: appointment.patientPhone || null,
        status,
        sectionIndex: 0,
        questionIndex: record.stepIndex,
        completionPct,
        durationSeconds: 0,
        bmi: null,
      },
      update: {
        status,
        questionIndex: record.stepIndex,
        completionPct,
      },
    });

    await tx.questionnaireAnswer.deleteMany({ where: { submissionId: submission.id } });
    await tx.questionnaireAnswer.createMany({
      data: [
        ...Object.entries(record.answers).map(([key, value]) => ({
          submissionId: submission.id,
          key,
          value: answerValue(value),
        })),
        {
          submissionId: submission.id,
          key: "doctorScore",
          value: answerValue(doctorScore),
        },
      ],
    });

    return { submissionId: submission.id, score: doctorScore };
  });

  return {
    ok: true as const,
    storage: "database" as const,
    persisted: true,
    submissionId: saved.submissionId,
    score: saved.score,
  };
}
