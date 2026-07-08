import { compare } from "bcryptjs";
import type { AppRole } from "@/lib/rbac";

type StaffAccount = {
  role: Exclude<AppRole, "patient">;
  email: string;
  passwordHash: string;
  displayName: string;
};

const staffAccounts: StaffAccount[] = [
  {
    role: "doctor",
    email: "doctor@spinexpert.local",
    passwordHash: "$2b$10$JQoQxzVod.xZUd1vzxh3BecFQd.GLw.Vsj7LkuGfe8hqT1SjQKw1e",
    displayName: "Demo Doctor",
  },
  {
    role: "receptionist",
    email: "reception@spinexpert.local",
    passwordHash: "$2b$10$0/WPyzP8FHMZot5H/qlUROFpMWlTZOtWTVze4lsg9Ly/1vV8SK7km",
    displayName: "Demo Receptionist",
  },
  {
    role: "admin",
    email: "admin@spinexpert.local",
    passwordHash: "$2b$10$NugqTAKmZXzNabf56tK92uRhOFojdlEM.9FuL2ttha.Rx52Eb9A.y",
    displayName: "Demo Admin",
  },
];

export const mvpStaffCredentials = {
  doctor: "doctor@spinexpert.local / Doctor@123",
  receptionist: "reception@spinexpert.local / Reception@123",
  admin: "admin@spinexpert.local / Admin@123",
} as const;

export async function verifyStaffCredentials(
  role: Exclude<AppRole, "patient">,
  email: string,
  password: string,
): Promise<{ ok: true; displayName: string } | { ok: false }> {
  const normalizedEmail = email.trim().toLowerCase();
  const account = staffAccounts.find((item) => item.role === role && item.email === normalizedEmail);
  if (!account) {
    return { ok: false };
  }

  const valid = await compare(password, account.passwordHash);
  if (!valid) {
    return { ok: false };
  }

  return { ok: true, displayName: account.displayName };
}
