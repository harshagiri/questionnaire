import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { isAllowedDemoOtp, roleHomePath } from "@/lib/auth";
import { verifyStaffCredentials } from "@/lib/staff-auth";
import { demoOtpCode } from "@/lib/workflow-data";

type SessionBody = {
  role?: string;
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  otp?: string;
  nextPath?: string;
};

function hasValidPatientPhone(phone: string | undefined) {
  const normalized = (phone ?? "").replace(/\D/g, "");
  return normalized.length >= 10;
}

function hasValidStaffCredentials(email: string | undefined, password: string | undefined) {
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email ?? "").trim());
  return looksLikeEmail && (password ?? "").trim().length >= 6;
}

function toGravatarUrl(input: string) {
  const normalized = input.trim().toLowerCase();
  const hash = createHash("md5").update(normalized).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=256`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as SessionBody;
  const protoHeader = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const isSecureRequest = protoHeader === "https" || new URL(request.url).protocol === "https:";

  if (!body.role || !roleHomePath[body.role]) {
    return NextResponse.json({ ok: false, message: "Unsupported role" }, { status: 400 });
  }

  let resolvedStaffDisplayName: string | undefined;
  let resolvedStaffPhotoUrl: string | undefined;

  if (body.role === "patient") {
    if (!hasValidPatientPhone(body.phone)) {
      return NextResponse.json({ ok: false, message: "Invalid phone number" }, { status: 400 });
    }
    if (!isAllowedDemoOtp(body.otp ?? "")) {
      return NextResponse.json({ ok: false, message: "Invalid OTP" }, { status: 401 });
    }
  } else {
    if (!hasValidStaffCredentials(body.email, body.password)) {
      return NextResponse.json({ ok: false, message: "Invalid staff credentials" }, { status: 401 });
    }

    const authResult = await verifyStaffCredentials(
      body.role as "doctor" | "receptionist" | "admin",
      body.email ?? "",
      body.password ?? "",
    );

    if (!authResult.ok) {
      return NextResponse.json({ ok: false, message: "Invalid staff credentials" }, { status: 401 });
    }

    resolvedStaffDisplayName = authResult.displayName;
    resolvedStaffPhotoUrl = authResult.photoUrl;
  }

  const response = NextResponse.json({ ok: true, role: body.role, nextPath: body.nextPath ?? roleHomePath[body.role] });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: isSecureRequest,
  };

  response.cookies.set("se_role", body.role, cookieOptions);
  const sessionName =
    body.role === "patient"
      ? body.name?.trim() || body.phone || "patient-demo"
      : resolvedStaffDisplayName ?? body.email ?? body.name ?? `${body.role}-demo`;
  response.cookies.set("se_name", sessionName, cookieOptions);
  if (body.role === "patient") {
    response.cookies.set("se_avatar", "", { ...cookieOptions, maxAge: 0 });
  } else {
    response.cookies.set("se_avatar", resolvedStaffPhotoUrl?.trim() || toGravatarUrl(body.email ?? sessionName), cookieOptions);
  }
  if (body.role === "patient") {
    response.cookies.set("se_demo_otp", demoOtpCode, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
      secure: isSecureRequest,
    });
  }
  return response;
}