import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { buildStaffPhotoUrl } from "@/lib/staff-auth";

type DbDoctorRecord = {
  id: string;
  name: string;
  phone: string;
  registrationNumber: string;
  licenseNumber: string;
  bio: string | null;
  photoUrl: string | null;
  createdAt: Date;
  user: {
    email: string;
  };
};

const doctorCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(8),
  registrationNumber: z.string().min(2),
  licenseNumber: z.string().min(2),
  bio: z.string().min(2),
  photoUrl: z.string().min(1).optional().or(z.literal("")),
});

const doctorUpdateSchema = z.object({
  id: z.string().min(1).optional(),
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().min(8),
  registrationNumber: z.string().min(2),
  licenseNumber: z.string().min(2),
  bio: z.string().optional(),
  password: z.string().min(8).optional(),
});

type StoredDoctor = {
  id: string;
  name: string;
  email: string;
  phone: string;
  registrationNumber: string;
  licenseNumber: string;
  bio: string;
  photoUrl: string;
  createdAt: string;
};

const doctorStorePath = join(process.cwd(), "data", "doctors.json");
const storageMode = process.env.DOCTORS_STORAGE_MODE?.toLowerCase() ?? "auto";

function shouldUseDb() {
  if (storageMode === "database") {
    return true;
  }
  if (storageMode === "file") {
    return false;
  }

  return Boolean(prisma);
}

async function readDoctors(): Promise<StoredDoctor[]> {
  try {
    const raw = await readFile(doctorStorePath, "utf8");
    return JSON.parse(raw) as StoredDoctor[];
  } catch {
    return [];
  }
}

async function saveDoctors(doctors: StoredDoctor[]) {
  await mkdir(dirname(doctorStorePath), { recursive: true });
  await writeFile(doctorStorePath, JSON.stringify(doctors, null, 2), "utf8");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const receptionistEmail = searchParams.get("receptionistEmail");
  const withSlots = searchParams.get("withSlots") === "true";

  if (storageMode === "database" && !prisma) {
    return NextResponse.json({ ok: false, message: "Database is unavailable" }, { status: 503 });
  }

  if (shouldUseDb() && prisma) {
    try {
      let doctorProfiles;

      if (receptionistEmail) {
        // Only return doctors assigned to this receptionist
        const receptionistUser = await prisma.user.findUnique({
          where: { email: receptionistEmail.toLowerCase() },
          select: { id: true },
        });

        if (!receptionistUser) {
          return NextResponse.json({ ok: true, doctors: [], storage: "database" });
        }

        const assignments = await prisma.receptionistDoctorAssignment.findMany({
          where: { receptionistId: receptionistUser.id },
          select: { doctorProfileId: true },
        });

        const assignedIds = assignments.map((a) => a.doctorProfileId);

        doctorProfiles = await prisma.doctorProfile.findMany({
          where: { id: { in: assignedIds } },
          include: {
            user: true,
            availabilitySlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
          },
          orderBy: { createdAt: "desc" },
        });
      } else {
        doctorProfiles = await prisma.doctorProfile.findMany({
          include: {
            user: true,
            ...(withSlots ? { availabilitySlots: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] } } : {}),
          },
          orderBy: { createdAt: "desc" },
        });
      }

      return NextResponse.json({
        ok: true,
        doctors: doctorProfiles.map((doctor) => {
          const d = doctor as typeof doctor & { user: { email: string; photoUrl?: string | null }; availabilitySlots?: unknown[] };
          const hasDbPhoto = Boolean((d.user as { photoMimeType?: string | null }).photoMimeType);
          const resolvedPhoto = hasDbPhoto ? buildStaffPhotoUrl("doctor", d.user.email) : "";
          return {
            id: doctor.id,
            name: doctor.name,
            email: d.user.email,
            phone: doctor.phone,
            registrationNumber: doctor.registrationNumber,
            licenseNumber: doctor.licenseNumber,
            bio: doctor.bio ?? "",
            photoUrl: resolvedPhoto,
            createdAt: doctor.createdAt.toISOString(),
            slots: d.availabilitySlots ?? [],
          };
        }),
        storage: "database",
      });
    } catch {
      if (storageMode === "database") {
        return NextResponse.json(
          { ok: false, message: "Database is unavailable" },
          { status: 503 },
        );
      }
    }
  }

  const doctors = await readDoctors();

  return NextResponse.json({
    ok: true,
    doctors,
    storage: "file",
  });
}

export async function POST(request: Request) {
  const payload = doctorCreateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ ok: false, message: "Invalid doctor payload" }, { status: 400 });
  }

  const input = payload.data;
  const email = input.email.trim().toLowerCase();
  const photoUrl = input.photoUrl?.trim() ? input.photoUrl.trim() : "";

  const existing = await readDoctors();
  if (storageMode === "database" && !prisma) {
    return NextResponse.json({ ok: false, message: "Database is unavailable" }, { status: 503 });
  }

  if (shouldUseDb() && prisma) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findUnique({
          where: { email },
          select: { id: true, role: true },
        });

        if (existingUser && existingUser.role !== "doctor") {
          throw new Error("Email already exists under a different role");
        }

        const passwordHash = await hash(input.password, 10);
        const user = existingUser
          ? await tx.user.update({
              where: { email },
              data: {
                displayName: input.name,
                passwordHash,
                photoUrl,
              },
            })
          : await tx.user.create({
              data: {
                email,
                passwordHash,
                role: "doctor",
                displayName: input.name,
                photoUrl: "",
              },
            });

        const existingProfile = await tx.doctorProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });

        if (existingProfile) {
          throw new Error("Doctor profile already exists");
        }

        return tx.doctorProfile.create({
          include: { user: true },
          data: {
            userId: user.id,
            name: input.name,
            phone: input.phone,
            registrationNumber: input.registrationNumber,
            licenseNumber: input.licenseNumber,
            bio: input.bio,
            photoUrl,
          },
        });
      });

      return NextResponse.json({
        ok: true,
        doctor: {
          id: created.id,
          name: created.name,
          email: created.user.email,
          phone: created.phone,
          registrationNumber: created.registrationNumber,
          licenseNumber: created.licenseNumber,
          bio: created.bio ?? "",
          photoUrl: created.user.photoMimeType ? buildStaffPhotoUrl("doctor", created.user.email) : "",
          createdAt: created.createdAt.toISOString(),
        },
        storage: "database",
      });
    } catch {
      if (storageMode === "database") {
        return NextResponse.json(
          { ok: false, message: "Could not create doctor in database" },
          { status: 409 },
        );
      }
    }
  }

  if (existing.some((item) => item.email === email)) {
    return NextResponse.json(
      { ok: false, message: "Could not create doctor (email may already exist)" },
      { status: 409 },
    );
  }

  const created: StoredDoctor = {
    id: `doc-${Date.now()}`,
    name: input.name,
    email,
    phone: input.phone,
    registrationNumber: input.registrationNumber,
    licenseNumber: input.licenseNumber,
    bio: input.bio ?? "",
    photoUrl,
    createdAt: new Date().toISOString(),
  };

  const next = [...existing, created];
  await saveDoctors(next);

  return NextResponse.json({ ok: true, doctor: created, storage: "file" });
}

export async function PUT(request: Request) {
  const payload = doctorUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ ok: false, message: "Invalid doctor update payload" }, { status: 400 });
  }

  const input = payload.data;
  const email = input.email.trim().toLowerCase();

  if (storageMode === "database" && !prisma) {
    return NextResponse.json({ ok: false, message: "Database is unavailable" }, { status: 503 });
  }

  if (shouldUseDb() && prisma) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const profile = input.id
          ? await tx.doctorProfile.findUnique({
              where: { id: input.id },
              include: { user: true },
            })
          : await tx.doctorProfile.findFirst({
              where: { user: { email } },
              include: { user: true },
            });

        if (!profile) {
          throw new Error("Doctor not found");
        }

        if (profile.user.email.trim().toLowerCase() !== email) {
          throw new Error("Doctor email does not match selected profile");
        }

        const nextPasswordHash = input.password?.trim() ? await hash(input.password.trim(), 10) : profile.user.passwordHash;

        const user = await tx.user.update({
          where: { id: profile.userId },
          data: {
            displayName: input.name,
            passwordHash: nextPasswordHash,
          },
          select: {
            email: true,
            photoMimeType: true,
          },
        });

        const doctor = await tx.doctorProfile.update({
          where: { id: profile.id },
          data: {
            name: input.name,
            phone: input.phone,
            registrationNumber: input.registrationNumber,
            licenseNumber: input.licenseNumber,
            bio: input.bio ?? "",
          },
        });

        return { doctor, user };
      });

      return NextResponse.json({
        ok: true,
        doctor: {
          id: updated.doctor.id,
          name: updated.doctor.name,
          email: updated.user.email,
          phone: updated.doctor.phone,
          registrationNumber: updated.doctor.registrationNumber,
          licenseNumber: updated.doctor.licenseNumber,
          bio: updated.doctor.bio ?? "",
          photoUrl: updated.user.photoMimeType ? buildStaffPhotoUrl("doctor", updated.user.email) : "",
          createdAt: updated.doctor.createdAt.toISOString(),
        },
        storage: "database",
      });
    } catch (error) {
      return NextResponse.json(
        { ok: false, message: error instanceof Error ? error.message : "Could not update doctor" },
        { status: 409 },
      );
    }
  }

  const doctors = await readDoctors();
  const index = doctors.findIndex((item) => item.email.toLowerCase() === email);
  if (index < 0) {
    return NextResponse.json({ ok: false, message: "Doctor not found" }, { status: 404 });
  }

  doctors[index] = {
    ...doctors[index],
    name: input.name,
    phone: input.phone,
    registrationNumber: input.registrationNumber,
    licenseNumber: input.licenseNumber,
    bio: input.bio ?? "",
  };

  await saveDoctors(doctors);

  return NextResponse.json({ ok: true, doctor: doctors[index], storage: "file" });
}
