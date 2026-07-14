import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "node:path";
import fs from "node:fs/promises";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "lab-reports");

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const consultId = searchParams.get("consultId");

  if (!consultId) {
    return NextResponse.json({ ok: false, message: "consultId is required" }, { status: 400 });
  }

  if (prisma) {
    try {
      const reports = await prisma.labReport.findMany({
        where: { appointmentId: consultId },
        orderBy: { uploadedAt: "desc" },
      });
      return NextResponse.json({ ok: true, reports });
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
  const fileType = formData.get("fileType");

  if (!consultId || typeof consultId !== "string") {
    return NextResponse.json({ ok: false, message: "consultId is required" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ ok: false, message: "No files provided" }, { status: 400 });
  }

  const type = typeof fileType === "string" ? fileType : "other";
  const savedFiles: Array<{ fileName: string; fileSizeBytes: number; storedPath?: string }> = [];

  try {
    await ensureUploadsDir();

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storedName = `${consultId}-${Date.now()}-${safeName}`;
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
  if (prisma) {
    try {
      for (const f of savedFiles) {
        await prisma.labReport.create({
          data: {
            appointmentId: consultId,
            fileName: f.fileName,
            fileType: type,
            storedPath: f.storedPath,
            fileSizeBytes: f.fileSizeBytes,
          },
        });
      }
    } catch {
      // DB not ready — metadata saved locally by client
    }
  }

  return NextResponse.json({ ok: true, files: savedFiles }, { status: 201 });
}
