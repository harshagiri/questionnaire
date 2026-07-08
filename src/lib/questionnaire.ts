import type { AppRole } from "@/lib/rbac";

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "tel"
  | "email"
  | "select"
  | "radio"
  | "toggle"
  | "range"
  | "date";

export type QuestionOption = {
  label: string;
  value: string;
};

export type QuestionnaireQuestion = {
  id: string;
  label: string;
  helpText?: string;
  type: QuestionType;
  required?: boolean;
  placeholder?: string;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  step?: number;
  condition?: (answers: Record<string, string | number | boolean>) => boolean;
};

export type QuestionnaireDefinition = {
  id: string;
  title: string;
  subtitle: string;
  audience: AppRole[];
  questions: QuestionnaireQuestion[];
};

export const questionnaireDefinition: QuestionnaireDefinition = {
  id: "health-screening-core",
  title: "Health screening questionnaire",
  subtitle:
    "A calm, adaptive intake flow that captures patient basics, symptoms, and consult context.",
  audience: ["patient", "doctor"],
  questions: [
    {
      id: "fullName",
      label: "What is your full name?",
      type: "text",
      required: true,
      placeholder: "Enter your name",
    },
    {
      id: "age",
      label: "Age",
      type: "number",
      required: true,
      min: 0,
      max: 120,
      helpText: "This helps adapt the questionnaire by age band.",
    },
    {
      id: "gender",
      label: "Gender",
      type: "select",
      required: true,
      options: [
        { label: "Female", value: "female" },
        { label: "Male", value: "male" },
        { label: "Non-binary", value: "non-binary" },
        { label: "Prefer not to say", value: "prefer-not-to-say" },
      ],
    },
    {
      id: "region",
      label: "Region",
      type: "text",
      required: true,
      placeholder: "City, district, or area",
    },
    {
      id: "phone",
      label: "Phone number",
      type: "tel",
      required: true,
      placeholder: "10-digit mobile number",
    },
    {
      id: "aadhar",
      label: "Aadhaar number",
      type: "text",
      required: true,
      placeholder: "12-digit ID",
    },
    {
      id: "doctorName",
      label: "Doctor name",
      type: "text",
      required: true,
      placeholder: "Consulting doctor",
    },
    {
      id: "doctorLicense",
      label: "Doctor registration / license number",
      type: "text",
      required: true,
    },
    {
      id: "weightKg",
      label: "Current weight (kg)",
      type: "number",
      min: 1,
      max: 400,
      required: true,
    },
    {
      id: "heightCm",
      label: "Height (cm)",
      type: "number",
      min: 40,
      max: 250,
      required: true,
    },
    {
      id: "symptomFocus",
      label: "What is the main concern today?",
      type: "textarea",
      required: true,
      placeholder: "Describe the symptom or reason for the visit",
    },
    {
      id: "hasPain",
      label: "Are you experiencing pain?",
      type: "toggle",
      required: true,
    },
    {
      id: "painScore",
      label: "Pain score",
      type: "range",
      min: 0,
      max: 10,
      step: 1,
      helpText: "Shown only when pain is reported.",
      condition: (answers) => Boolean(answers.hasPain),
    },
    {
      id: "symptomDays",
      label: "How many days have symptoms been present?",
      type: "number",
      min: 0,
      max: 3650,
      condition: (answers) => Number(answers.age ?? 0) >= 12,
      helpText: "Used to estimate symptom duration.",
    },
    {
      id: "reviewConsent",
      label: "I confirm the information is accurate and I agree to the confidentiality statement.",
      type: "toggle",
      required: true,
    },
  ],
};

export function isQuestionVisible(
  question: QuestionnaireQuestion,
  answers: Record<string, string | number | boolean>,
) {
  return question.condition ? question.condition(answers) : true;
}

export function getVisibleQuestions(answers: Record<string, string | number | boolean>) {
  return questionnaireDefinition.questions.filter((question) => isQuestionVisible(question, answers));
}

export function calculateBmi(weightKg?: number, heightCm?: number) {
  if (!weightKg || !heightCm) {
    return null;
  }

  const heightMeters = heightCm / 100;
  const bmi = weightKg / (heightMeters * heightMeters);

  return Number.isFinite(bmi) ? Number(bmi.toFixed(1)) : null;
}

export function estimateCompletionPercent(current: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((current / total) * 100);
}

export function summarizeAnswer(value: string | number | boolean | string[] | undefined) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === undefined) {
    return "Not filled";
  }

  if (Array.isArray(value)) {
    return value.length === 0 ? "Not filled" : value.join(", ");
  }

  if (value === "") {
    return "Not filled";
  }

  return String(value);
}