import { demoOtpCode } from "@/lib/workflow-data";

export function isAllowedDemoOtp(input: string) {
  return input.trim() === demoOtpCode;
}

export const roleHomePath: Record<string, string> = {
  patient: "/patient/demo-session",
  doctor: "/doctor",
  receptionist: "/receptionist",
  admin: "/admin",
};

export const routeRoleMap: Array<{ prefix: string; role: string }> = [
  { prefix: "/patient", role: "patient" },
  { prefix: "/doctor", role: "doctor" },
  { prefix: "/receptionist", role: "receptionist" },
  { prefix: "/admin", role: "admin" },
];
