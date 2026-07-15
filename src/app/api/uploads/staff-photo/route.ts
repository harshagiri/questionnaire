import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_PHOTO_BYTES = 1024 * 1024;

function isStaffSession(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const roleCookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("se_role="));

  if (!roleCookie) {
    return false;
  }

  const role = roleCookie.replace("se_role=", "");
  return role === "doctor" || role === "receptionist" || role === "admin" || role === "patient";
}

function isAdmin(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const parsed = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("se_role="));

  return parsed === "se_role=admin";
}

function isAllowedMimeType(value: string) {
  return value === "image/jpeg" || value === "image/png";
}

function detectImageMimeType(bytes: Uint8Array) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  return null;
}

function parseStaffRole(value: FormDataEntryValue | null) {
  if (value !== "doctor" && value !== "receptionist" && value !== "admin") {
    return null;
  }
  return value;
}

function buildPhotoUrl(role: "doctor" | "receptionist" | "admin", email: string) {
  const params = new URLSearchParams({ role, email: email.trim().toLowerCase() });
  return `/api/uploads/staff-photo?${params.toString()}`;
}

export async function GET(request: Request) {
  if (!isStaffSession(request)) {
    return NextResponse.json({ ok: false, message: "Authentication required" }, { status: 401 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: false, message: "Database is unavailable" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();

  if ((role !== "doctor" && role !== "receptionist" && role !== "admin") || !email) {
    return NextResponse.json({ ok: false, message: "role and email are required" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { role, email },
    select: { photoBlob: true, photoMimeType: true },
  });

  if (!user?.photoBlob || !user.photoMimeType) {
    return NextResponse.json({ ok: false, message: "Photo not found" }, { status: 404 });
  }

  return new NextResponse(user.photoBlob, {
    headers: {
      "Content-Type": user.photoMimeType,
      "Cache-Control": "no-store, private",
      "Content-Disposition": "inline",
    },
  });
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, message: "Admin access required" }, { status: 403 });
  }

  if (!prisma) {
    return NextResponse.json({ ok: false, message: "Database is unavailable" }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const role = parseStaffRole(formData.get("role"));
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "File is required" }, { status: 400 });
    }

    if (!role || !email) {
      return NextResponse.json({ ok: false, message: "role and email are required" }, { status: 400 });
    }

    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json({ ok: false, message: "Only JPEG and PNG are allowed" }, { status: 400 });
    }

    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ ok: false, message: "Image must be smaller than 1MB" }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: { role, email },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json({ ok: false, message: "Staff user not found" }, { status: 404 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const detectedMimeType = detectImageMimeType(bytes);
    if (!detectedMimeType) {
      return NextResponse.json({ ok: false, message: "Uploaded file is not a valid JPEG/PNG image" }, { status: 400 });
    }

    if (detectedMimeType !== file.type) {
      return NextResponse.json({ ok: false, message: "File content does not match selected image type" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        photoMimeType: detectedMimeType,
        photoBlob: bytes,
      },
    });

    return NextResponse.json({
      ok: true,
      photoUrl: buildPhotoUrl(role, email),
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Could not upload image" }, { status: 500 });
  }
}
