import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { compare, hash } from "bcryptjs";
import type { AppRole } from "@/lib/rbac";

export type StaffAccount = {
  role: Exclude<AppRole, "patient">;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
};

const defaultStaffAccounts: StaffAccount[] = [
  {
    role: "doctor",
    email: "doctor@spinexpert.local",
    passwordHash: "$2b$10$JQoQxzVod.xZUd1vzxh3BecFQd.GLw.Vsj7LkuGfe8hqT1SjQKw1e",
    displayName: "Demo Doctor",
    createdAt: new Date(0).toISOString(),
  },
  {
    role: "receptionist",
    email: "reception@spinexpert.local",
    passwordHash: "$2b$10$0/WPyzP8FHMZot5H/qlUROFpMWlTZOtWTVze4lsg9Ly/1vV8SK7km",
    displayName: "Demo Receptionist",
    createdAt: new Date(0).toISOString(),
  },
  {
    role: "admin",
    email: "admin@spinexpert.local",
    passwordHash: "$2b$10$NugqTAKmZXzNabf56tK92uRhOFojdlEM.9FuL2ttha.Rx52Eb9A.y",
    displayName: "Demo Admin",
    createdAt: new Date(0).toISOString(),
  },
];

const staffStorePath = join(process.cwd(), "data", "staff-users.json");

async function readStoredStaffAccounts(): Promise<StaffAccount[]> {
  try {
    const raw = await readFile(staffStorePath, "utf8");
    const parsed = JSON.parse(raw) as StaffAccount[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

async function writeStoredStaffAccounts(accounts: StaffAccount[]) {
  await mkdir(dirname(staffStorePath), { recursive: true });
  await writeFile(staffStorePath, JSON.stringify(accounts, null, 2), "utf8");
}

export async function listStaffAccounts() {
  const stored = await readStoredStaffAccounts();
  const merged = [...defaultStaffAccounts, ...stored];

  const dedupedByRoleEmail = new Map<string, StaffAccount>();
  for (const item of merged) {
    dedupedByRoleEmail.set(`${item.role}:${item.email.toLowerCase()}`, item);
  }

  return Array.from(dedupedByRoleEmail.values());
}

export async function createStaffAccount(input: {
  role: Exclude<AppRole, "patient">;
  email: string;
  password: string;
  displayName: string;
}) {
  const role = input.role;
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  const existing = await listStaffAccounts();
  if (existing.some((item) => item.email === email && item.role === role)) {
    throw new Error("Staff user already exists for this role and email");
  }

  const passwordHash = await hash(input.password, 10);
  const stored = await readStoredStaffAccounts();
  const created: StaffAccount = {
    role,
    email,
    passwordHash,
    displayName,
    createdAt: new Date().toISOString(),
  };

  await writeStoredStaffAccounts([...stored, created]);
  return created;
}

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
  const accounts = await listStaffAccounts();
  const account = accounts.find((item) => item.role === role && item.email === normalizedEmail);
  if (!account) {
    return { ok: false };
  }

  const valid = await compare(password, account.passwordHash);
  if (!valid) {
    return { ok: false };
  }

  return { ok: true, displayName: account.displayName };
}
