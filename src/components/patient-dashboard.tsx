"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { findPatientRecordByPhone, type PatientRecord, type AppointmentRecord } from "@/lib/portal-storage";
import { formatDoctorDisplayName } from "@/lib/doctor-display";
import { isPatientProfileComplete } from "@/lib/patient-profile-completion";
import { CarePlanCard } from "@/components/care-plan-card";
import type { CarePlan } from "@/lib/care-plan";

type PatientCarePlan = {
  consultSessionId: string;
  plan: CarePlan;
  updatedAt?: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
};

type ConsultModal = {
  consultId: string;
  appointmentId: string;
  doctorName: string;
  date: string;
  time: string;
  preConsultLink: string;
  videoConsultLink: string;
};

type UploadedReport = {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes?: number | null;
  storedPath?: string | null;
  uploadedAt: string;
};

const statusColors: Record<string, string> = {
  booked: "bg-blue-50 text-blue-700 border-blue-200",
  waiting: "bg-yellow-50 text-yellow-700 border-yellow-200",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-gray-50 text-gray-500 border-gray-200",
  follow_up: "bg-purple-50 text-purple-700 border-purple-200",
};

function StatusBadge({ status }: { status: string }) {
  const cls = statusColors[status] ?? "bg-gray-50 text-gray-500 border-gray-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${cls} capitalize`}>
      {status.replace("_", " ")}
    </span>
  );
}

function ConsultConfirmModal({ modal, onClose }: { modal: ConsultModal; onClose: () => void }) {
  const [copiedLink, setCopiedLink] = useState<"pre" | "video" | null>(null);

  function copy(text: string, type: "pre" | "video") {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLink(type);
      setTimeout(() => setCopiedLink(null), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Appointment booked!</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-blue-600 mb-1">Consult ID</p>
            <p className="text-xl font-mono font-bold text-blue-800">{modal.consultId}</p>
            <p className="text-xs text-blue-600 mt-1">{formatDoctorDisplayName(modal.doctorName)} · {modal.date} at {modal.time}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
            <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-700">
              Pre-consult questionnaire link and video call link sent to your registered phone and email.
            </p>
          </div>

          <div className="space-y-3">
            <div className="border border-gray-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Pre-consult questionnaire</p>
              <p className="text-xs text-gray-600 font-mono break-all mb-2">{modal.preConsultLink}</p>
              <div className="flex gap-2">
                <a
                  href={modal.preConsultLink}
                  className="flex-1 text-center bg-blue-600 text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Fill now
                </a>
                <button
                  onClick={() => copy(modal.preConsultLink, "pre")}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {copiedLink === "pre" ? "Copied!" : "Copy link"}
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Video consult link (available after pre-consult)</p>
              <p className="text-xs text-gray-400 font-mono break-all mb-2">{modal.videoConsultLink}</p>
              <button
                onClick={() => copy(modal.videoConsultLink, "video")}
                className="w-full text-center border border-gray-200 text-xs text-gray-600 font-medium py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {copiedLink === "video" ? "Copied!" : "Copy video link"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function simpleHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

type AgeBand = "child" | "adult" | "senior";
type AvatarGender = "male" | "female" | "other";

function resolveAgeBand(age?: number) {
  if (typeof age !== "number" || !Number.isFinite(age)) {
    return "adult" as AgeBand;
  }

  if (age < 18) {
    return "child";
  }

  if (age >= 60) {
    return "senior";
  }

  return "adult";
}

function resolveAvatarGender(gender?: string) {
  const normalized = String(gender ?? "").trim().toLowerCase();
  if (["male", "man", "m", "boy"].includes(normalized)) {
    return "male" as AvatarGender;
  }
  if (["female", "woman", "f", "girl"].includes(normalized)) {
    return "female" as AvatarGender;
  }
  return "other";
}

const avatarPalettes: Record<AvatarGender, Record<AgeBand, string[]>> = {
  male: {
    child: ["b6e3f4", "c0aede", "d1d4f9"],
    adult: ["9ecad6", "b6e3f4", "e0ddff"],
    senior: ["a8d8f0", "c3b8ff", "d9f2ff"],
  },
  female: {
    child: ["ffdfbf", "ffd5dc", "c0aede"],
    adult: ["ffd5dc", "e0ddff", "b6e3f4"],
    senior: ["f4d9ff", "ffd5dc", "d9f2ff"],
  },
  other: {
    child: ["c0aede", "b6e3f4", "d9f2ff"],
    adult: ["d1d4f9", "c0aede", "b6e3f4"],
    senior: ["e0ddff", "b6e3f4", "ffd5dc"],
  },
};

function patientAvatarCartoon(input: { seed: string; age?: number; gender?: string }) {
  const normalizedSeed = input.seed.trim().toLowerCase() || "patient";
  const ageBand = resolveAgeBand(input.age);
  const avatarGender = resolveAvatarGender(input.gender);
  const palette = avatarPalettes[avatarGender][ageBand];
  const offset = simpleHash(`${normalizedSeed}|${avatarGender}|${ageBand}`) % palette.length;
  const orderedPalette = [...palette.slice(offset), ...palette.slice(0, offset)].join(",");
  const seed = `${normalizedSeed}|${avatarGender}|${ageBand}|abstract`;

  const searchParams = new URLSearchParams({
    seed,
    backgroundType: "gradientLinear",
    backgroundColor: orderedPalette,
    radius: "50",
    scale: "95",
  });

  return `https://api.dicebear.com/9.x/shapes/svg?${searchParams.toString()}`;
}

export function PatientDashboard({ phone }: { phone: string }) {
  const router = useRouter();
  const [patientRecord, setPatientRecord] = useState<PatientRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [consultModal, setConsultModal] = useState<ConsultModal | null>(null);
  const [uploadedReports, setUploadedReports] = useState<UploadedReport[]>([]);
  const [carePlans, setCarePlans] = useState<PatientCarePlan[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function resolvePatientRecord() {
      const normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.length < 10) {
        if (!cancelled) {
          setPatientRecord(null);
          setProfileLoading(false);
        }
        return;
      }

      const localRecord = findPatientRecordByPhone(normalizedPhone);
      if (isPatientProfileComplete(localRecord)) {
        if (!cancelled) {
          setPatientRecord(localRecord);
          setProfileLoading(false);
        }
        return;
      }

      if (!cancelled && localRecord) {
        setPatientRecord(localRecord);
      }

      try {
        const response = await fetch(`/api/patient-register?phone=${encodeURIComponent(normalizedPhone)}`, { cache: "no-store" });
        const payload = (await response.json()) as { ok?: boolean; record?: PatientRecord | null };
        if (!cancelled) {
          setPatientRecord(response.ok && payload.ok ? (payload.record ?? null) : null);
        }
      } catch {
        if (!cancelled) {
          setPatientRecord(null);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    void resolvePatientRecord();

    return () => {
      cancelled = true;
    };
  }, [phone]);

  useEffect(() => {
    let active = true;

    async function loadUploadedReports() {
      const normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.length < 10) {
        if (active) {
          setUploadedReports([]);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/uploads/lab-reports?patientPhone=${encodeURIComponent(normalizedPhone)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; reports?: UploadedReport[] }
          | null;

        if (!active) {
          return;
        }

        if (!response.ok || !payload?.ok) {
          setUploadedReports([]);
          return;
        }

        setUploadedReports(payload.reports ?? []);
      } catch {
        if (active) {
          setUploadedReports([]);
        }
      }
    }

    void loadUploadedReports();

    return () => {
      active = false;
    };
  }, [phone]);

  useEffect(() => {
    let active = true;

    async function loadCarePlans() {
      const normalizedPhone = phone.replace(/\D/g, "");
      if (normalizedPhone.length < 10) {
        if (active) {
          setCarePlans([]);
        }
        return;
      }

      try {
        const response = await fetch(`/api/care-plan?patientPhone=${encodeURIComponent(normalizedPhone)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; records?: PatientCarePlan[] } | null;

        if (active) {
          setCarePlans(response.ok && payload?.ok ? payload.records ?? [] : []);
        }
      } catch {
        if (active) {
          setCarePlans([]);
        }
      }
    }

    void loadCarePlans();

    return () => {
      active = false;
    };
  }, [phone]);

  useEffect(() => {
    async function loadAppointments() {
      try {
        const res = await fetch(`/api/appointments?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; appointments?: AppointmentRecord[] };
        if (res.ok && data.ok) {
          setAppointments(data.appointments ?? []);
        }
      } catch {
        setAppointments([]);
      }
    }
    loadAppointments();
  }, [phone]);

  const pastAppointments = appointments.filter((a) => a.status === "submitted" || a.status === "cancelled");
  const upcomingAppointments = appointments.filter((a) => a.status !== "submitted" && a.status !== "cancelled");
  const completedEpisodes = appointments.filter((a) => a.status === "submitted").length;
  const canProceed = isPatientProfileComplete(patientRecord);
  const questionnaireSessionId = patientRecord?.patientId ? `self-${patientRecord.patientId}` : "";
  const questionnaireHref = canProceed
    ? `/patient/consult/${encodeURIComponent(questionnaireSessionId)}?phone=${encodeURIComponent(phone)}`
    : "/register";
  const patientAvatarUrl = useMemo(() => {
    const avatarSeed = `${patientRecord?.fullName ?? ""}|${patientRecord?.phone ?? phone}`;
    return patientAvatarCartoon({
      seed: avatarSeed,
      age: patientRecord?.age,
      gender: patientRecord?.gender,
    });
  }, [patientRecord?.age, patientRecord?.fullName, patientRecord?.gender, patientRecord?.phone, phone]);

  return (
    <div className="min-h-screen bg-gray-50">
      {consultModal && <ConsultConfirmModal modal={consultModal} onClose={() => setConsultModal(null)} />}

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Patient ID banner */}
        {profileLoading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 text-sm text-gray-500">Checking your profile…</div>
        ) : patientRecord ? (
          <div className="bg-blue-700 text-white rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-200 mb-1">Patient</p>
                <p className="text-2xl font-bold tracking-tight text-white">{patientRecord.fullName}</p>
                <p className="text-xs text-blue-100 mt-1">ID: {patientRecord.patientId}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/register")}
                  aria-label="Edit profile"
                  title="Edit profile"
                  className="h-10 w-10 rounded-lg border border-white/35 bg-white/10 text-white hover:bg-white/20 transition-colors grid place-items-center"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden border border-white/30">
                  <img src={patientAvatarUrl} alt="Patient avatar" className="h-full w-full object-cover" />
                </div>
              </div>
            </div>
            {patientRecord.bmi && (
              <div className="mt-3 flex gap-4 text-xs text-blue-200">
                {patientRecord.age && <span>Age: {patientRecord.age}</span>}
                {patientRecord.gender && <span className="capitalize">{patientRecord.gender}</span>}
                <span>BMI: {patientRecord.bmi.toFixed(1)}</span>
                {patientRecord.region && <span>{patientRecord.region}</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">No patient record found</p>
              <p className="text-xs text-amber-600 mt-0.5">Complete your registration to get a permanent patient ID.</p>
              <a href="/register" className="inline-block mt-2 text-xs font-semibold text-blue-700 underline">Register now →</a>
            </div>
          </div>
        )}

        <div className="mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Patient journey</h2>
          <p className="mt-1 text-xs text-gray-400">Discover & Access → Register & Onboard → Pre-Consultation → Consultation → Follow-up</p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">Discover & Access</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => router.push("/patient/book")}
                className="rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-semibold text-gray-800 transition-colors hover:border-blue-400 hover:bg-blue-50"
              >
                Book appointment
              </button>
              <button
                type="button"
                onClick={() => router.push("/patient")}
                className="rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-semibold text-gray-800 transition-colors hover:border-blue-400 hover:bg-blue-50"
              >
                My appointments
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">Register & Onboard</p>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="text-sm text-gray-700">Profile status</p>
              <span className={`text-xs font-semibold ${canProceed ? "text-green-700" : "text-amber-700"}`}>{canProceed ? "Complete" : "Pending"}</span>
            </div>
            {!canProceed ? (
              <button
                type="button"
                onClick={() => router.push("/register")}
                className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm font-semibold text-amber-800"
              >
                Complete profile to unlock pre-consultation
              </button>
            ) : null}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">Pre-Consultation</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => canProceed && router.push(questionnaireHref)}
                disabled={!canProceed}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${canProceed ? "border-gray-200 text-gray-800 hover:border-blue-400 hover:bg-blue-50" : "border-gray-100 text-gray-400 cursor-not-allowed opacity-70"}`}
              >
                Health questionnaire (PROMs)
              </button>
              <button
                onClick={() => canProceed && router.push("/patient/upload")}
                disabled={!canProceed}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${canProceed ? "border-gray-200 text-gray-800 hover:border-blue-400 hover:bg-blue-50" : "border-gray-100 text-gray-400 cursor-not-allowed opacity-70"}`}
              >
                Upload reports & documents
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">Consultation & Follow-up</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-gray-500">Upcoming consults</p>
                <p className="mt-0.5 text-lg font-semibold text-gray-800">{upcomingAppointments.length}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-gray-500">Completed episodes</p>
                <p className="mt-0.5 text-lg font-semibold text-gray-800">{completedEpisodes}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/patient/book")}
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-semibold text-gray-800 transition-colors hover:border-blue-400 hover:bg-blue-50"
            >
              Schedule follow-up appointment
            </button>
          </div>
        </div>

        {carePlans.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">My care plans</h2>
            <div className="space-y-3">
              {carePlans.map((carePlan) => (
                <div key={carePlan.consultSessionId}>
                  <p className="mb-1 text-xs text-gray-500">
                    {formatDoctorDisplayName(carePlan.doctorName)} · {carePlan.appointmentDate} at {carePlan.appointmentTime}
                  </p>
                  <CarePlanCard plan={carePlan.plan} updatedAt={carePlan.updatedAt} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {uploadedReports.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Uploaded documents ({uploadedReports.length})
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {uploadedReports.map((report) => (
                <div key={report.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{report.fileName}</p>
                    <p className="text-xs text-gray-400">
                      {report.fileType}
                      {typeof report.fileSizeBytes === "number" && report.fileSizeBytes > 0
                        ? ` · ${(report.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
                        : ""}
                      {report.uploadedAt
                        ? ` · ${new Date(report.uploadedAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  {report.storedPath ? (
                    <a
                      href={report.storedPath}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                    >
                      Open
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Past appointments */}
        {pastAppointments.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Recovery & outcomes</h2>
            <div className="space-y-2">
              {pastAppointments.map((appt, index) => (
                <div
                  key={`${appt.sessionId}-${appt.consultId ?? appt.sessionId}-${index}`}
                  className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-700">{formatDoctorDisplayName(appt.doctorName) || "Doctor"}</p>
                    <p className="text-xs text-gray-400">{appt.appointmentDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={appt.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
