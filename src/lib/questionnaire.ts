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
  sectionId?: string;
  sectionTitle?: string;
  type: QuestionType;
  required?: boolean;
  placeholder?: string;
  options?: QuestionOption[];
  multiSelect?: boolean;
  min?: number;
  max?: number;
  step?: number;
  condition?: (answers: Record<string, string | number | boolean | string[]>) => boolean;
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

const doctorQuestionnaireBaseQuestions: QuestionnaireQuestion[] = [
    {
      id: "consultationType",
      label: "Consultation type",
      type: "radio",
      required: true,
      options: [
        { label: "First consultation", value: "first" },
        { label: "Follow-up", value: "follow-up" },
        { label: "Second opinion", value: "second-opinion" },
        { label: "Post-operative review", value: "post-operative-review" },
      ],
    },
    {
      id: "patientRiskCategory",
      label: "Patient risk category (from pre-consult)",
      type: "radio",
      required: true,
      options: [
        { label: "Low risk", value: "low" },
        { label: "Moderate risk", value: "moderate" },
        { label: "High risk", value: "high" },
      ],
    },
    {
      id: "aiSuggestedPathway",
      label: "AI suggested pathway",
      type: "radio",
      options: [
        { label: "Education / reassurance", value: "education" },
        { label: "Conservative pathway", value: "conservative" },
        { label: "Specialist evaluation", value: "specialist-evaluation" },
        { label: "Priority review", value: "priority-review" },
      ],
    },
    {
      id: "summaryValidation",
      label: "Doctor validation after consultation",
      type: "radio",
      required: true,
      options: [
        { label: "Clinically accurate", value: "clinically-accurate" },
        { label: "Partially accurate", value: "partially-accurate" },
        { label: "Needs correction", value: "needs-correction" },
      ],
    },
    {
      id: "primaryProblem",
      label: "Main complaint",
      type: "radio",
      required: true,
      options: [
        { label: "Neck pain", value: "neck-pain" },
        { label: "Back pain", value: "back-pain" },
        { label: "Arm pain / cervical radiculopathy", value: "arm-radiculopathy" },
        { label: "Leg pain / sciatica", value: "leg-sciatica" },
        { label: "Numbness / tingling", value: "numbness-tingling" },
        { label: "Weakness", value: "weakness" },
        { label: "Walking imbalance", value: "walking-imbalance" },
        { label: "Deformity", value: "deformity" },
        { label: "Post-operative problem", value: "post-operative-problem" },
        { label: "Other", value: "other" },
      ],
    },
    {
      id: "symptomDurationBand",
      label: "Duration of symptoms",
      type: "radio",
      options: [
        { label: "< 6 weeks", value: "lt-6-weeks" },
        { label: "6 weeks - 3 months", value: "6-weeks-to-3-months" },
        { label: "3 - 6 months", value: "3-to-6-months" },
        { label: "> 6 months", value: "gt-6-months" },
      ],
    },
    {
      id: "motorWeakness",
      label: "Motor weakness",
      type: "radio",
      options: [
        { label: "No", value: "no" },
        { label: "Present", value: "present" },
      ],
    },
    {
      id: "sensoryDeficit",
      label: "Sensory deficit",
      type: "radio",
      options: [
        { label: "No", value: "no" },
        { label: "Present", value: "present" },
      ],
    },
    {
      id: "bladderBowelInvolvement",
      label: "Bladder / bowel involvement",
      type: "radio",
      options: [
        { label: "No", value: "no" },
        { label: "Present", value: "present" },
      ],
    },
    {
      id: "gaitImbalance",
      label: "Gait imbalance",
      type: "radio",
      options: [
        { label: "No", value: "no" },
        { label: "Present", value: "present" },
      ],
    },
    {
      id: "overallRiskCategory",
      label: "Overall risk category",
      type: "radio",
      required: true,
      options: [
        { label: "Routine spine care", value: "routine" },
        { label: "Needs specialist follow-up", value: "needs-follow-up" },
        { label: "Urgent evaluation required", value: "urgent" },
      ],
    },
    {
      id: "clinicalDiagnosis",
      label: "Working diagnosis",
      type: "radio",
      options: [
        { label: "Non-specific mechanical spine pain", value: "mechanical-pain" },
        { label: "Disc-related disorder", value: "disc-disorder" },
        { label: "Radiculopathy", value: "radiculopathy" },
        { label: "Degenerative spine disease", value: "degenerative" },
        { label: "Spinal stenosis", value: "spinal-stenosis" },
        { label: "Cervical myelopathy", value: "cervical-myelopathy" },
        { label: "Spondylolisthesis", value: "spondylolisthesis" },
        { label: "Deformity / scoliosis", value: "deformity-scoliosis" },
        { label: "Trauma", value: "trauma" },
        { label: "Infection", value: "infection" },
        { label: "Tumour suspicion", value: "tumour-suspicion" },
        { label: "Other", value: "other" },
      ],
    },
    {
      id: "clinicalRemarks",
      label: "Clinical diagnosis / remarks",
      type: "textarea",
      placeholder: "Concise clinical diagnosis statement",
    },
    {
      id: "imagingAvailable",
      label: "Is imaging available?",
      type: "radio",
      options: [
        { label: "None", value: "none" },
        { label: "X-ray", value: "xray" },
        { label: "MRI", value: "mri" },
        { label: "CT", value: "ct" },
        { label: "Other", value: "other" },
      ],
    },
    {
      id: "imagingInterpretation",
      label: "Imaging interpretation",
      type: "radio",
      options: [
        { label: "Symptoms correlate with imaging", value: "correlates" },
        { label: "Partial correlation", value: "partial" },
        { label: "Incidental findings", value: "incidental" },
        { label: "Imaging insufficient", value: "insufficient" },
      ],
    },
    {
      id: "furtherInvestigationRequired",
      label: "Further investigation required?",
      type: "radio",
      options: [
        { label: "No", value: "no" },
        { label: "Yes", value: "yes" },
      ],
    },
    {
      id: "furtherInvestigationReason",
      label: "Further investigation reason",
      type: "radio",
      options: [
        { label: "Diagnosis confirmation", value: "diagnosis-confirmation" },
        { label: "Neurological assessment", value: "neurological-assessment" },
        { label: "Treatment planning", value: "treatment-planning" },
        { label: "Red flag evaluation", value: "red-flag-evaluation" },
      ],
      condition: (answers) => answers.furtherInvestigationRequired === "yes",
    },
    {
      id: "physicalExamRequired",
      label: "Physical examination required by specialist",
      type: "radio",
      required: true,
      options: [
        { label: "Not required", value: "not-required" },
        { label: "Required", value: "required" },
      ],
    },
    {
      id: "physicalExamReason",
      label: "Physical exam reason",
      type: "radio",
      options: [
        { label: "Inconclusive remote findings", value: "inconclusive-remote" },
        { label: "Suspected red flag needing confirmation", value: "red-flag-confirmation" },
        { label: "Imaging / history mismatch", value: "imaging-history-mismatch" },
        { label: "Other", value: "other" },
      ],
      condition: (answers) => answers.physicalExamRequired === "required",
    },
    {
      id: "carePathway",
      label: "Final care pathway",
      type: "radio",
      required: true,
      options: [
        { label: "Pathway 1 - Education and reassurance", value: "pathway-1" },
        { label: "Pathway 2 - Conservative spine care", value: "pathway-2" },
        { label: "Pathway 3 - Further evaluation", value: "pathway-3" },
        { label: "Pathway 4 - Surgical evaluation", value: "pathway-4" },
        { label: "Pathway 5 - Urgent intervention", value: "pathway-5" },
      ],
    },
    {
      id: "carePathwayReason",
      label: "Pathway rationale",
      type: "textarea",
      placeholder: "Clinical rationale for selected pathway",
    },
    {
      id: "labInvestigations",
      label: "Laboratory investigations advised",
      type: "textarea",
      placeholder: "CBC, ESR, CRP, Vitamin D, Calcium profile, HLA-B27, Rheumatological profile, HbA1c, Other",
    },
    {
      id: "radiologyInvestigations",
      label: "Radiological investigations advised",
      type: "textarea",
      placeholder: "X-ray region/views, MRI region/with contrast, CT/CT myelogram/EOS/Other",
    },
    {
      id: "prescriptionDiagnosis",
      label: "Prescription diagnosis",
      type: "textarea",
      placeholder: "Diagnosis text for prescription",
    },
    {
      id: "prescriptionNote",
      label: "Medicines advised",
      type: "textarea",
      placeholder: "Medicine name, dose, duration, instructions",
    },
    {
      id: "painManagementAdvised",
      label: "Pain management advised",
      type: "radio",
      options: [
        { label: "Oral medication only", value: "oral" },
        { label: "Spinal injection - epidural", value: "injection-epidural" },
        { label: "Spinal injection - nerve block", value: "injection-nerve-block" },
        { label: "Spinal injection - facet joint", value: "injection-facet" },
        { label: "Transdermal patch", value: "transdermal" },
        { label: "Topical application", value: "topical" },
        { label: "Heat / cold therapy advised", value: "heat-cold" },
        { label: "Other", value: "other" },
      ],
    },
    {
      id: "painManagementDetails",
      label: "Pain management details",
      type: "textarea",
      placeholder: "Details / site / frequency",
    },
    {
      id: "alliedReferral",
      label: "Referral to allied specialist",
      type: "radio",
      options: [
        { label: "Neurologist", value: "neurologist" },
        { label: "Rheumatologist", value: "rheumatologist" },
        { label: "Knee specialist", value: "knee-specialist" },
        { label: "Shoulder specialist", value: "shoulder-specialist" },
        { label: "Physiotherapist", value: "physiotherapist" },
        { label: "Other speciality", value: "other" },
      ],
    },
    {
      id: "alliedReferralOther",
      label: "Allied referral speciality / name",
      type: "text",
      placeholder: "Speciality / name",
      condition: (answers) => answers.alliedReferral === "other",
    },
    {
      id: "physicalExamReferral",
      label: "Refer for physical examination decision-making",
      type: "toggle",
    },
    {
      id: "physicalExamReferralCity",
      label: "Physical exam referral city",
      type: "text",
      placeholder: "City / preferred location",
      condition: (answers) => Boolean(answers.physicalExamReferral),
    },
    {
      id: "surgeryEarliestAdvised",
      label: "Surgery advised at earliest",
      type: "toggle",
    },
    {
      id: "surgeryReferralCity",
      label: "Surgery referral city",
      type: "text",
      placeholder: "City / preferred location",
      condition: (answers) => Boolean(answers.surgeryEarliestAdvised),
    },
    {
      id: "followUpReview",
      label: "Follow-up review timing",
      type: "radio",
      options: [
        { label: "No follow-up required", value: "none" },
        { label: "2 weeks", value: "2-weeks" },
        { label: "6 weeks", value: "6-weeks" },
        { label: "3 months", value: "3-months" },
        { label: "6 months", value: "6-months" },
      ],
    },
    {
      id: "followUpMode",
      label: "Follow-up mode",
      type: "radio",
      options: [
        { label: "Teleconsult", value: "teleconsult" },
        { label: "Physical consultation", value: "physical-consultation" },
        { label: "Regional Spine Expert Centre", value: "regional-centre" },
      ],
    },
    {
      id: "vasPainScore",
      label: "VAS pain score (0-10)",
      type: "range",
      min: 0,
      max: 10,
      step: 1,
    },
    {
      id: "odiPercent",
      label: "ODI disability index (%)",
      type: "number",
      min: 0,
      max: 100,
    },
    {
      id: "ndiPercent",
      label: "NDI disability index (%)",
      type: "number",
      min: 0,
      max: 100,
    },
    {
      id: "mjoaScore",
      label: "mJOA score (0-18)",
      type: "number",
      min: 0,
      max: 18,
    },
    {
      id: "qualityOfLifeScore",
      label: "Quality of life self-rated (0-10)",
      type: "range",
      min: 0,
      max: 10,
      step: 1,
    },
    {
      id: "workLimitation",
      label: "Work limitation",
      type: "radio",
      options: [
        { label: "None", value: "none" },
        { label: "Partial", value: "partial" },
        { label: "Unable to work", value: "unable" },
      ],
    },
    {
      id: "mriRequiredStage",
      label: "Was MRI required at this stage?",
      type: "radio",
      required: true,
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
    },
    {
      id: "surgeryIndicatedStage",
      label: "Was surgery indicated at this stage?",
      type: "radio",
      required: true,
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ],
    },
    {
      id: "referralPathway",
      label: "Referral / next steps summary",
      type: "textarea",
      placeholder: "Where should the patient go next?",
    },
];

type DoctorQuestionSection = {
  id: string;
  title: string;
  questionIds: string[];
  commentField: {
    id: string;
    label: string;
    placeholder: string;
  };
};

const doctorQuestionSections: DoctorQuestionSection[] = [
  {
    id: "section-1-pre-consult",
    title: "Patient and consultation details",
    questionIds: [
      "consultationType",
      "primaryProblem",
      "symptomDurationBand",
    ],
    commentField: {
      id: "section1Comments",
      label: "Patient and consultation details comments",
      placeholder: "Doctor comments for patient and consultation details",
    },
  },
  {
    id: "section-2-clinical-red-flags",
    title: "Preconsult intelligence validation",
    questionIds: [
      "patientRiskCategory",
      "aiSuggestedPathway",
      "summaryValidation",
    ],
    commentField: {
      id: "section2Comments",
      label: "Preconsult intelligence validation comments",
      placeholder: "Doctor comments for preconsult intelligence validation",
    },
  },
  {
    id: "section-3-primary-clinical-problem",
    title: "Primary clinical problem",
    questionIds: [
      "motorWeakness",
      "sensoryDeficit",
      "bladderBowelInvolvement",
      "gaitImbalance",
      "overallRiskCategory",
    ],
    commentField: {
      id: "section3Comments",
      label: "Primary clinical problem comments",
      placeholder: "Doctor comments for primary clinical problem",
    },
  },
  {
    id: "section-4-clinical-risk-assessment",
    title: "Clinical risk assessment",
    questionIds: [
      "physicalExamRequired",
      "physicalExamReason",
      "furtherInvestigationRequired",
      "furtherInvestigationReason",
    ],
    commentField: {
      id: "section4Comments",
      label: "Clinical risk assessment comments",
      placeholder: "Doctor comments for clinical risk assessment",
    },
  },
  {
    id: "section-5-clinical-assessment",
    title: "Clinical assessment",
    questionIds: [
      "clinicalDiagnosis",
      "clinicalRemarks",
    ],
    commentField: {
      id: "section5Comments",
      label: "Clinical assessment comments",
      placeholder: "Doctor comments for clinical assessment",
    },
  },
  {
    id: "section-6-clinicoradiological-correlation",
    title: "Clinicoradiological correlation",
    questionIds: [
      "imagingAvailable",
      "imagingInterpretation",
    ],
    commentField: {
      id: "section6Comments",
      label: "Clinicoradiological correlation comments",
      placeholder: "Doctor comments for clinicoradiological correlation",
    },
  },
  {
    id: "section-7-care-pathway-decision",
    title: "Final care pathway decision",
    questionIds: [
      "carePathway",
      "carePathwayReason",
    ],
    commentField: {
      id: "section7Comments",
      label: "Final care pathway decision comments",
      placeholder: "Doctor comments for final care pathway decision",
    },
  },
  {
    id: "section-8-investigations-advised",
    title: "Investigations advised",
    questionIds: [
      "labInvestigations",
      "radiologyInvestigations",
      "mriRequiredStage",
      "surgeryIndicatedStage",
    ],
    commentField: {
      id: "section8Comments",
      label: "Investigations advised comments",
      placeholder: "Doctor comments for investigations advised",
    },
  },
  {
    id: "section-9-prescription-input",
    title: "Prescription input",
    questionIds: [
      "prescriptionDiagnosis",
      "prescriptionNote",
      "painManagementAdvised",
      "painManagementDetails",
    ],
    commentField: {
      id: "section9Comments",
      label: "Prescription input comments",
      placeholder: "Doctor comments for prescription input",
    },
  },
  {
    id: "section-10-referral-pathway",
    title: "Referral pathway",
    questionIds: [
      "alliedReferral",
      "alliedReferralOther",
      "physicalExamReferral",
      "physicalExamReferralCity",
      "surgeryEarliestAdvised",
      "surgeryReferralCity",
      "referralPathway",
    ],
    commentField: {
      id: "section10Comments",
      label: "Referral pathway comments",
      placeholder: "Doctor comments for referral pathway",
    },
  },
  {
    id: "section-11-follow-up-plan",
    title: "Follow-up plan",
    questionIds: [
      "followUpReview",
      "followUpMode",
    ],
    commentField: {
      id: "section11Comments",
      label: "Follow-up plan comments",
      placeholder: "Doctor comments for follow-up plan",
    },
  },
  {
    id: "section-12-outcome-registry-baseline",
    title: "Outcome registry baseline",
    questionIds: [
      "vasPainScore",
      "odiPercent",
      "ndiPercent",
      "mjoaScore",
      "qualityOfLifeScore",
      "workLimitation",
    ],
    commentField: {
      id: "section12Comments",
      label: "Outcome registry baseline comments",
      placeholder: "Doctor comments for outcome registry baseline",
    },
  },
];

function buildDoctorQuestionnaireQuestions() {
  const baseQuestionById = new Map(doctorQuestionnaireBaseQuestions.map((question) => [question.id, question]));
  const sectionedQuestions: QuestionnaireQuestion[] = [];

  for (const section of doctorQuestionSections) {
    for (const questionId of section.questionIds) {
      const baseQuestion = baseQuestionById.get(questionId);
      if (!baseQuestion) {
        continue;
      }

      sectionedQuestions.push({
        ...baseQuestion,
        sectionId: section.id,
        sectionTitle: section.title,
      });
    }

    sectionedQuestions.push({
      id: section.commentField.id,
      label: section.commentField.label,
      type: "textarea",
      required: false,
      placeholder: section.commentField.placeholder,
      sectionId: section.id,
      sectionTitle: section.title,
    });
  }

  return sectionedQuestions;
}

export const doctorQuestionnaireDefinition: QuestionnaireDefinition = {
  id: "doctor-consultation-flow",
  title: "Doctor consultation questionnaire",
  subtitle: "A sectioned clinical review flow for validating, reviewing, and planning care.",
  audience: ["doctor"],
  questions: buildDoctorQuestionnaireQuestions(),
};

export function isQuestionVisible(
  question: QuestionnaireQuestion,
  answers: Record<string, string | number | boolean | string[]>,
) {
  return question.condition ? question.condition(answers) : true;
}

export function getVisibleQuestions(
  answers: Record<string, string | number | boolean | string[]>,
  definition: QuestionnaireDefinition = questionnaireDefinition,
) {
  return definition.questions.filter((question) => isQuestionVisible(question, answers));
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