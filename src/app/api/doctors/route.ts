import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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
  phone: z.string().min(8),
  registrationNumber: z.string().min(2),
  licenseNumber: z.string().min(2),
  bio: z.string().optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
});

function toGravatarUrl(email: string) {
  const md5 = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${md5}?d=identicon&s=256`;
}

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

export async function GET() {
  if (storageMode === "database" && !prisma) {
    return NextResponse.json({ ok: false, message: "Database is unavailable" }, { status: 503 });
  }

  if (shouldUseDb() && prisma) {
    try {
      const doctors = await prisma.doctorProfile.findMany({
        include: { user: true },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        ok: true,
        doctors: doctors.map((doctor: DbDoctorRecord) => ({
          id: doctor.id,
          name: doctor.name,
          email: doctor.user.email,
          phone: doctor.phone,
          registrationNumber: doctor.registrationNumber,
          licenseNumber: doctor.licenseNumber,
          bio: doctor.bio ?? "",
          photoUrl: doctor.photoUrl ?? toGravatarUrl(doctor.user.email),
          createdAt: doctor.createdAt.toISOString(),
        })),
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
  const photoUrl = input.photoUrl?.trim() ? input.photoUrl.trim() : toGravatarUrl(email);

  const existing = await readDoctors();
  if (storageMode === "database" && !prisma) {
    return NextResponse.json({ ok: false, message: "Database is unavailable" }, { status: 503 });
  }

  if (shouldUseDb() && prisma) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash: `doctor:${input.registrationNumber}`,
            role: "doctor",
            displayName: input.name,
          },
        });

        return tx.doctorProfile.create({
          include: { user: true },
          data: {
            userId: user.id,
            name: input.name,
            phone: input.phone,
            registrationNumber: input.registrationNumber,
            licenseNumber: input.licenseNumber,
            bio: input.bio ?? "",
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
          photoUrl: created.photoUrl ?? toGravatarUrl(created.user.email),
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
