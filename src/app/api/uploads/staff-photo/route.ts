import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { NextResponse } from "next/server";

function isAdmin(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const parsed = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("se_role="));

  return parsed === "se_role=admin";
}

function getExtension(filename: string, mimeType: string) {
  const fromName = extname(filename || "").toLowerCase();
  if (fromName) {
    return fromName;
  }

  if (mimeType === "image/jpeg") {
    return ".jpg";
  }
  if (mimeType === "image/png") {
    return ".png";
  }
  if (mimeType === "image/webp") {
    return ".webp";
  }

  return ".jpg";
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, message: "Admin access required" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "File is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, message: "Only image files are allowed" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, message: "Image must be 5MB or smaller" }, { status: 400 });
    }

    const extension = getExtension(file.name, file.type);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    const uploadsDir = join(process.cwd(), "public", "uploads", "staff");
    const outputPath = join(uploadsDir, filename);

    await mkdir(uploadsDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(outputPath, new Uint8Array(bytes));

    return NextResponse.json({
      ok: true,
      photoUrl: `/uploads/staff/${filename}`,
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not upload image" }, { status: 500 });
  }
}
