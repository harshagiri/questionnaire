export type CarePlan = {
  doctorAssessment: string;
  whatIShouldDoNow: string[];
  whatIShouldNotWorryAbout: string[];
  warningSigns: string[];
  nextAction: string;
  responsiblePerson: string;
  whenItShouldHappen: string;
  reviewedBy: string;
};

export type CarePlanRecord = {
  consultSessionId: string;
  plan: CarePlan;
  generatedAt?: string;
  updatedAt?: string;
  editedByDoctor: boolean;
};

export const emptyCarePlan: CarePlan = {
  doctorAssessment: "",
  whatIShouldDoNow: [],
  whatIShouldNotWorryAbout: [],
  warningSigns: [],
  nextAction: "",
  responsiblePerson: "",
  whenItShouldHappen: "",
  reviewedBy: "",
};

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toCleanList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => toCleanString(item)).filter((item) => item.length > 0);
  }

  const text = toCleanString(value);
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

export function normalizeCarePlan(value: unknown): CarePlan | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const plan: CarePlan = {
    doctorAssessment: toCleanString(raw.doctorAssessment),
    whatIShouldDoNow: toCleanList(raw.whatIShouldDoNow),
    whatIShouldNotWorryAbout: toCleanList(raw.whatIShouldNotWorryAbout),
    warningSigns: toCleanList(raw.warningSigns),
    nextAction: toCleanString(raw.nextAction),
    responsiblePerson: toCleanString(raw.responsiblePerson),
    whenItShouldHappen: toCleanString(raw.whenItShouldHappen),
    reviewedBy: toCleanString(raw.reviewedBy),
  };

  const hasContent =
    plan.doctorAssessment.length > 0 ||
    plan.whatIShouldDoNow.length > 0 ||
    plan.whatIShouldNotWorryAbout.length > 0 ||
    plan.warningSigns.length > 0 ||
    plan.nextAction.length > 0;

  return hasContent ? plan : null;
}

export function formatDoctorSignature(doctorName: string) {
  const cleaned = doctorName.trim().replace(/^dr\.?\s*/i, "");
  return cleaned ? `Dr. ${cleaned}` : "your doctor";
}

export function formatCarePlanMessage(plan: CarePlan) {
  const bulletBlock = (items: string[]) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- Not applicable";

  return [
    "*My Care Plan*",
    "",
    "*What the doctor thinks*",
    plan.doctorAssessment || "Not recorded",
    "",
    "*What I should do now*",
    bulletBlock(plan.whatIShouldDoNow),
    "",
    "*What I should not worry about*",
    bulletBlock(plan.whatIShouldNotWorryAbout),
    "",
    "*Warning signs*",
    bulletBlock(plan.warningSigns),
    "",
    "*My next appointment or action*",
    plan.nextAction || "Not recorded",
    "",
    "*Who is responsible*",
    plan.responsiblePerson || "Not recorded",
    "",
    "*When it should happen*",
    plan.whenItShouldHappen || "Not recorded",
    "",
    `Reviewed and approved by ${formatDoctorSignature(plan.reviewedBy)} as per consultation.`,
  ].join("\n");
}
