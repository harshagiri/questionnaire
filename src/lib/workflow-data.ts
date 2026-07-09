import type { AppRole } from "@/lib/rbac";

export const demoOtpCode = "482931";

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
        label: "A. Loss of bladder or bowel control (unable to hold urine or stools)",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagRapidWeakness",
        label: "B. Rapidly increasing weakness in arm or leg (worsening over hours to days)",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagFever",
        label: "C. Fever with spine pain",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagTrauma",
        label: "D. New or severe spine pain after a fall, accident, or major trauma",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagCancer",
        label: "E. Known cancer with new or worsening spine pain",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagWeightLoss",
        label: "F. Significant unexplained weight loss in the past 3 months",
        type: "toggle",
        required: true,
      },
      {
        id: "redFlagNone",
        label: "G. None of the above",
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
    id: "patient-profile",
    title: "Patient profile",
    subtitle: "Basic patient details and care context.",
    questions: [
      { id: "patientName", label: "Patient / guardian full name", type: "text", required: true },
      { id: "onBehalf", label: "On behalf of patient?", type: "toggle" },
      { id: "age", label: "Age", type: "number", required: true },
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
          { label: "Other regional language", value: "other-regional" },
        ],
      },
      {
        id: "dailyActivity",
        label: "What best describes your usual work or daily activity?",
        type: "select",
        options: [
          { label: "Desk / seated work", value: "desk" },
          { label: "Standing / walking work", value: "standing" },
          { label: "Manual / physical work", value: "manual" },
          { label: "Homemaker / caregiver", value: "home" },
          { label: "Retired / not working", value: "retired" },
        ],
      },
      { id: "region", label: "Region / city", type: "text", required: true },
      { id: "phone", label: "Phone number", type: "tel", required: true },
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
      { id: "heightCm", label: "Height (cm)", type: "number", required: true },
      { id: "weightKg", label: "Weight (kg)", type: "number", required: true },
      { id: "bmi", label: "BMI (auto-calculated)", type: "info-link", linkedFrom: "heightCm" },
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

export const demoAppointments = [
  { name: "Ritika Sharma", doctor: "Dr. Aarav Mehta", slot: "10:30 AM", status: "booked" },
  { name: "Imran Khan", doctor: "Dr. Neha Iyer", slot: "11:00 AM", status: "waiting" },
  { name: "Sahana Rao", doctor: "Dr. Aarav Mehta", slot: "11:30 AM", status: "submitted" },
] as const;

export const registeredPatientProfiles = [
  {
    id: "pt-1000",
    name: "Demo Patient",
    phone: "9876543210",
    age: 36,
    gender: "male",
    preferredLanguage: "english",
    region: "Bengaluru",
  },
  {
    id: "pt-1001",
    name: "Ritika Sharma",
    phone: "9811022334",
    age: 34,
    gender: "female",
    preferredLanguage: "hindi",
    region: "Bengaluru",
  },
  {
    id: "pt-1002",
    name: "Imran Khan",
    phone: "9811022445",
    age: 47,
    gender: "male",
    preferredLanguage: "english",
    region: "Bengaluru",
  },
  {
    id: "pt-1003",
    name: "Sahana Rao",
    phone: "9811022556",
    age: 29,
    gender: "female",
    preferredLanguage: "kannada",
    region: "Mysuru",
  },
] as const;

export const roleLandingCopy: Record<AppRole, string> = {
  patient: "Patient screening with calm, mobile-first intake.",
  doctor: "Doctor consult review with sectioned validation and MRI-aware decisioning.",
  receptionist: "Front-desk appointment booking only.",
  admin: "Operational metrics and backend-driven RBAC controls.",
};