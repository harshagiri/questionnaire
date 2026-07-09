export type AppRole = "patient" | "doctor" | "receptionist" | "admin";

export type Permission =
  | "questionnaire:create"
  | "questionnaire:answer"
  | "questionnaire:review"
  | "appointment:create"
  | "appointment:assign"
  | "appointment:view"
  | "access:issue"
  | "metrics:view"
  | "patient:view"
  | "doctor:view"
  | "export:download";

type RoleCapability = {
  role: AppRole;
  badge: string;
  summary: string;
  highlights: string[];
  permissions: Permission[];
};

export const permissionCatalog: Record<Permission, string> = {
  "questionnaire:create": "Build and version health questionnaires",
  "questionnaire:answer": "Fill and review patient answers",
  "questionnaire:review": "Inspect summary and discrete submissions",
  "appointment:create": "Create or update consult bookings",
  "appointment:assign": "Associate patients with doctors",
  "appointment:view": "View appointment queue and timings",
  "access:issue": "Issue and display demo access codes",
  "metrics:view": "Monitor completion and operational metrics",
  "patient:view": "Open patient journey and current state",
  "doctor:view": "Review doctor profile and roster",
  "export:download": "Download PDF or spreadsheet exports",
};

export const roleCapabilities: RoleCapability[] = [
  {
    role: "patient",
    badge: "Guided intake",
    summary:
      "A branded, mobile-friendly screening experience with confidentiality, autosave, progress tracking, and adaptive questions.",
    highlights: [
      "Welcoming onboarding screen with consent and confidentiality statement",
      "Conditional questions for age, gender, symptoms, BMI, and pain scores",
      "Review screen, submit action, thank-you screen, and autosave resume",
    ],
    permissions: ["questionnaire:answer", "patient:view"],
  },
  {
    role: "doctor",
    badge: "Consult review",
    summary:
      "A consult-friendly summary that shows the patient queue, discrete responses, open answers, and export/download actions.",
    highlights: [
      "Today’s submitted patients with completion and fill-time context",
      "Summary view alongside question-by-question responses",
      "PDF or spreadsheet export path plus consultation notes",
    ],
    permissions: ["questionnaire:review", "doctor:view", "export:download", "appointment:assign"],
  },
  {
    role: "receptionist",
    badge: "Front desk",
      summary:
        "A mobile-friendly front-desk workspace for appointment booking only.",
    highlights: [
      "Book the appointment and issue the consultation session",
      "Build questionnaires with question types, branches, and linked question info",
      "Copy the demo OTP into the patient login flow during onboarding",
    ],
      permissions: ["appointment:create", "appointment:view", "access:issue", "patient:view"],
  },
  {
    role: "admin",
    badge: "Ops metrics",
    summary:
      "A configurable control plane for role permissions, usage metrics, turnaround time, and overall questionnaire throughput.",
    highlights: [
      "Average time-to-fill, abandonment, and completion rate tracking",
      "Doctor and appointment-level usage summaries",
      "Backend-driven RBAC and settings management",
    ],
      permissions: ["metrics:view", "questionnaire:create", "appointment:create"],
  },
];

export function resolvePermissions(role: AppRole): Permission[] {
  return roleCapabilities.find((item) => item.role === role)?.permissions ?? [];
}