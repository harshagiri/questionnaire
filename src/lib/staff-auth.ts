import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { compare, hash } from "bcryptjs";
import type { AppRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export type StaffAccount = {
  role: Exclude<AppRole, "patient">;
  email: string;
  passwordHash: string;
  displayName: string;
  photoUrl?: string;
  createdAt: string;
};

function isStaffRole(role: string): role is Exclude<AppRole, "patient"> {
  return role === "doctor" || role === "receptionist" || role === "admin";
}

export const defaultStaffAccounts: StaffAccount[] = [
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
const storageMode = process.env.STAFF_USERS_STORAGE_MODE?.toLowerCase() ?? "auto";

function shouldUseDb() {
  if (storageMode === "database") {
    return true;
  }
  if (storageMode === "file") {
    return false;
  }
  return Boolean(prisma);
}

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

export async function listStaffAccounts(): Promise<StaffAccount[]> {
  if (shouldUseDb() && prisma) {
    const dbUsers = await prisma.user.findMany({
      where: { role: { in: ["doctor", "receptionist", "admin"] } },
      orderBy: { createdAt: "desc" },
      select: {
        role: true,
        email: true,
        passwordHash: true,
        displayName: true,
        photoUrl: true,
        createdAt: true,
      },
    });

    const dbAccounts = dbUsers
      .filter((item): item is typeof item & { role: Exclude<AppRole, "patient"> } => isStaffRole(item.role))
      .map((item) => ({
        role: item.role,
        email: item.email,
        passwordHash: item.passwordHash,
        displayName: item.displayName,
        photoUrl: item.photoUrl ?? "",
        createdAt: item.createdAt.toISOString(),
      }));

    // Roles that have at least one real DB account — hide demo defaults for those
    const rolesWithDbAccounts = new Set(dbAccounts.map((a) => a.role));
    // For roles with NO DB accounts, keep showing the demo defaults
    const defaultsForEmptyRoles = defaultStaffAccounts.filter((d) => !rolesWithDbAccounts.has(d.role));

    const dedupedByRoleEmail = new Map<string, StaffAccount>();
    for (const item of [...defaultsForEmptyRoles, ...dbAccounts]) {
      dedupedByRoleEmail.set(`${item.role}:${item.email.toLowerCase()}`, item);
    }

    return Array.from(dedupedByRoleEmail.values());
  }

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
  photoUrl?: string;
}) {
  const role = input.role;
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const photoUrl = input.photoUrl?.trim() || "";

  if (shouldUseDb() && prisma) {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });

    if (existing && existing.role === role) {
      throw new Error("Staff user already exists for this role and email");
    }

    if (existing && existing.role !== role) {
      throw new Error("Email already exists under a different role");
    }

    const created = await prisma.user.create({
      data: {
        role,
        email,
        passwordHash: await hash(input.password, 10),
        displayName,
        photoUrl,
      },
      select: {
        role: true,
        email: true,
        passwordHash: true,
        displayName: true,
        photoUrl: true,
        createdAt: true,
      },
    });

    return {
      role: created.role,
      email: created.email,
      passwordHash: created.passwordHash,
      displayName: created.displayName,
      photoUrl: created.photoUrl ?? "",
      createdAt: created.createdAt.toISOString(),
    };
  }

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
    photoUrl,
    createdAt: new Date().toISOString(),
  };

  await writeStoredStaffAccounts([...stored, created]);
  return created;
}

export async function updateStaffAccount(input: {
  role: Exclude<AppRole, "patient">;
  email: string;
  displayName?: string;
  password?: string;
  photoUrl?: string;
}) {
  const role = input.role;
  const email = input.email.trim().toLowerCase();
  const nextDisplayName = input.displayName?.trim();
  const nextPassword = input.password?.trim();
  const nextPhotoUrl = input.photoUrl?.trim();

  if (!nextDisplayName && !nextPassword && nextPhotoUrl === undefined) {
    throw new Error("Nothing to update");
  }

  if (shouldUseDb() && prisma) {
    const existing = await prisma.user.findFirst({
      where: { role, email },
      select: {
        role: true,
        email: true,
        passwordHash: true,
        displayName: true,
        photoUrl: true,
        createdAt: true,
      },
    });

    if (!existing) {
      throw new Error("Staff user not found");
    }

    const updated = await prisma.user.update({
      where: { email },
      data: {
        displayName: nextDisplayName || existing.displayName,
        passwordHash: nextPassword ? await hash(nextPassword, 10) : existing.passwordHash,
        photoUrl: nextPhotoUrl !== undefined ? nextPhotoUrl : (existing.photoUrl ?? ""),
      },
      select: {
        role: true,
        email: true,
        passwordHash: true,
        displayName: true,
        photoUrl: true,
        createdAt: true,
      },
    });

    return {
      role: updated.role,
      email: updated.email,
      passwordHash: updated.passwordHash,
      displayName: updated.displayName,
      photoUrl: updated.photoUrl ?? "",
      createdAt: updated.createdAt.toISOString(),
    };
  }

  const existing = await listStaffAccounts();
  const account: StaffAccount | undefined = existing.find((item) => item.role === role && item.email === email);
  if (!account) {
    throw new Error("Staff user not found");
  }

  const stored = await readStoredStaffAccounts();
  const index = stored.findIndex((item) => item.role === role && item.email === email);

  const updated: StaffAccount = {
    ...account,
    displayName: nextDisplayName || account.displayName,
    passwordHash: nextPassword ? await hash(nextPassword, 10) : account.passwordHash,
    photoUrl: nextPhotoUrl !== undefined ? nextPhotoUrl : (account.photoUrl ?? ""),
  };

  if (index >= 0) {
    stored[index] = updated;
    await writeStoredStaffAccounts(stored);
  } else {
    await writeStoredStaffAccounts([...stored, updated]);
  }

  return updated;
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
): Promise<{ ok: true; displayName: string; photoUrl?: string } | { ok: false }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (shouldUseDb() && prisma) {
    const account = await prisma.user.findFirst({
      where: { role, email: normalizedEmail },
      select: {
        passwordHash: true,
        displayName: true,
        photoUrl: true,
        doctorProfile: { select: { photoUrl: true } },
      },
    });

    if (!account) {
      const fallback = defaultStaffAccounts.find((item) => item.role === role && item.email === normalizedEmail);
      if (!fallback) {
        return { ok: false };
      }

      const fallbackValid = await compare(password, fallback.passwordHash);
      if (!fallbackValid) {
        return { ok: false };
      }

      return { ok: true, displayName: fallback.displayName, photoUrl: fallback.photoUrl };
    }

    const valid = await compare(password, account.passwordHash);
    if (!valid) {
      return { ok: false };
    }

    // Prefer User.photoUrl; fall back to DoctorProfile.photoUrl if available
    const resolvedPhotoUrl = account.photoUrl?.trim() || account.doctorProfile?.photoUrl?.trim() || "";
    return { ok: true, displayName: account.displayName, photoUrl: resolvedPhotoUrl };
  }

  const accounts = await listStaffAccounts();
  const account = accounts.find((item) => item.role === role && item.email === normalizedEmail);
  if (!account) {
    return { ok: false };
  }

  const valid = await compare(password, account.passwordHash);
  if (!valid) {
    return { ok: false };
  }

  return { ok: true, displayName: account.displayName, photoUrl: account.photoUrl };
}
