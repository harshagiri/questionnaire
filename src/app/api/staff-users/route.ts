import { NextResponse } from "next/server";
import { z } from "zod";
import { createStaffAccount, listStaffAccounts, updateStaffAccount } from "@/lib/staff-auth";

const createStaffSchema = z.object({
  role: z.enum(["doctor", "receptionist", "admin"]),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
  photoUrl: z.string().min(1).optional().or(z.literal("")),
});

const updateStaffSchema = z.object({
  role: z.enum(["doctor", "receptionist", "admin"]),
  email: z.string().email(),
  displayName: z.string().min(2).optional(),
  password: z.string().min(8).optional(),
  photoUrl: z.string().min(1).optional().or(z.literal("")),
});

function isAdmin(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const parsed = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("se_role="));

  return parsed === "se_role=admin";
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, message: "Admin access required" }, { status: 403 });
  }

  const accounts = await listStaffAccounts();
  return NextResponse.json({
    ok: true,
    users: accounts.map((item) => ({
      role: item.role,
      email: item.email,
      displayName: item.displayName,
      photoUrl: item.photoUrl ?? "",
      createdAt: item.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, message: "Admin access required" }, { status: 403 });
  }

  const payload = createStaffSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ ok: false, message: "Invalid user payload" }, { status: 400 });
  }

  try {
    const created = await createStaffAccount(payload.data);
    return NextResponse.json({
      ok: true,
      user: {
        role: created.role,
        email: created.email,
        displayName: created.displayName,
        photoUrl: created.photoUrl ?? "",
        createdAt: created.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not create staff user" },
      { status: 409 },
    );
  }
}

export async function PUT(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ ok: false, message: "Admin access required" }, { status: 403 });
  }

  const payload = updateStaffSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ ok: false, message: "Invalid update payload" }, { status: 400 });
  }

  try {
    const updated = await updateStaffAccount(payload.data);
    return NextResponse.json({
      ok: true,
      user: {
        role: updated.role,
        email: updated.email,
        displayName: updated.displayName,
        photoUrl: updated.photoUrl ?? "",
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not update staff user" },
      { status: 409 },
    );
  }
}
