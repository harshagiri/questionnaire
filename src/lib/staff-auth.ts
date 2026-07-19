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
  isActive: boolean;
  deactivatedAt?: string | null;
  deletedAt?: string | null;
  photoUrl?: string;
  createdAt: string;
};

type ListStaffOptions = {
  includeDeleted?: boolean;
};

export function buildStaffPhotoUrl(role: Exclude<AppRole, "patient">, email: string) {
  const params = new URLSearchParams({
    role,
    email: email.trim().toLowerCase(),
    v: String(Date.now()),
  });
  return `/api/uploads/staff-photo?${params.toString()}`;
}

function isStaffRole(role: string): role is Exclude<AppRole, "patient"> {
  return role === "doctor" || role === "receptionist" || role === "admin";
}

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
    return parsed.map((item) => ({
      ...item,
      isActive: item.isActive ?? true,
      deactivatedAt: item.deactivatedAt ?? null,
      deletedAt: item.deletedAt ?? null,
    }));
  } catch {
    return [];
  }
}

async function writeStoredStaffAccounts(accounts: StaffAccount[]) {
  await mkdir(dirname(staffStorePath), { recursive: true });
  await writeFile(staffStorePath, JSON.stringify(accounts, null, 2), "utf8");
}

export async function listStaffAccounts(options: ListStaffOptions = {}): Promise<StaffAccount[]> {
  const includeDeleted = options.includeDeleted ?? false;

  if (shouldUseDb() && prisma) {
    const dbUsers = await prisma.user.findMany({
      where: {
        role: { in: ["doctor", "receptionist", "admin"] },
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      orderBy: { createdAt: "desc" },
      select: {
        role: true,
        email: true,
        passwordHash: true,
        displayName: true,
        isActive: true,
        deactivatedAt: true,
        deletedAt: true,
        photoMimeType: true,
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
        isActive: item.isActive,
        deactivatedAt: item.deactivatedAt?.toISOString() ?? null,
        deletedAt: item.deletedAt?.toISOString() ?? null,
        photoUrl: item.photoMimeType ? buildStaffPhotoUrl(item.role, item.email) : "",
        createdAt: item.createdAt.toISOString(),
      }));

    const dedupedByRoleEmail = new Map<string, StaffAccount>();
    for (const item of dbAccounts) {
      dedupedByRoleEmail.set(`${item.role}:${item.email.toLowerCase()}`, item);
    }

    return Array.from(dedupedByRoleEmail.values());
  }

  const stored = await readStoredStaffAccounts();
  const filteredStored = includeDeleted ? stored : stored.filter((item) => !item.deletedAt);
  const dedupedByRoleEmail = new Map<string, StaffAccount>();
  for (const item of filteredStored) {
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
        isActive: true,
        deactivatedAt: null,
        deletedAt: null,
        photoUrl,
      },
      select: {
        role: true,
        email: true,
        passwordHash: true,
        displayName: true,
        isActive: true,
        deactivatedAt: true,
        deletedAt: true,
        photoMimeType: true,
        createdAt: true,
      },
    });

    return {
      role,
      email: created.email,
      passwordHash: created.passwordHash,
      displayName: created.displayName,
      isActive: created.isActive,
      deactivatedAt: created.deactivatedAt?.toISOString() ?? null,
      deletedAt: created.deletedAt?.toISOString() ?? null,
      photoUrl: created.photoMimeType ? buildStaffPhotoUrl(role, created.email) : "",
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
    isActive: true,
    deactivatedAt: null,
    deletedAt: null,
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
        isActive: true,
        deactivatedAt: true,
        deletedAt: true,
        photoMimeType: true,
        createdAt: true,
      },
    });

    return {
      role,
      email: updated.email,
      passwordHash: updated.passwordHash,
      displayName: updated.displayName,
      isActive: updated.isActive,
      deactivatedAt: updated.deactivatedAt?.toISOString() ?? null,
      deletedAt: updated.deletedAt?.toISOString() ?? null,
      photoUrl: updated.photoMimeType ? buildStaffPhotoUrl(role, updated.email) : "",
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

export async function verifyStaffCredentials(
  role: Exclude<AppRole, "patient">,
  email: string,
  password: string,
): Promise<{ ok: true; displayName: string; photoUrl?: string } | { ok: false }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (shouldUseDb() && prisma) {
    try {
      const account = await prisma.user.findFirst({
        where: { role, email: normalizedEmail, deletedAt: null, isActive: true },
        select: {
          passwordHash: true,
          displayName: true,
          photoMimeType: true,
        },
      });

      if (!account) {
        return { ok: false };
      }

      const valid = await compare(password, account.passwordHash);
      if (!valid) {
        return { ok: false };
      }

      const resolvedPhotoUrl = account.photoMimeType ? buildStaffPhotoUrl(role, normalizedEmail) : "";
      return { ok: true, displayName: account.displayName, photoUrl: resolvedPhotoUrl };
    } catch {
      return { ok: false };
    }
  }

  const accounts = await listStaffAccounts();
  const account = accounts.find(
    (item) => item.role === role && item.email === normalizedEmail && item.isActive && !item.deletedAt,
  );
  if (!account) {
    return { ok: false };
  }

  const valid = await compare(password, account.passwordHash);
  if (!valid) {
    return { ok: false };
  }

  return { ok: true, displayName: account.displayName, photoUrl: account.photoUrl };
}

export async function setStaffAccountActivation(input: {
  role: Exclude<AppRole, "patient">;
  email: string;
  isActive: boolean;
}) {
  const role = input.role;
  const email = input.email.trim().toLowerCase();

  if (shouldUseDb() && prisma) {
    const existing = await prisma.user.findFirst({
      where: { role, email, deletedAt: null },
      select: { email: true },
    });

    if (!existing) {
      throw new Error("Staff user not found");
    }

    const updated = await prisma.user.update({
      where: { email },
      data: {
        isActive: input.isActive,
        deactivatedAt: input.isActive ? null : new Date(),
      },
      select: {
        role: true,
        email: true,
        passwordHash: true,
        displayName: true,
        isActive: true,
        deactivatedAt: true,
        deletedAt: true,
        photoMimeType: true,
        createdAt: true,
      },
    });

    return {
      role,
      email: updated.email,
      passwordHash: updated.passwordHash,
      displayName: updated.displayName,
      isActive: updated.isActive,
      deactivatedAt: updated.deactivatedAt?.toISOString() ?? null,
      deletedAt: updated.deletedAt?.toISOString() ?? null,
      photoUrl: updated.photoMimeType ? buildStaffPhotoUrl(role, updated.email) : "",
      createdAt: updated.createdAt.toISOString(),
    } satisfies StaffAccount;
  }

  const stored = await readStoredStaffAccounts();
  const index = stored.findIndex((item) => item.role === role && item.email === email && !item.deletedAt);

  if (index < 0) {
    throw new Error("Staff user not found");
  }

  stored[index] = {
    ...stored[index],
    isActive: input.isActive,
    deactivatedAt: input.isActive ? null : new Date().toISOString(),
  };
  await writeStoredStaffAccounts(stored);
  return stored[index];
}

export async function softDeleteStaffAccount(input: {
  role: Exclude<AppRole, "patient">;
  email: string;
}) {
  const role = input.role;
  const email = input.email.trim().toLowerCase();

  if (shouldUseDb() && prisma) {
    const existing = await prisma.user.findFirst({
      where: { role, email, deletedAt: null },
      select: { email: true },
    });

    if (!existing) {
      throw new Error("Staff user not found");
    }

    await prisma.user.update({
      where: { email },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deletedAt: new Date(),
      },
    });
    return { ok: true };
  }

  const stored = await readStoredStaffAccounts();
  const index = stored.findIndex((item) => item.role === role && item.email === email && !item.deletedAt);

  if (index < 0) {
    throw new Error("Staff user not found");
  }

  stored[index] = {
    ...stored[index],
    isActive: false,
    deactivatedAt: new Date().toISOString(),
    deletedAt: new Date().toISOString(),
  };
  await writeStoredStaffAccounts(stored);
  return { ok: true };
}
