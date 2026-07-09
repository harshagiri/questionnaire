import { Prisma } from "@prisma/client";
import { calculateBmi } from "@/lib/questionnaire";
import { prisma } from "@/lib/prisma";
import { patientWorkflowSections } from "@/lib/workflow-data";

export const patientQuestionnaireSlug = "sei-pq-v3-final";

type PatientAnswerValue = string | number | boolean | string[];

type PatientQuestionnairePayload = {
  sessionId: string;
  answers: Record<string, PatientAnswerValue>;
  sectionIndex: number;
  questionIndex: number;
  submitted: boolean;
  updatedAt?: string;
};

export type PatientQuestionnaireRecord = PatientQuestionnairePayload & {
  source: "database";
};

export type PatientQuestionContent = {
  id: string;
  label: string;
  type: string;
  helpText?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeEmailPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "demo";
}

function jsonObject(value: unknown) {
  return value as Prisma.InputJsonObject;
}

function answerValue(value: PatientAnswerValue) {
  return value as Prisma.InputJsonValue;
}

function getQuestionnaireQuestionData(questionnaireId: string) {
  let sortOrder = 0;

  return patientWorkflowSections.flatMap((section) =>
    section.questions.map((question) => {
      sortOrder += 1;

      return {
        questionnaireId,
        key: question.id,
        label: question.label,
        type: question.type,
        helpText: question.helpText ?? null,
        sortOrder,
        config: jsonObject({
          sectionId: section.id,
          sectionTitle: section.title,
          sectionSubtitle: section.subtitle,
          sectionNote: section.note ?? null,
          required: Boolean(question.required),
          options: question.options ?? [],
          linkedFrom: question.linkedFrom ?? null,
          branchOn: question.branchOn ?? null,
          branchValue: question.branchValue ?? null,
        }),
      };
    }),
  );
}

function getLocalPatientQuestionContent(): PatientQuestionContent[] {
  return patientWorkflowSections.flatMap((section) =>
    section.questions.map((question) => ({
      id: question.id,
      label: question.label,
      type: question.type,
      helpText: question.helpText,
      required: question.required,
      options: question.options,
    })),
  );
}

async function ensurePatientQuestionnaire() {
  if (!prisma) {
    return null;
  }

  const questionnaire = await prisma.questionnaire.upsert({
    where: { slug: patientQuestionnaireSlug },
    create: {
      slug: patientQuestionnaireSlug,
      title: "SpinExpert patient spine intake",
      subtitle: "Pre-consult spine health assessment",
      version: 3,
      audience: ["patient", "doctor"],
    },
    update: {
      title: "SpinExpert patient spine intake",
      subtitle: "Pre-consult spine health assessment",
      version: 3,
      audience: ["patient", "doctor"],
    },
  });

  const expectedKeys = patientWorkflowSections.flatMap((section) => section.questions.map((question) => question.id));
  const existingQuestions = await prisma.questionnaireQuestion.findMany({
    where: { questionnaireId: questionnaire.id },
    select: { key: true },
  });
  const existingKeys = new Set(existingQuestions.map((question) => question.key));
  const hasCurrentShape = expectedKeys.length === existingKeys.size && expectedKeys.every((key) => existingKeys.has(key));

  if (!hasCurrentShape) {
    await prisma.questionnaireQuestion.deleteMany({ where: { questionnaireId: questionnaire.id } });
    await prisma.questionnaireQuestion.createMany({ data: getQuestionnaireQuestionData(questionnaire.id) });
  }

  return questionnaire;
}

export async function getPatientQuestionnaireContent() {
  if (!prisma) {
    return { source: "local" as const, questions: getLocalPatientQuestionContent() };
  }

  try {
    const questionnaire = await ensurePatientQuestionnaire();
    if (!questionnaire) {
      return { source: "local" as const, questions: getLocalPatientQuestionContent() };
    }

    const questions = await prisma.questionnaireQuestion.findMany({
      where: { questionnaireId: questionnaire.id },
      orderBy: { sortOrder: "asc" },
    });

    return {
      source: "database" as const,
      questions: questions.map((question) => {
        const config = question.config as { required?: boolean; options?: Array<{ label: string; value: string }> };

        return {
          id: question.key,
          label: question.label,
          type: question.type,
          helpText: question.helpText ?? undefined,
          required: Boolean(config.required),
          options: Array.isArray(config.options) ? config.options : undefined,
        };
      }),
    };
  } catch {
    return { source: "local" as const, questions: getLocalPatientQuestionContent() };
  }
}

export async function getSavedPatientQuestionnaire(input: { sessionId?: string; phone?: string }) {
  if (!prisma) {
    return null;
  }

  const phone = normalizePhone(input.phone);

  try {
    const submission = input.sessionId
      ? await prisma.questionnaireSubmission.findUnique({
          where: { sessionId: input.sessionId },
          include: { answers: true },
        })
      : phone
        ? await prisma.questionnaireSubmission.findFirst({
            where: { patientPhone: phone },
            include: { answers: true },
            orderBy: { updatedAt: "desc" },
          })
        : null;

    if (!submission) {
      return null;
    }

    return {
      source: "database" as const,
      sessionId: submission.sessionId,
      answers: Object.fromEntries(submission.answers.map((answer) => [answer.key, answer.value as PatientAnswerValue])),
      sectionIndex: submission.sectionIndex,
      questionIndex: submission.questionIndex,
      submitted: submission.status === "submitted",
      updatedAt: submission.updatedAt.toISOString(),
    };
  } catch {
    return null;
  }
}

async function upsertPatientUser(answers: Record<string, PatientAnswerValue>, sessionId: string) {
  if (!prisma) {
    throw new Error("Prisma unavailable");
  }

  const phone = normalizePhone(answers.phone) || normalizePhone(sessionId);
  const email = `patient-${phone || normalizeEmailPart(sessionId)}@spinexpert.local`;
  const fullName = String(answers.patientName ?? "Patient").trim() || "Patient";

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: `patient:${phone || sessionId}`,
      role: "patient",
      displayName: fullName,
      patientProfile: {
        create: {
          fullName,
          age: Number(answers.age ?? 0),
          gender: String(answers.gender ?? "not-provided"),
          region: String(answers.region ?? "not-provided"),
          phone: phone || "not-provided",
          aadhar: String(answers.aadhar ?? "not-provided"),
        },
      },
    },
    update: {
      displayName: fullName,
      patientProfile: {
        upsert: {
          create: {
            fullName,
            age: Number(answers.age ?? 0),
            gender: String(answers.gender ?? "not-provided"),
            region: String(answers.region ?? "not-provided"),
            phone: phone || "not-provided",
            aadhar: String(answers.aadhar ?? "not-provided"),
          },
          update: {
            fullName,
            age: Number(answers.age ?? 0),
            gender: String(answers.gender ?? "not-provided"),
            region: String(answers.region ?? "not-provided"),
            phone: phone || "not-provided",
          },
        },
      },
    },
  });

  return { user, phone };
}

async function resolveAssignedDoctorUser() {
  if (!prisma) {
    throw new Error("Prisma unavailable");
  }

  const existingDoctor = await prisma.doctorProfile.findFirst({
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  if (existingDoctor) {
    return existingDoctor.user;
  }

  const doctorName = "Assigned SpinExpert doctor";
  const license = "auto-assigned";
  const email = `doctor-${normalizeEmailPart(license)}@spinexpert.local`;

  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash: `doctor:${license}`,
      role: "doctor",
      displayName: doctorName,
      doctorProfile: {
        create: {
          name: doctorName,
          phone: "not-provided",
          registrationNumber: license,
          licenseNumber: license,
          bio: "",
        },
      },
    },
    update: {
      displayName: doctorName,
      doctorProfile: {
        upsert: {
          create: {
            name: doctorName,
            phone: "not-provided",
            registrationNumber: license,
            licenseNumber: license,
            bio: "",
          },
          update: {
            name: doctorName,
            registrationNumber: license,
            licenseNumber: license,
          },
        },
      },
    },
  });
}

export async function savePatientQuestionnaireToDatabase(record: PatientQuestionnairePayload) {
  if (!prisma) {
    return { ok: true as const, storage: "local" as const, persisted: false };
  }

  const questionnaire = await ensurePatientQuestionnaire();
  if (!questionnaire) {
    return { ok: true as const, storage: "local" as const, persisted: false };
  }

  const { user: patientUser, phone } = await upsertPatientUser(record.answers, record.sessionId);
  const doctorUser = await resolveAssignedDoctorUser();
  const status = record.submitted ? "submitted" : "draft";
  const bmi = calculateBmi(Number(record.answers.weightKg), Number(record.answers.heightCm));
  const answeredCount = Object.values(record.answers).filter((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return value !== undefined && value !== null;
  }).length;
  const completionPct = Math.min(100, Math.round((answeredCount / Math.max(1, patientWorkflowSections.flatMap((section) => section.questions).length)) * 100));

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.questionnaireSubmission.findUnique({
      where: { sessionId: record.sessionId },
      select: { id: true, appointmentId: true },
    });

    const appointment = existing
      ? await tx.appointment.update({
          where: { id: existing.appointmentId },
          data: { status: record.submitted ? "submitted" : "draft", updatedAt: new Date() },
        })
      : await tx.appointment.create({
          data: {
            patientId: patientUser.id,
            doctorId: doctorUser.id,
            appointmentDate: new Date(),
            status: record.submitted ? "submitted" : "draft",
            createdBy: "patient",
            notes: `Patient questionnaire session: ${record.sessionId}`,
          },
        });

    const submission = await tx.questionnaireSubmission.upsert({
      where: { sessionId: record.sessionId },
      create: {
        questionnaireId: questionnaire.id,
        appointmentId: appointment.id,
        patientId: patientUser.id,
        doctorId: doctorUser.id,
        sessionId: record.sessionId,
        patientPhone: phone || null,
        status,
        sectionIndex: record.sectionIndex,
        questionIndex: record.questionIndex,
        completionPct,
        durationSeconds: 0,
        bmi,
      },
      update: {
        patientPhone: phone || null,
        status,
        sectionIndex: record.sectionIndex,
        questionIndex: record.questionIndex,
        completionPct,
        bmi,
      },
    });

    await tx.questionnaireAnswer.deleteMany({ where: { submissionId: submission.id } });
    await tx.questionnaireAnswer.createMany({
      data: Object.entries(record.answers).map(([key, value]) => ({
        submissionId: submission.id,
        key,
        value: answerValue(value),
      })),
    });

    return submission;
  });

  return { ok: true as const, storage: "database" as const, persisted: true, submissionId: saved.id };
}
