type AnswerValue = string | number | boolean | string[];

export type PromInstrument = "ODI" | "NDI";

export type PromSeverity =
  | "Minimal"
  | "Moderate"
  | "Severe"
  | "Crippling"
  | "Bed-bound / exaggeration"
  | "No disability"
  | "Complete disability"
  | "Not enough data";

export type PromItemScore = {
  key: string;
  label: string;
  score: number | null;
};

export type PromScoreResult = {
  instrument: PromInstrument;
  totalScore: number;
  answeredItems: number;
  expectedItems: number;
  maxScore: number;
  percent: number | null;
  severity: PromSeverity;
  isComplete: boolean;
  itemScores: PromItemScore[];
};

export type PromDisplaySummary = {
  instrument: PromInstrument;
  percent: number;
  severity: PromSeverity;
  source: "patient-auto" | "doctor-entered";
};

type PromItemDefinition = {
  key: string;
  label: string;
};

const neckPrimaryReasons = new Set([
  "neck-pain",
  "arm-pain",
  "numbness",
  "weakness",
  "walking-difficulty",
]);

const odiItems: PromItemDefinition[] = [
  { key: "odiPainIntensity", label: "Pain intensity" },
  { key: "odiPersonalCare", label: "Personal care" },
  { key: "odiLifting", label: "Lifting" },
  { key: "odiWalking", label: "Walking" },
  { key: "odiSitting", label: "Sitting" },
  { key: "odiStanding", label: "Standing" },
  { key: "odiSleeping", label: "Sleeping" },
  { key: "odiSexLife", label: "Sex life" },
  { key: "odiSocialLife", label: "Social life" },
  { key: "odiTravelling", label: "Travelling" },
];

const ndiItems: PromItemDefinition[] = [
  { key: "ndiPainIntensity", label: "Pain intensity" },
  { key: "ndiPersonalCare", label: "Personal care" },
  { key: "ndiLifting", label: "Lifting" },
  { key: "ndiReading", label: "Reading" },
  { key: "ndiHeadaches", label: "Headaches" },
  { key: "ndiConcentration", label: "Concentration" },
  { key: "ndiWork", label: "Work" },
  { key: "ndiDriving", label: "Driving" },
  { key: "ndiSleeping", label: "Sleeping" },
  { key: "ndiRecreation", label: "Recreation" },
];

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizePromItemScore(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) {
    return null;
  }

  if (parsed < 0 || parsed > 5) {
    return null;
  }

  return Math.round(parsed);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function odiSeverityFromPercent(percent: number): PromSeverity {
  if (percent <= 20) return "Minimal";
  if (percent <= 40) return "Moderate";
  if (percent <= 60) return "Severe";
  if (percent <= 80) return "Crippling";
  return "Bed-bound / exaggeration";
}

function ndiSeverityFromRaw(rawScore: number): PromSeverity {
  if (rawScore <= 4) return "No disability";
  if (rawScore <= 14) return "Minimal";
  if (rawScore <= 24) return "Moderate";
  if (rawScore <= 34) return "Severe";
  return "Complete disability";
}

function inferPromInstrumentFromPrimaryReason(primaryReason: unknown): PromInstrument {
  if (typeof primaryReason === "string" && neckPrimaryReasons.has(primaryReason)) {
    return "NDI";
  }

  return "ODI";
}

export function inferPromInstrument(answers: Record<string, unknown>): PromInstrument {
  return inferPromInstrumentFromPrimaryReason(answers.q1PrimaryReason);
}

export function computePromScore(answers: Record<string, unknown>): PromScoreResult {
  const instrument = inferPromInstrument(answers);
  const itemDefinitions = instrument === "ODI" ? odiItems : ndiItems;

  const itemScores = itemDefinitions.map((item) => ({
    key: item.key,
    label: item.label,
    score: normalizePromItemScore(answers[item.key]),
  }));

  const answeredItems = itemScores.filter((item) => item.score !== null).length;
  const totalScore = itemScores.reduce((sum, item) => sum + (item.score ?? 0), 0);
  const maxScore = answeredItems * 5;
  const expectedItems = itemDefinitions.length;
  const isComplete = answeredItems === expectedItems;
  const percent = maxScore > 0 ? roundOne((totalScore / maxScore) * 100) : null;

  let severity: PromSeverity = "Not enough data";
  if (percent !== null) {
    if (instrument === "ODI") {
      severity = odiSeverityFromPercent(percent);
    } else if (isComplete) {
      severity = ndiSeverityFromRaw(totalScore);
    } else {
      severity = odiSeverityFromPercent(percent);
    }
  }

  return {
    instrument,
    totalScore,
    answeredItems,
    expectedItems,
    maxScore,
    percent,
    severity,
    isComplete,
    itemScores,
  };
}

export function buildPromAuditPayload(answers: Record<string, unknown>) {
  const score = computePromScore(answers);
  return {
    version: "prom-v1-strict",
    generatedAt: new Date().toISOString(),
    instrument: score.instrument,
    totalScore: score.totalScore,
    answeredItems: score.answeredItems,
    expectedItems: score.expectedItems,
    maxScore: score.maxScore,
    percent: score.percent,
    severity: score.severity,
    isComplete: score.isComplete,
    itemScores: score.itemScores,
  };
}

export function getPromSummaryFromAudit(audit: unknown): PromDisplaySummary | null {
  if (!audit || typeof audit !== "object") {
    return null;
  }

  const data = audit as {
    instrument?: unknown;
    percent?: unknown;
    severity?: unknown;
  };

  const instrument = data.instrument === "ODI" || data.instrument === "NDI" ? data.instrument : null;
  const percent = toFiniteNumber(data.percent);
  const severity = typeof data.severity === "string" ? (data.severity as PromSeverity) : null;

  if (!instrument || percent === null || !severity) {
    return null;
  }

  return {
    instrument,
    percent,
    severity,
    source: "patient-auto",
  };
}

export function extractDoctorPromSummary(
  answers: Record<string, AnswerValue>,
  fallbackInstrument?: PromInstrument,
): PromDisplaySummary | null {
  const odiPercent = toFiniteNumber(answers.odiPercent);
  const ndiPercent = toFiniteNumber(answers.ndiPercent);
  const instrument =
    fallbackInstrument === "NDI"
      ? ndiPercent !== null
        ? "NDI"
        : odiPercent !== null
          ? "ODI"
          : null
      : fallbackInstrument === "ODI"
        ? odiPercent !== null
          ? "ODI"
          : ndiPercent !== null
            ? "NDI"
            : null
        : ndiPercent !== null
          ? "NDI"
          : odiPercent !== null
            ? "ODI"
            : null;

  if (!instrument) {
    return null;
  }

  const percent = instrument === "ODI" ? odiPercent : ndiPercent;
  if (percent === null) {
    return null;
  }

  return {
    instrument,
    percent,
    severity: odiSeverityFromPercent(percent),
    source: "doctor-entered",
  };
}
