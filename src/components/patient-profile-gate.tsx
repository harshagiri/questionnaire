"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { findPatientRecordByPhone } from "@/lib/portal-storage";

type GateState = "checking" | "allowed" | "blocked";

export function PatientProfileGate({
  phone,
  children,
}: {
  phone: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function checkProfile() {
      const normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.length < 10) {
        if (!cancelled) {
          setState("blocked");
        }
        return;
      }

      const localRecord = findPatientRecordByPhone(normalizedPhone);
      if (localRecord?.patientId) {
        if (!cancelled) {
          setState("allowed");
        }
        return;
      }

      try {
        const response = await fetch(`/api/patient-register?phone=${encodeURIComponent(normalizedPhone)}`, { cache: "no-store" });
        const payload = (await response.json()) as { ok?: boolean; record?: { patientId?: string } | null };

        if (!cancelled) {
          setState(response.ok && payload.ok && Boolean(payload.record?.patientId) ? "allowed" : "blocked");
        }
      } catch {
        if (!cancelled) {
          setState("blocked");
        }
      }
    }

    void checkProfile();

    return () => {
      cancelled = true;
    };
  }, [phone]);

  if (state === "checking") {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Checking your profile…</div>;
  }

  if (state === "blocked") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-800">Complete your profile first</p>
        <p className="mt-1 text-sm text-amber-700">
          Booking appointments, pre-consult questionnaire, and report uploads are available only after your patient ID is created.
        </p>
        <div className="mt-4 flex gap-2">
          <a href="/register" className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
            Complete profile
          </a>
          <a href="/patient" className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}