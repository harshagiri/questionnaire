import type { AppRole } from "@/lib/rbac";
import { toPlainQuestionText } from "@/lib/question-text";

export type SelectOption = {
  label: string;
  value: string;
};

export type BuilderQuestionType =
  | "text"
  | "tel"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "select"
  | "radio"
  | "multi-select"
  | "toggle"
  | "range"
  | "info-link";

export type WorkflowQuestion = {
  id: string;
  label: string;
  type: BuilderQuestionType;
  helpText?: string;
  required?: boolean;
  options?: SelectOption[];
  min?: number;
  max?: number;
  step?: number;
  linkedFrom?: string;
  branchOn?: string;
  branchValue?: string;
  showIf?: (answers: Record<string, unknown>) => boolean;
};

export type WorkflowSection = {
  id: string;
  title: string;
  subtitle: string;
  note?: string;
  questions: WorkflowQuestion[];
};

export type DoctorSection = {
  id: string;
  title: string;
  subtitle: string;
  fields: string[];
  condition?: string;
};

export type AppointmentField = {
  id: string;
  label: string;
  type: "text" | "tel" | "date" | "time" | "select" | "textarea";
  placeholder?: string;
  options?: SelectOption[];
};

export const patientWorkflowSections: WorkflowSection[] = [
  {
    id: "red-flags",
    title: "Urgent red flag pre-screen",
    subtitle: "Answer this first. If any item is positive, the clinic is alerted immediately.",
    note: "This section is always first in the patient journey.",
    questions: [
      {
        id: "redFlagBladderBowel",
        label: "Loss of bladder or bowel control (unable to hold urine or stools)",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagRapidWeakness",
        label: "Rapidly increasing weakness in arm or leg (worsening over hours to days)",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagFever",
        label: "Fever with spine pain",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagTrauma",
        label: "New or severe spine pain after a fall, accident, or major trauma",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagCancer",
        label: "Known cancer with new or worsening spine pain",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagWeightLoss",
        label: "Significant unexplained weight loss in the past 3 months",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagNone",
        label: "None of the above",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagReason",
        label: "If yes, what should the clinic know right now? (optional)",
        type: "textarea",
        showIf: (answers) =>
          Boolean(
            answers.redFlagBladderBowel ||
              answers.redFlagRapidWeakness ||
              answers.redFlagFever ||
              answers.redFlagTrauma ||
              answers.redFlagCancer ||
              answers.redFlagWeightLoss,
          ),
      },
    ],
  },
  {
    id: "medical-history",
    title: "Medical history",
    subtitle: "Health background that may affect spine care decisions.",
    questions: [
      {
        id: "medicalConditions",
        label: "Do you have any of the following medical conditions?",
        type: "multi-select",
        options: [
          { label: "Diabetes", value: "diabetes" },
          { label: "Hypertension", value: "hypertension" },
          { label: "Thyroid disorder", value: "thyroid" },
          { label: "Heart condition", value: "heart" },
          { label: "None of the above", value: "none" },
        ],
      },
      {
        id: "currentMedicines",
        label: "Current medicines used for this condition",
        type: "multi-select",
        options: [
          { label: "Painkillers / anti-inflammatory", value: "painkiller" },
          { label: "Nerve pain medicines", value: "nerve-meds" },
          { label: "Muscle relaxants", value: "relaxant" },
          { label: "No regular medicines", value: "none" },
        ],
      },
      { id: "priorSurgery", label: "Have you had any surgery previously?", type: "toggle" },
      {
        id: "surgeryDetails",
        label: "If yes, surgery details",
        type: "textarea",
        showIf: (answers) => Boolean(answers.priorSurgery),
      },
      { id: "medicalHistory", label: "Relevant medical history", type: "textarea" },
    ],
  },
  {
    id: "previous-reports",
    title: "Previous medical reports available",
    subtitle: "Reports and measurements available for the doctor review.",
    questions: [
      {
        id: "reportsWithPatient",
        label: "Which reports or documents do you have with you today?",
        type: "multi-select",
        options: [
          { label: "MRI images", value: "mri-images" },
          { label: "MRI report", value: "mri-report" },
          { label: "X-ray", value: "xray" },
          { label: "Blood test reports", value: "labs" },
          { label: "No reports", value: "none" },
        ],
      },
      { id: "mriAvailability", label: "MRI availability", type: "select", options: [
        { label: "MRI report only", value: "report-only" },
        { label: "MRI images and report", value: "images-and-report" },
        { label: "No MRI yet", value: "none" },
      ] },
    ],
  },
  {
    id: "diagnosis-understanding",
    title: "Understanding of your diagnosis",
    subtitle: "Captures what the patient was previously told and understood.",
    questions: [
      {
        id: "diagnosisExplained",
        label: "Has any doctor previously explained your diagnosis to you?",
        type: "select",
        options: [
          { label: "No diagnosis explained", value: "none" },
          { label: "Slip disc / disc issue explained", value: "disc" },
          { label: "Nerve compression explained", value: "nerve" },
          { label: "Spine alignment / degeneration explained", value: "alignment" },
          { label: "Given but not fully understood", value: "unclear" },
        ],
      },
      {
        id: "diagnosisConfidence",
        label: "How well do you understand your current diagnosis?",
        type: "select",
        options: [
          { label: "Very clear", value: "clear" },
          { label: "Partly clear", value: "partial" },
          { label: "Not clear", value: "unclear" },
        ],
      },
    ],
  },
  {
    id: "current-problem",
    title: "Your current problem",
    subtitle: "The main concern and consultation reason today.",
    questions: [
      { id: "mainConcern", label: "Main concern today", type: "textarea", required: true },
      {
        id: "consultReason",
        label: "What is your main reason for this consultation?",
        type: "select",
        options: [
          { label: "Neck pain", value: "neck" },
          { label: "Upper or mid-back pain", value: "upper-back" },
          { label: "Lower back pain", value: "lower-back" },
          { label: "Pain into arm / hand", value: "arm" },
          { label: "Pain into leg / foot (sciatica)", value: "leg" },
        ],
      },
      {
        id: "symptomDuration",
        label: "Duration of symptoms (days)",
        type: "number",
        branchOn: "mainConcern",
        branchValue: "pain",
      },
      {
        id: "problemStart",
        label: "How did this problem start?",
        type: "select",
        options: [
          { label: "Sudden onset", value: "sudden" },
          { label: "Gradual onset", value: "gradual" },
          { label: "After injury / event", value: "injury" },
          { label: "Not sure", value: "unknown" },
        ],
      },
    ],
  },
  {
    id: "pain-behaviour",
    title: "Pain behaviour and triggers",
    subtitle: "Where pain is felt, what changes it, and how it behaves.",
    questions: [
      { id: "painLocation", label: "Pain location", type: "radio", options: [
        { label: "Neck", value: "neck" },
        { label: "Upper / mid back", value: "upper-back" },
        { label: "Lower back", value: "lower-back" },
        { label: "Arm / hand", value: "arm" },
        { label: "Leg / foot", value: "leg" },
      ] },
      {
        id: "painSide",
        label: "Which side is most affected?",
        type: "select",
        options: [
          { label: "Left", value: "left" },
          { label: "Right", value: "right" },
          { label: "Both", value: "both" },
          { label: "Central / no side", value: "central" },
        ],
      },
      {
        id: "radiatingPain",
        label: "Pain spreading into arm or leg?",
        type: "toggle",
        branchOn: "painLocation",
        branchValue: "arm",
      },
      {
        id: "painTriggers",
        label: "What activities increase your pain the most?",
        type: "multi-select",
        options: [
          { label: "Sitting", value: "sitting" },
          { label: "Standing", value: "standing" },
          { label: "Walking", value: "walking" },
          { label: "Bending / lifting", value: "bending" },
          { label: "No clear trigger", value: "none" },
        ],
      },
      {
        id: "painRelief",
        label: "What gives you the most relief from pain?",
        type: "multi-select",
        options: [
          { label: "Rest / lying down", value: "rest" },
          { label: "Movement / walking", value: "movement" },
          { label: "Medicines", value: "medicines" },
          { label: "Heat / massage", value: "heat" },
          { label: "Nothing gives clear relief", value: "none" },
        ],
      },
    ],
  },
  {
    id: "symptom-severity",
    title: "Symptom severity",
    subtitle: "Pain intensity, pattern, and trend.",
    questions: [
      { id: "painScore", label: "Pain score", type: "range", required: true },
      {
        id: "painPattern",
        label: "Which best describes your pain pattern?",
        type: "select",
        options: [
          { label: "Occasional with pain-free periods", value: "occasional" },
          { label: "Frequent but manageable", value: "frequent" },
          { label: "Daily persistent", value: "persistent" },
          { label: "Constant or night-waking pain", value: "constant" },
        ],
      },
      {
        id: "conditionTrend",
        label: "How is your condition changing overall?",
        type: "select",
        options: [
          { label: "Improving", value: "improving" },
          { label: "No major change", value: "same" },
          { label: "Worsening", value: "worsening" },
          { label: "Fluctuating", value: "fluctuating" },
        ],
      },
      { id: "spineHealthBaseline", label: "Before today, how would you rate your overall spine health (0-10)?", type: "range" },
    ],
  },
  {
    id: "neurological-symptoms",
    title: "Neurological symptoms",
    subtitle: "Numbness, weakness, balance, and nerve symptom timing.",
    questions: [
      {
        id: "nerveSymptomsStart",
        label: "When did numbness or weakness (nerve symptoms) begin?",
        type: "select",
        options: [
          { label: "No nerve symptoms", value: "none" },
          { label: "At the same time as pain", value: "same-time" },
          { label: "Weeks or months later", value: "later" },
        ],
      },
      { id: "numbnessTingling", label: "Numbness or tingling in arm, hand, leg, or foot?", type: "toggle" },
      {
        id: "limbWeakness",
        label: "Weakness in arm, hand, leg, or foot?",
        type: "select",
        options: [
          { label: "No weakness", value: "none" },
          { label: "Slight weakness", value: "slight" },
          { label: "Moderate weakness", value: "moderate" },
          { label: "Severe weakness", value: "severe" },
        ],
      },
      { id: "walkingBalance", label: "Walking or balance problems?", type: "toggle" },
    ],
  },
  {
    id: "functional-disability",
    title: "Functional disability",
    subtitle: "Daily function, walking, sitting, standing, and sleep impact.",
    questions: [
      { id: "walkingImpact", label: "How far can you walk without stopping due to pain?", type: "select", options: [
        { label: "More than 30 minutes", value: "30-plus" },
        { label: "15-30 minutes", value: "15-30" },
        { label: "Less than 15 minutes", value: "less-15" },
      ] },
      {
        id: "sittingTolerance",
        label: "How long can you sit comfortably?",
        type: "select",
        options: [
          { label: "More than 60 minutes", value: "60-plus" },
          { label: "30-60 minutes", value: "30-60" },
          { label: "Less than 30 minutes", value: "less-30" },
        ],
      },
      {
        id: "standingTolerance",
        label: "How long can you stand comfortably?",
        type: "select",
        options: [
          { label: "More than 60 minutes", value: "60-plus" },
          { label: "30-60 minutes", value: "30-60" },
          { label: "Less than 30 minutes", value: "less-30" },
        ],
      },
      { id: "sleepImpact", label: "Does pain disturb sleep?", type: "select", options: [
        { label: "No", value: "no" },
        { label: "Sometimes", value: "sometimes" },
        { label: "Frequently", value: "frequently" },
      ] },
    ],
  },
  {
    id: "previous-treatment",
    title: "Previous treatment journey",
    subtitle: "Care tried so far and how much it helped.",
    questions: [
      { id: "previousDoctors", label: "How many doctors or specialists have you seen?", type: "select", options: [
        { label: "None", value: "0" },
        { label: "1 to 2", value: "1-2" },
        { label: "3 to 5", value: "3-5" },
        { label: "More than 5", value: "5-plus" },
      ] },
      {
        id: "treatmentBenefit",
        label: "How well have treatments helped you so far?",
        type: "select",
        options: [
          { label: "Excellent relief", value: "excellent" },
          { label: "Partial relief", value: "partial" },
          { label: "Minimal relief", value: "minimal" },
          { label: "No relief", value: "none" },
        ],
      },
    ],
  },
  {
    id: "concerns-goals",
    title: "Your concerns and goals",
    subtitle: "Patient worries, expectations, and final consent.",
    questions: [
      {
        id: "biggestWorry",
        label: "What worries you most about your spine problem?",
        type: "select",
        options: [
          { label: "Pain not improving", value: "pain" },
          { label: "Nerve damage or weakness", value: "nerve" },
          { label: "Future disability", value: "disability" },
          { label: "Need for surgery", value: "surgery" },
        ],
      },
      { id: "fearAvoidance", label: "Has fear of pain stopped you from moving or doing activities?", type: "toggle" },
      {
        id: "careGoal",
        label: "What is your main expectation from treatment?",
        type: "select",
        options: [
          { label: "Meaningful and lasting pain relief", value: "pain-relief" },
          { label: "Return to normal daily activities", value: "function" },
          { label: "Avoid worsening and future disability", value: "prevent-worse" },
          { label: "Clear diagnosis and plan", value: "clarity" },
        ],
      },
      { id: "reviewConsent", label: "I agree to the confidentiality statement and review my answers before submission", type: "toggle", required: true },
    ],
  },
];

export const doctorWorkflowSections: DoctorSection[] = [
  {
    id: "details",
    title: "Patient & Consultation Details",
    subtitle: "Patient ID, doctor, appointment time, consultation type, and prefilled summary.",
    fields: ["Patient ID", "Doctor", "Appointment time", "Consultation type", "AI-generated patient summary"],
  },
  {
    id: "validation",
    title: "Pre-Consult Intelligence Validation",
    subtitle: "Doctor validates whether the AI summary is clinically accurate, partially accurate, or needs correction.",
    fields: ["Clinically accurate", "Partially accurate", "Needs correction", "Optional comments"],
  },
  {
    id: "primary-problem",
    title: "Primary Clinical Problem",
    subtitle: "One question per screen with concise clinical options.",
    fields: ["Neck pain", "Back pain", "Radiculopathy", "Myelopathy", "Deformity", "Other"],
  },
  {
    id: "risk",
    title: "Clinical Risk Assessment",
    subtitle: "Motor weakness, sensory loss, bladder/bowel, walking imbalance, and risk category.",
    fields: ["Motor weakness", "Sensory loss", "Bladder / bowel", "Walking imbalance", "Risk category"],
  },
  {
    id: "diagnosis",
    title: "Clinical Diagnosis",
    subtitle: "MCQ plus a short free-text diagnosis field.",
    fields: ["Diagnosis MCQ", "Short diagnosis field"],
  },
  {
    id: "correlation",
    title: "Clinicoradiological Correlation",
    subtitle: "Imaging available, MRI correlation, and conditional follow-up questions.",
    fields: ["Imaging available", "MRI correlation", "Need further investigation", "Need physical examination"],
    condition: "Hide MRI interpretation if MRI available = No",
  },
  {
    id: "care-pathway",
    title: "Final Care Pathway Decision",
    subtitle: "Mandatory selection with one primary pathway driving the patient plan.",
    fields: ["Education only", "Pain management", "Physical examination", "Referral", "Review"],
  },
  {
    id: "investigations",
    title: "Investigations Advised",
    subtitle: "MRI spine, X-ray, blood tests, or no investigations.",
    fields: ["MRI spine", "X-ray", "Lab tests", "No investigations"],
  },
  {
    id: "prescription",
    title: "Prescription Input",
    subtitle: "Only free-text section in the workflow.",
    fields: ["Handwritten / free text note", "Pain management advice"],
  },
  {
    id: "referral",
    title: "Referral Pathway",
    subtitle: "Where the patient should go next if outside this specialist scope.",
    fields: ["Nearest specialist", "Network doctor", "Review for physical examination"],
  },
  {
    id: "follow-up",
    title: "Follow-up Plan",
    subtitle: "Review timing and consultation mode.",
    fields: ["Review in 1 week", "Review in 2 weeks", "Teleconsult", "In-person"],
  },
  {
    id: "outcome",
    title: "Outcome Registry Baseline",
    subtitle: "Baseline tracking for outcomes and future follow-up.",
    fields: ["VAS pain score", "MRI required", "Care pathway", "Outcome status"],
  },
];

export const receptionistAppointmentFields: AppointmentField[] = [
  { id: "patientName", label: "Patient name", type: "text", placeholder: "Full name" },
  { id: "patientPhone", label: "Patient phone", type: "tel", placeholder: "Mobile number" },
  { id: "doctorName", label: "Assigned doctor", type: "select", options: [] },
  { id: "appointmentDate", label: "Appointment date", type: "date" },
  { id: "appointmentTime", label: "Appointment time", type: "time" },
  { id: "appointmentType", label: "Appointment type", type: "select", options: [
    { label: "New consult", value: "new" },
    { label: "Follow-up", value: "follow-up" },
    { label: "Teleconsult", value: "teleconsult" },
    { label: "Walk-in", value: "walk-in" },
  ] },
  { id: "status", label: "Status", type: "select", options: [
    { label: "Booked", value: "booked" },
    { label: "Waiting", value: "waiting" },
    { label: "Submitted", value: "submitted" },
  ] },
  { id: "notes", label: "Reception notes", type: "textarea", placeholder: "Any special instructions" },
];

export const roleLandingCopy: Record<AppRole, string> = {
  patient: "Patient screening with calm, mobile-first intake.",
  doctor: "Doctor consult review with sectioned validation and MRI-aware decisioning.",
  receptionist: "Front-desk appointment booking only.",
  admin: "Operational metrics and backend-driven RBAC controls.",
};

// ── Registration sections — Module 1 (one-time, generates Unique Patient ID) ─

export const registrationSections: WorkflowSection[] = [
  {
    id: "reg-basics",
    title: "Basic details",
    subtitle: "These details create your permanent patient record and are never asked again.",
    questions: [
      { id: "fullName", label: "Full name", type: "text", required: true },
      { id: "dateOfBirth", label: "Date of birth", type: "date", required: true },
      {
        id: "gender",
        label: "Gender",
        type: "select",
        required: true,
        options: [
          { label: "Female", value: "female" },
          { label: "Male", value: "male" },
          { label: "Non-binary / other", value: "non-binary" },
          { label: "Prefer not to say", value: "prefer-not-to-say" },
        ],
      },
      { id: "phone", label: "Mobile number (used for login & notifications)", type: "tel", required: true },
      { id: "email", label: "Email address", type: "text" },
      { id: "city", label: "City", type: "text", required: true },
      { id: "country", label: "Country", type: "text" },
      {
        id: "preferredLanguage",
        label: "Preferred language for consultation",
        type: "select",
        required: true,
        options: [
          { label: "English", value: "english" },
          { label: "Hindi", value: "hindi" },
          { label: "Kannada", value: "kannada" },
          { label: "Tamil", value: "tamil" },
          { label: "Telugu", value: "telugu" },
          { label: "Malayalam", value: "malayalam" },
          { label: "Marathi", value: "marathi" },
          { label: "Bengali", value: "bengali" },
          { label: "Other", value: "other" },
        ],
      },
    ],
  },
  {
    id: "reg-emergency",
    title: "Emergency contact",
    subtitle: "Who should we contact in an emergency?",
    questions: [
      { id: "emergencyName", label: "Emergency contact name", type: "text", required: true },
      { id: "emergencyPhone", label: "Emergency contact mobile number", type: "tel", required: true },
      {
        id: "emergencyRelation",
        label: "Relationship to you",
        type: "select",
        required: true,
        options: [
          { label: "Spouse / Partner", value: "spouse" },
          { label: "Parent", value: "parent" },
          { label: "Child", value: "child" },
          { label: "Sibling", value: "sibling" },
          { label: "Friend", value: "friend" },
          { label: "Other", value: "other" },
        ],
      },
    ],
  },
  {
    id: "reg-body",
    title: "Body profile & lifestyle",
    subtitle: "Used to calculate BMI and understand your daily routine.",
    questions: [
      { id: "heightCm", label: "Height (cm)", type: "number", required: true },
      { id: "weightKg", label: "Weight (kg)", type: "number", required: true },
      { id: "bmi", label: "BMI (auto-calculated)", type: "info-link", linkedFrom: "heightCm" },
      {
        id: "occupation",
        label: "Usual work or daily activity",
        type: "select",
        required: true,
        options: [
          { label: "Desk / computer work", value: "desk" },
          { label: "Standing or walking work", value: "standing" },
          { label: "Manual / heavy labour", value: "manual" },
          { label: "Homemaker", value: "home" },
          { label: "Student", value: "student" },
          { label: "Retired", value: "retired" },
        ],
      },
      {
        id: "activityLevel",
        label: "Physical activity level",
        type: "select",
        required: true,
        options: [
          { label: "Sedentary (little or no exercise)", value: "sedentary" },
          { label: "Moderate (light exercise 1–3 days/week)", value: "moderate" },
          { label: "Heavy (vigorous exercise 4+ days/week)", value: "heavy" },
        ],
      },
      {
        id: "smoking",
        label: "Smoking",
        type: "select",
        options: [
          { label: "Current smoker", value: "current" },
          { label: "Past smoker (quit)", value: "past" },
          { label: "Never smoked", value: "never" },
        ],
      },
      {
        id: "alcohol",
        label: "Alcohol use",
        type: "select",
        options: [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" },
        ],
      },
    ],
  },
  {
    id: "reg-medical",
    title: "Medical history",
    subtitle: "Helps every doctor understand your background from the first visit.",
    questions: [
      {
        id: "medicalHistory",
        label: "Do you have any of the following conditions? (select all that apply)",
        type: "multi-select",
        options: [
          { label: "Diabetes", value: "diabetes" },
          { label: "Hypertension", value: "hypertension" },
          { label: "Heart disease", value: "heart" },
          { label: "Kidney disease", value: "kidney" },
          { label: "Thyroid disease", value: "thyroid" },
          { label: "Rheumatoid / autoimmune disease", value: "rheumatoid" },
          { label: "Osteoporosis", value: "osteoporosis" },
          { label: "Cancer", value: "cancer" },
          { label: "Parkinsonism", value: "parkinsonism" },
          { label: "Tuberculosis", value: "tuberculosis" },
          { label: "Other", value: "other" },
          { label: "None of the above", value: "none" },
        ],
      },
      {
        id: "currentMedicines",
        label: "Current medicines (list names or tap 'None')",
        type: "textarea",
        helpText: "You can update this before each visit",
      },
      {
        id: "drugAllergies",
        label: "Drug allergies (list names or tap 'None')",
        type: "textarea",
      },
      { id: "priorSpineSurgery", label: "Previous spine surgery?", type: "toggle" },
      {
        id: "spineSurgeryDetails",
        label: "Spine surgery details (year, hospital, level, procedure)",
        type: "textarea",
        showIf: (a) => Boolean(a.priorSpineSurgery),
      },
      {
        id: "otherSurgeries",
        label: "Other previous surgeries (select all that apply)",
        type: "multi-select",
        options: [
          { label: "Joint replacement", value: "joint" },
          { label: "Cardiac surgery", value: "cardiac" },
          { label: "Brain surgery", value: "brain" },
          { label: "Abdominal surgery", value: "abdominal" },
          { label: "Other", value: "other" },
          { label: "None", value: "none" },
        ],
      },
    ],
  },
  {
    id: "reg-consent",
    title: "Consents",
    subtitle: "Please read and confirm each statement below.",
    questions: [
      {
        id: "consentClinicalCare",
        label: "Clinical Care Consent (required): I consent to Spine Expert India collecting and using my information for clinical consultation and treatment.",
        type: "toggle",
        required: true,
      },
      {
        id: "consentPrivacy",
        label: "Privacy & Data Protection (required): I understand my information will remain confidential and stored securely as per applicable healthcare regulations.",
        type: "toggle",
        required: true,
      },
      {
        id: "consentRegistry",
        label: "Research Registry (optional): I voluntarily agree that my anonymised data may be included in the SEI National Outcomes Registry for research and quality improvement.",
        type: "toggle",
      },
    ],
  },
];

// ── Pre-consult sections — Module 2 (per appointment, clinical questions) ─────
// Spec: SEI-Intake v4.0 — 18 universal core questions + 6 adaptive tail (ODI or NDI)
//       + outcome-tracking anchor + conditional myelopathy screen

// Routing helpers
const isNeckPrimary = (a: Record<string, unknown>) => {
  const v = a.q1PrimaryReason as string | undefined;
  return v === "neck-pain" || v === "arm-pain" || v === "numbness" || v === "weakness" || v === "walking-difficulty";
};
const isBackPrimary = (a: Record<string, unknown>) => {
  const v = a.q1PrimaryReason as string | undefined;
  return v === "back-pain" || v === "leg-pain" || !v || (!isNeckPrimary(a));
};
const hasFrequentNeuro = (a: Record<string, unknown>) => {
  const numbness = a.q10Numbness as string | undefined;
  const weakness = a.q11Weakness as string | undefined;
  return (numbness === "frequent" || numbness === "constant") ||
         (weakness === "moderate" || weakness === "progressive");
};

function sanitizeWorkflowSections(sections: WorkflowSection[]): WorkflowSection[] {
  return sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => ({
      ...question,
      label: toPlainQuestionText(question.label),
      options: question.options?.map((option) => ({
        ...option,
        label: toPlainQuestionText(option.label),
      })),
    })),
  }));
}

export const preConsultSections: WorkflowSection[] = sanitizeWorkflowSections([
  // ── Section A: Urgent Red-Flag Pre-Screen ────────────────────────────────────
  {
    id: "red-flags",
    title: "Urgent red flag check",
    subtitle: "Answer each item. Any positive answer alerts the clinical team immediately.",
    note: "Section A — answered first, one screen.",
    questions: [
      { id: "redFlagBladderBowel", label: "A. Loss of bladder or bowel control", type: "toggle", required: true },
      { id: "redFlagRapidWeakness", label: "B. Rapidly increasing weakness in arm or leg (hours to days)", type: "toggle", required: true },
      { id: "redFlagFever", label: "C. Fever with spine pain", type: "toggle", required: true },
      { id: "redFlagTrauma", label: "D. New or severe spine pain after a fall, accident, or major trauma", type: "toggle", required: true },
      { id: "redFlagCancer", label: "E. Known cancer with new or worsening spine pain", type: "toggle", required: true },
      { id: "redFlagWeightLoss", label: "F. Significant unexplained weight loss in the past 3 months", type: "toggle", required: true },
      { id: "redFlagNone", label: "G. None of the above", type: "toggle", required: true },
      {
        id: "redFlagReason",
        label: "If yes to any of the above — what should the clinic know right now?",
        type: "textarea",
        showIf: (a) => Boolean(
          a.redFlagBladderBowel || a.redFlagRapidWeakness || a.redFlagFever ||
          a.redFlagTrauma || a.redFlagCancer || a.redFlagWeightLoss,
        ),
      },
    ],
  },

  // ── Section B: Universal Core Questions Q1–Q9 (routing + neuro screen) ───────
  {
    id: "primary-complaint",
    title: "Your main complaint",
    subtitle: "Section B — Q1 & Q2 — helps route your questionnaire correctly.",
    questions: [
      {
        id: "q1PrimaryReason",
        label: "Q1. Primary reason for this consultation",
        type: "select",
        required: true,
        options: [
          { label: "Neck pain", value: "neck-pain" },
          { label: "Back pain", value: "back-pain" },
          { label: "Arm pain", value: "arm-pain" },
          { label: "Leg pain / sciatica", value: "leg-pain" },
          { label: "Numbness", value: "numbness" },
          { label: "Weakness", value: "weakness" },
          { label: "Walking difficulty", value: "walking-difficulty" },
          { label: "Follow-up visit", value: "follow-up" },
          { label: "Second opinion", value: "second-opinion" },
        ],
      },
      {
        id: "q2PainRegion",
        label: "Q2. Where is your pain? (select all areas that apply)",
        type: "multi-select",
        required: true,
        options: [
          { label: "Neck", value: "neck" },
          { label: "Upper back / mid back", value: "upper-back" },
          { label: "Lower back", value: "lower-back" },
          { label: "Right arm / hand", value: "right-arm" },
          { label: "Left arm / hand", value: "left-arm" },
          { label: "Right leg / foot", value: "right-leg" },
          { label: "Left leg / foot", value: "left-leg" },
          { label: "Central / midline", value: "central" },
        ],
      },
      {
        id: "q3Side",
        label: "Q3. Which side is most affected?",
        type: "select",
        required: true,
        options: [
          { label: "Right", value: "right" },
          { label: "Left", value: "left" },
          { label: "Both sides equally", value: "both" },
          { label: "Midline / central", value: "midline" },
        ],
      },
    ],
  },

  {
    id: "symptom-details",
    title: "Symptom details",
    subtitle: "Q4–Q8 — duration, onset, pain level, pattern, and trend.",
    questions: [
      {
        id: "q4Duration",
        label: "Q4. How long have you had this problem?",
        type: "select",
        required: true,
        options: [
          { label: "Less than 2 weeks", value: "lt-2wk" },
          { label: "2 weeks – 3 months", value: "2wk-3m" },
          { label: "3 – 6 months", value: "3m-6m" },
          { label: "More than 6 months", value: "gt-6m" },
        ],
      },
      {
        id: "q5Onset",
        label: "Q5. How did this problem start?",
        type: "select",
        required: true,
        options: [
          { label: "Gradual / no specific cause", value: "gradual" },
          { label: "After lifting or straining", value: "lifting" },
          { label: "After an accident or fall", value: "accident" },
          { label: "Bad posture / sitting long hours", value: "posture" },
          { label: "After exercise or sports", value: "exercise" },
          { label: "After a previous surgery", value: "post-surgery" },
        ],
      },
      {
        id: "q6VasPain",
        label: "Q6. Pain level right now (0 = no pain, 10 = worst possible pain)",
        type: "range",
        required: true,
        helpText: "VAS Pain Score — used for scoring",
      },
      {
        id: "q7PainPattern",
        label: "Q7. Which best describes your pain pattern?",
        type: "select",
        required: true,
        options: [
          { label: "Intermittent — comes and goes with pain-free periods", value: "intermittent" },
          { label: "Activity-related — worse with movement, better with rest", value: "activity" },
          { label: "Constant — present most of the time", value: "constant" },
          { label: "Night pain — wakes me from sleep", value: "night" },
        ],
      },
      {
        id: "q8Trend",
        label: "Q8. How is your condition changing overall?",
        type: "select",
        required: true,
        options: [
          { label: "Improving", value: "improving" },
          { label: "Stable / no major change", value: "stable" },
          { label: "Slowly getting worse", value: "slowly-worse" },
          { label: "Rapidly getting worse", value: "rapidly-worse" },
        ],
      },
    ],
  },

  {
    id: "neuro-screen",
    title: "Neurological symptoms",
    subtitle: "Q9–Q11 — nerve-related symptoms that help guide your care pathway.",
    questions: [
      {
        id: "q9RadiatingPain",
        label: "Q9. Do you have radiating pain into your arm or leg?",
        type: "select",
        required: true,
        options: [
          { label: "No radiating pain", value: "no" },
          { label: "Occasional", value: "occasional" },
          { label: "Frequent", value: "frequent" },
          { label: "Constant", value: "constant" },
        ],
      },
      {
        id: "q10Numbness",
        label: "Q10. Numbness or tingling in arm, hand, leg, or foot?",
        type: "select",
        required: true,
        options: [
          { label: "None", value: "none" },
          { label: "Occasional", value: "occasional" },
          { label: "Frequent", value: "frequent" },
          { label: "Constant", value: "constant" },
        ],
      },
      {
        id: "q11Weakness",
        label: "Q11. Weakness in arm, hand, leg, or foot?",
        type: "select",
        required: true,
        options: [
          { label: "No weakness", value: "none" },
          { label: "Mild weakness", value: "mild" },
          { label: "Moderate weakness", value: "moderate" },
          { label: "Progressive / worsening weakness", value: "progressive" },
        ],
      },
    ],
  },

  {
    id: "mechanical-treatment",
    title: "Mechanical pattern & treatment",
    subtitle: "Q12–Q15 — triggers, relieving factors, and care tried so far.",
    questions: [
      {
        id: "q12PainWorsens",
        label: "Q12. Pain worsens with (select all that apply)",
        type: "multi-select",
        options: [
          { label: "Sitting", value: "sitting" },
          { label: "Standing", value: "standing" },
          { label: "Walking", value: "walking" },
          { label: "Forward bending", value: "forward-bend" },
          { label: "Backward bending / extension", value: "backward-bend" },
          { label: "Lifting", value: "lifting" },
          { label: "Coughing or sneezing", value: "coughing" },
        ],
      },
      {
        id: "q13PainImproves",
        label: "Q13. Pain improves with (select all that apply)",
        type: "multi-select",
        options: [
          { label: "Rest / lying down", value: "rest" },
          { label: "Walking", value: "walking" },
          { label: "Changing position", value: "position-change" },
          { label: "Medicines", value: "medicines" },
          { label: "Heat or cold", value: "heat-cold" },
          { label: "Nothing gives relief", value: "nothing" },
        ],
      },
      {
        id: "q14TreatmentTried",
        label: "Q14. Treatments tried so far (select all that apply)",
        type: "multi-select",
        options: [
          { label: "Medicines / painkillers", value: "medicines" },
          { label: "Physiotherapy / rehabilitation", value: "physio" },
          { label: "Injection / nerve block", value: "injection" },
          { label: "Surgery", value: "surgery" },
          { label: "Alternative therapy (yoga, Ayurveda, etc.)", value: "alternative" },
          { label: "None yet", value: "none" },
        ],
      },
      {
        id: "q15TreatmentHelped",
        label: "Q15. Has treatment helped?",
        type: "select",
        options: [
          { label: "Significant improvement", value: "significant" },
          { label: "Partial improvement", value: "partial" },
          { label: "No improvement", value: "none" },
          { label: "Worsened after treatment", value: "worsened" },
          { label: "Not yet tried any treatment", value: "not-tried" },
        ],
      },
    ],
  },

  {
    id: "prom-odi",
    title: "Oswestry Disability Index (ODI)",
    subtitle: "Back-primary cases only. Select one statement (0 to 5) in each ODI item.",
    questions: [
      {
        id: "odiPainIntensity",
        label: "ODI 1. Pain intensity",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. I have no pain at the moment.", value: "0" },
          { label: "1. The pain is very mild at the moment.", value: "1" },
          { label: "2. The pain is moderate at the moment.", value: "2" },
          { label: "3. The pain is fairly severe at the moment.", value: "3" },
          { label: "4. The pain is very severe at the moment.", value: "4" },
          { label: "5. The pain is the worst imaginable at the moment.", value: "5" },
        ],
      },
      {
        id: "odiPersonalCare",
        label: "ODI 2. Personal care (washing, dressing)",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. I can look after myself normally without causing extra pain.", value: "0" },
          { label: "1. I can look after myself normally but it causes extra pain.", value: "1" },
          { label: "2. It is painful to look after myself and I am slow and careful.", value: "2" },
          { label: "3. I need some help but manage most of my personal care.", value: "3" },
          { label: "4. I need help every day in most aspects of self-care.", value: "4" },
          { label: "5. I do not get dressed, wash with difficulty, and stay in bed.", value: "5" },
        ],
      },
      {
        id: "odiLifting",
        label: "ODI 3. Lifting",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. I can lift heavy weights without extra pain.", value: "0" },
          { label: "1. I can lift heavy weights but it gives extra pain.", value: "1" },
          { label: "2. Pain prevents me lifting heavy weights off the floor, but I can manage if they are conveniently placed.", value: "2" },
          { label: "3. Pain prevents me lifting heavy weights, but I can manage light to medium weights if conveniently placed.", value: "3" },
          { label: "4. I can lift only very light weights.", value: "4" },
          { label: "5. I cannot lift or carry anything at all.", value: "5" },
        ],
      },
      {
        id: "odiWalking",
        label: "ODI 4. Walking",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. Pain does not prevent me walking any distance.", value: "0" },
          { label: "1. Pain prevents me walking more than 1 mile (1.6 km).", value: "1" },
          { label: "2. Pain prevents me walking more than 0.5 mile (0.8 km).", value: "2" },
          { label: "3. Pain prevents me walking more than 0.25 mile (0.4 km).", value: "3" },
          { label: "4. I can only walk using a stick or crutches.", value: "4" },
          { label: "5. I am in bed most of the time and have to crawl to the toilet.", value: "5" },
        ],
      },
      {
        id: "odiSitting",
        label: "ODI 5. Sitting",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. I can sit in any chair as long as I like.", value: "0" },
          { label: "1. I can only sit in my favorite chair as long as I like.", value: "1" },
          { label: "2. Pain prevents me sitting more than 1 hour.", value: "2" },
          { label: "3. Pain prevents me sitting more than 30 minutes.", value: "3" },
          { label: "4. Pain prevents me sitting more than 10 minutes.", value: "4" },
          { label: "5. Pain prevents me from sitting at all.", value: "5" },
        ],
      },
      {
        id: "odiStanding",
        label: "ODI 6. Standing",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. I can stand as long as I want without extra pain.", value: "0" },
          { label: "1. I can stand as long as I want but it gives extra pain.", value: "1" },
          { label: "2. Pain prevents me standing more than 1 hour.", value: "2" },
          { label: "3. Pain prevents me standing more than 30 minutes.", value: "3" },
          { label: "4. Pain prevents me standing more than 10 minutes.", value: "4" },
          { label: "5. Pain prevents me from standing at all.", value: "5" },
        ],
      },
      {
        id: "odiSleeping",
        label: "ODI 7. Sleeping",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. My sleep is never disturbed by pain.", value: "0" },
          { label: "1. My sleep is occasionally disturbed by pain.", value: "1" },
          { label: "2. Because of pain, I sleep less than 6 hours.", value: "2" },
          { label: "3. Because of pain, I sleep less than 4 hours.", value: "3" },
          { label: "4. Because of pain, I sleep less than 2 hours.", value: "4" },
          { label: "5. Pain prevents me from sleeping at all.", value: "5" },
        ],
      },
      {
        id: "odiSexLife",
        label: "ODI 8. Sex life",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. My sex life is normal and causes no extra pain.", value: "0" },
          { label: "1. My sex life is normal but causes some extra pain.", value: "1" },
          { label: "2. My sex life is nearly normal but very painful.", value: "2" },
          { label: "3. My sex life is severely restricted by pain.", value: "3" },
          { label: "4. My sex life is nearly absent because of pain.", value: "4" },
          { label: "5. Pain prevents any sex life at all.", value: "5" },
        ],
      },
      {
        id: "odiSocialLife",
        label: "ODI 9. Social life",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. My social life is normal and gives me no extra pain.", value: "0" },
          { label: "1. My social life is normal but increases pain.", value: "1" },
          { label: "2. Pain has no significant effect on my social life apart from limiting energetic interests.", value: "2" },
          { label: "3. Pain has restricted my social life and I do not go out as often.", value: "3" },
          { label: "4. Pain has restricted my social life to my home.", value: "4" },
          { label: "5. I have almost no social life because of pain.", value: "5" },
        ],
      },
      {
        id: "odiTravelling",
        label: "ODI 10. Travelling",
        type: "select",
        required: true,
        showIf: isBackPrimary,
        options: [
          { label: "0. I can travel anywhere without extra pain.", value: "0" },
          { label: "1. I can travel anywhere but it gives extra pain.", value: "1" },
          { label: "2. Pain is bad but I manage journeys over 2 hours.", value: "2" },
          { label: "3. Pain restricts me to journeys under 1 hour.", value: "3" },
          { label: "4. Pain restricts me to short necessary journeys under 30 minutes.", value: "4" },
          { label: "5. Pain prevents me from travelling except for treatment.", value: "5" },
        ],
      },
    ],
  },

  {
    id: "prom-ndi",
    title: "Neck Disability Index (NDI)",
    subtitle: "Neck-primary cases only. Select one statement (0 to 5) in each NDI item.",
    questions: [
      {
        id: "ndiPainIntensity",
        label: "NDI 1. Pain intensity",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I have no pain at the moment.", value: "0" },
          { label: "1. The pain is very mild at the moment.", value: "1" },
          { label: "2. The pain is moderate at the moment.", value: "2" },
          { label: "3. The pain is fairly severe at the moment.", value: "3" },
          { label: "4. The pain is very severe at the moment.", value: "4" },
          { label: "5. The pain is the worst imaginable at the moment.", value: "5" },
        ],
      },
      {
        id: "ndiPersonalCare",
        label: "NDI 2. Personal care",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I can look after myself normally without causing extra pain.", value: "0" },
          { label: "1. I can look after myself normally but it causes extra pain.", value: "1" },
          { label: "2. It is painful to look after myself and I am slow and careful.", value: "2" },
          { label: "3. I need some help but manage most of my personal care.", value: "3" },
          { label: "4. I need help every day in most aspects of self-care.", value: "4" },
          { label: "5. I do not get dressed, wash with difficulty, and stay in bed.", value: "5" },
        ],
      },
      {
        id: "ndiLifting",
        label: "NDI 3. Lifting",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I can lift heavy weights without extra pain.", value: "0" },
          { label: "1. I can lift heavy weights but it gives extra pain.", value: "1" },
          { label: "2. Pain prevents me lifting heavy weights off the floor, but I can manage if they are conveniently placed.", value: "2" },
          { label: "3. Pain prevents me lifting heavy weights, but I can manage light to medium weights if conveniently placed.", value: "3" },
          { label: "4. I can lift only very light weights.", value: "4" },
          { label: "5. I cannot lift or carry anything at all.", value: "5" },
        ],
      },
      {
        id: "ndiReading",
        label: "NDI 4. Reading",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I can read as much as I want with no neck pain.", value: "0" },
          { label: "1. I can read as much as I want with slight neck pain.", value: "1" },
          { label: "2. I can read as much as I want with moderate neck pain.", value: "2" },
          { label: "3. I cannot read as much as I want because of moderate neck pain.", value: "3" },
          { label: "4. I can hardly read at all because of severe neck pain.", value: "4" },
          { label: "5. I cannot read at all.", value: "5" },
        ],
      },
      {
        id: "ndiHeadaches",
        label: "NDI 5. Headaches",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I have no headaches at all.", value: "0" },
          { label: "1. I have slight headaches that come infrequently.", value: "1" },
          { label: "2. I have moderate headaches that come infrequently.", value: "2" },
          { label: "3. I have moderate headaches that come frequently.", value: "3" },
          { label: "4. I have severe headaches that come frequently.", value: "4" },
          { label: "5. I have headaches almost all the time.", value: "5" },
        ],
      },
      {
        id: "ndiConcentration",
        label: "NDI 6. Concentration",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I can concentrate fully when I want to with no difficulty.", value: "0" },
          { label: "1. I can concentrate fully when I want to with slight difficulty.", value: "1" },
          { label: "2. I have a fair degree of difficulty concentrating when I want to.", value: "2" },
          { label: "3. I have a lot of difficulty concentrating when I want to.", value: "3" },
          { label: "4. I have a great deal of difficulty concentrating when I want to.", value: "4" },
          { label: "5. I cannot concentrate at all.", value: "5" },
        ],
      },
      {
        id: "ndiWork",
        label: "NDI 7. Work",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I can do as much work as I want.", value: "0" },
          { label: "1. I can only do my usual work, but no more.", value: "1" },
          { label: "2. I can do most of my usual work, but no more.", value: "2" },
          { label: "3. I cannot do my usual work.", value: "3" },
          { label: "4. I can hardly do any work at all.", value: "4" },
          { label: "5. I cannot do any work at all.", value: "5" },
        ],
      },
      {
        id: "ndiDriving",
        label: "NDI 8. Driving",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I can drive my car without neck pain.", value: "0" },
          { label: "1. I can drive my car as long as I want with slight neck pain.", value: "1" },
          { label: "2. I can drive my car as long as I want with moderate neck pain.", value: "2" },
          { label: "3. I cannot drive my car as long as I want because of moderate neck pain.", value: "3" },
          { label: "4. I can hardly drive at all because of severe neck pain.", value: "4" },
          { label: "5. I cannot drive my car at all.", value: "5" },
        ],
      },
      {
        id: "ndiSleeping",
        label: "NDI 9. Sleeping",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I have no trouble sleeping.", value: "0" },
          { label: "1. My sleep is slightly disturbed (less than 1 hour sleepless).", value: "1" },
          { label: "2. My sleep is mildly disturbed (1 to 2 hours sleepless).", value: "2" },
          { label: "3. My sleep is moderately disturbed (2 to 3 hours sleepless).", value: "3" },
          { label: "4. My sleep is greatly disturbed (3 to 5 hours sleepless).", value: "4" },
          { label: "5. My sleep is completely disturbed (5 to 7 hours sleepless).", value: "5" },
        ],
      },
      {
        id: "ndiRecreation",
        label: "NDI 10. Recreation",
        type: "select",
        required: true,
        showIf: isNeckPrimary,
        options: [
          { label: "0. I am able to engage in all my recreation activities with no neck pain.", value: "0" },
          { label: "1. I am able to engage in all my recreation activities with some neck pain.", value: "1" },
          { label: "2. I am able to engage in most, but not all, of my usual recreation activities because of neck pain.", value: "2" },
          { label: "3. I am able to engage in a few of my usual recreation activities because of neck pain.", value: "3" },
          { label: "4. I can hardly do any recreation activities because of neck pain.", value: "4" },
          { label: "5. I cannot do any recreation activities at all.", value: "5" },
        ],
      },
    ],
  },

  // ── Outcome-Tracking Anchor + Conditional Myelopathy Screen ─────────────────
  {
    id: "outcome-myelopathy",
    title: "Overall health & additional checks",
    subtitle: "Registry baseline tracking and higher-risk neck screening (if applicable).",
    questions: [
      {
        id: "spineHealthAnchor",
        label: "Overall spine health today (0 = worst, 10 = completely healthy)",
        type: "range",
        helpText: "Used for 3/6/12-month outcome tracking — not for same-visit diagnosis.",
      },
      // Myelopathy screen — only for neck + frequent numbness or weakness
      {
        id: "myelopathyHandTasks",
        label: "Fine hand tasks (buttoning, writing, picking up small objects)",
        type: "select",
        showIf: (a) => isNeckPrimary(a) && hasFrequentNeuro(a),
        options: [
          { label: "Normal", value: "normal" },
          { label: "Slight clumsiness", value: "slight" },
          { label: "Noticeable difficulty", value: "noticeable" },
          { label: "Significant impairment", value: "significant" },
        ],
      },
      {
        id: "myelopathyBalance",
        label: "Balance / gait",
        type: "select",
        showIf: (a) => isNeckPrimary(a) && hasFrequentNeuro(a),
        options: [
          { label: "Normal", value: "normal" },
          { label: "Mild unsteadiness", value: "mild" },
          { label: "Frequent imbalance", value: "frequent" },
          { label: "Needs support to walk", value: "needs-support" },
        ],
      },
    ],
  },
]);
