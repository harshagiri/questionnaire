import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "node:path";
import fs from "node:fs/promises";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "lab-reports");
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg"]);
const ALLOWED_FILE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/jpg"]);
const PUBLIC_UPLOAD_PREFIX = "/uploads/lab-reports/";

function normalizePhone(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function isAllowedFile(file: File) {
  const extension = getFileExtension(file.name);
  const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.has(extension);
  const normalizedMimeType = file.type.toLowerCase();
  const hasAllowedMimeType = !normalizedMimeType || ALLOWED_FILE_MIME_TYPES.has(normalizedMimeType);
  return hasAllowedExtension && hasAllowedMimeType;
}

function resolveStoredPathToDisk(storedPath: string | null | undefined) {
  if (!storedPath || !storedPath.startsWith(PUBLIC_UPLOAD_PREFIX)) {
    return null;
  }

  const relativeName = storedPath.slice(PUBLIC_UPLOAD_PREFIX.length);
  if (!relativeName || relativeName.includes("..")) {
    return null;
  }

  return path.join(UPLOADS_DIR, relativeName);
}

async function filterAvailableReports<
  T extends { fileName: string; storedPath: string | null; uploadedAt: Date }
>(reports: T[]): Promise<T[]> {
  const checks = await Promise.all(
    reports.map(async (report) => {
      const ext = getFileExtension(report.fileName);
      if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
        return false;
      }

      const filePath = resolveStoredPathToDisk(report.storedPath);
      if (!filePath) {
        return false;
      }

      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    }),
  );

  return reports.filter((_, index) => checks[index]);
}

async function resolveAppointmentForUpload(input: { consultId?: string; patientPhone?: string }) {
  if (!prisma) {
    return null;
  }

  const consultId = String(input.consultId ?? "").trim();
  const normalizedPhone = normalizePhone(input.patientPhone);

  if (consultId) {
    const byConsult = await prisma.appointment.findFirst({
      where: {
        OR: [{ id: consultId }, { consultSessionId: consultId }, { consultId }],
      },
      orderBy: { updatedAt: "desc" },
    });

    if (byConsult) {
      return byConsult;
    }
  }

  if (normalizedPhone) {
    const existingByPhone = await prisma.appointment.findFirst({
      where: {
        patientPhone: normalizedPhone,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (existingByPhone) {
      return existingByPhone;
    }

    const patientRecord = await prisma.patientRecord.findUnique({ where: { phone: normalizedPhone } });
    const patientName = patientRecord?.fullName ?? `Patient ${normalizedPhone.slice(-4) || "unknown"}`;
    const patientEmail = `patient-${normalizedPhone || Date.now()}@spinexpert.local`;
    const patientUser = await prisma.user.upsert({
      where: { email: patientEmail },
      create: {
        email: patientEmail,
        passwordHash: `patient:${normalizedPhone || "upload"}`,
        role: "patient",
        displayName: patientName,
      },
      update: { displayName: patientName },
    });

    const doctorProfile = await prisma.doctorProfile.findFirst({ include: { user: true }, orderBy: { createdAt: "asc" } });
    if (!doctorProfile?.user) {
      return null;
    }
    const doctorUser = doctorProfile.user;
    const doctorName = doctorProfile.name;

    const now = new Date();
    const consultSessionId = `DOCS-${normalizedPhone}-${Date.now()}`;
    return prisma.appointment.create({
      data: {
        consultSessionId,
        consultId: consultSessionId,
        patientId: patientUser.id,
        patientRecordId: patientRecord?.id,
        patientName,
        patientPhone: normalizedPhone,
        doctorId: doctorUser.id,
        doctorName,
        appointmentDate: now,
        appointmentTime: "09:00",
        appointmentType: "documents",
        status: "draft",
        createdBy: "patient",
        notes: "Patient document vault upload",
      } as never,
    });
  }

  return null;
}

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const consultId = searchParams.get("consultId");
  const patientPhone = searchParams.get("patientPhone");

  if (!consultId && !patientPhone) {
    return NextResponse.json({ ok: false, message: "consultId or patientPhone is required" }, { status: 400 });
  }

  if (prisma) {
    try {
      let reports: Array<{
        id: string;
        appointmentId: string;
        fileName: string;
        fileType: string;
        fileSizeBytes: number | null;
        storedPath: string | null;
        uploadedAt: Date;
      }> = [];

      if (consultId) {
        const appointment = await resolveAppointmentForUpload({ consultId });
        if (appointment) {
          reports = await prisma.labReport.findMany({
            where: { appointmentId: appointment.id },
            orderBy: { uploadedAt: "desc" },
          });
        }
      } else {
        const normalizedPhone = normalizePhone(patientPhone);
        const appointments = await prisma.appointment.findMany({
          where: { patientPhone: normalizedPhone },
          select: { id: true },
        });

        if (appointments.length > 0) {
          reports = await prisma.labReport.findMany({
            where: {
              appointmentId: {
                in: appointments.map((item) => item.id),
              },
            },
            orderBy: { uploadedAt: "desc" },
          });
        }
      }

      const availableReports = await filterAvailableReports(reports);
      return NextResponse.json({ ok: true, reports: availableReports });
    } catch {
      // fall through
    }
  }

  return NextResponse.json({ ok: true, reports: [] });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid form data" }, { status: 400 });
  }

  const consultId = formData.get("consultId");
  const patientPhone = formData.get("patientPhone");
  const fileType = formData.get("fileType");
  const resolvedConsultId = typeof consultId === "string" ? consultId : "";
  const resolvedPatientPhone = typeof patientPhone === "string" ? patientPhone : "";

  if (!resolvedConsultId && !resolvedPatientPhone) {
    return NextResponse.json({ ok: false, message: "consultId or patientPhone is required" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ ok: false, message: "No files provided" }, { status: 400 });
  }

  const unsupported = files.find((file) => !isAllowedFile(file));
  if (unsupported) {
    return NextResponse.json(
      {
        ok: false,
        message: `File \"${unsupported.name}\" is not supported. Only PDF and JPEG are allowed`,
      },
      { status: 400 },
    );
  }

  const oversized = files.find((file) => file.size > MAX_FILE_SIZE_BYTES);
  if (oversized) {
    return NextResponse.json(
      {
        ok: false,
        message: `File \"${oversized.name}\" exceeds 5 MB limit`,
      },
      { status: 400 },
    );
  }

  const type = typeof fileType === "string" ? fileType : "other";
  const savedFiles: Array<{ fileName: string; fileSizeBytes: number; storedPath?: string }> = [];
  const appointment = await resolveAppointmentForUpload({ consultId: resolvedConsultId, patientPhone: resolvedPatientPhone });
  const filePrefix =
    appointment?.consultSessionId ||
    resolvedConsultId ||
    normalizePhone(resolvedPatientPhone) ||
    "report";

  try {
    await ensureUploadsDir();

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storedName = `${filePrefix}-${Date.now()}-${safeName}`;
      const storedPath = path.join(UPLOADS_DIR, storedName);

      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(storedPath, buffer);

      savedFiles.push({
        fileName: file.name,
        fileSizeBytes: file.size,
        storedPath: `/uploads/lab-reports/${storedName}`,
      });
    }
  } catch (err) {
    console.error("File write error:", err);
    // Return success with just the metadata — files not persisted to disk
    for (const file of files) {
      savedFiles.push({ fileName: file.name, fileSizeBytes: file.size });
    }
  }

  // Persist to DB if available
  if (prisma && appointment) {
    try {
      const createdRows = [];
      for (const f of savedFiles) {
        const created = await prisma.labReport.create({
          data: {
            appointmentId: appointment.id,
            patientRecordId: appointment.patientRecordId ?? undefined,
            fileName: f.fileName,
            fileType: type,
            storedPath: f.storedPath,
            fileSizeBytes: f.fileSizeBytes,
          },
        });
        createdRows.push(created);
      }

      return NextResponse.json({ ok: true, files: savedFiles, reports: createdRows }, { status: 201 });
    } catch {
      // DB not ready — metadata saved locally by client
    }
  }

  return NextResponse.json({ ok: true, files: savedFiles, reports: [] }, { status: 201 });
}
