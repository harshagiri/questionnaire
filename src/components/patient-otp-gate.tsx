"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function maskPhone(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  if (normalized.length < 4) {
    return normalized;
  }
  return `${"*".repeat(Math.max(normalized.length - 4, 0))}${normalized.slice(-4)}`;
}

export function PatientOtpGate({
  consultId,
  phone,
}: {
  consultId?: string;
  phone: string;
}) {
  const router = useRouter();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const normalizedPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);

  function continueToQuestionnaire() {
    if (!consultId) {
      router.push(`/patient/book?journey=1${normalizedPhone ? `&phone=${encodeURIComponent(normalizedPhone)}` : ""}`);
      return;
    }

    router.push(
      `/patient/consult/${encodeURIComponent(consultId)}?phone=${encodeURIComponent(normalizedPhone)}&journey=1`,
    );
  }

  async function verifyDummyOtp() {
    setError("");
    if (otp.trim().length < 4) {
      setError("Enter the 4-digit OTP");
      return;
    }

    setVerifying(true);
    try {
      // Journey uses a demo OTP gate for now; any 4 digits can continue.
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      continueToQuestionnaire();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">OTP verification</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Verify your phone</h1>
          <p className="mt-2 text-sm text-gray-600">
            Enter OTP sent to {maskPhone(normalizedPhone)}.
          </p>
          <p className="mt-1 text-xs text-blue-700">Demo mode: use any 4 digits.</p>

          <input
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter OTP"
            inputMode="numeric"
            className="mt-5 w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-lg tracking-[0.35em] text-gray-900 outline-none focus:border-blue-500"
          />

          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={verifyDummyOtp}
            disabled={verifying}
            className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {verifying ? "Verifying..." : "Continue"}
          </button>

          <button
            type="button"
            onClick={() => router.push(`/patient/book?journey=1${normalizedPhone ? `&phone=${encodeURIComponent(normalizedPhone)}` : ""}`)}
            className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to booking
          </button>
        </div>
      </div>
    </div>
  );
}
