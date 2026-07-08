import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  const body = (await request.json()) as SessionBody;

  if (!body.role || !roleHomePath[body.role]) {
    return NextResponse.json({ ok: false, message: "Unsupported role" }, { status: 400 });
  }

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
  }

  const response = NextResponse.json({ ok: true, role: body.role, nextPath: body.nextPath ?? roleHomePath[body.role] });
  response.cookies.set("se_role", body.role, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  const sessionName = body.role === "patient" ? body.phone ?? "patient-demo" : body.email ?? body.name ?? `${body.role}-demo`;
  response.cookies.set("se_name", sessionName, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  if (body.role === "patient") {
    response.cookies.set("se_demo_otp", demoOtpCode, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 });
  }
  return response;
}