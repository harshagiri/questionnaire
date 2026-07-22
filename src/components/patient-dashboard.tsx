"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { findPatientRecordByPhone, type PatientRecord, type AppointmentRecord } from "@/lib/portal-storage";
import { formatDoctorDisplayName } from "@/lib/doctor-display";

type ConsultModal = {
  consultId: string;
  appointmentId: string;
  doctorName: string;
  date: string;
  time: string;
  preConsultLink: string;
  videoConsultLink: string;
};

const statusColors: Record<string, string> = {
  booked: "bg-blue-50 text-blue-700 border-blue-200",
  waiting: "bg-yellow-50 text-yellow-700 border-yellow-200",
  submitted: "bg-green-50 text-green-700 border-green-200",
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
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
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

          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-teal-600 mb-1">Consult ID</p>
            <p className="text-xl font-mono font-bold text-teal-800">{modal.consultId}</p>
            <p className="text-xs text-teal-600 mt-1">{formatDoctorDisplayName(modal.doctorName)} · {modal.date} at {modal.time}</p>
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
                  className="flex-1 text-center bg-teal-600 text-white text-xs font-semibold py-2 px-3 rounded-lg hover:bg-teal-700 transition-colors"
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

export function PatientDashboard({ phone }: { phone: string }) {
  const router = useRouter();
  const [patientRecord, setPatientRecord] = useState<PatientRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [consultModal, setConsultModal] = useState<ConsultModal | null>(null);

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
      if (localRecord?.patientId) {
        if (!cancelled) {
          setPatientRecord(localRecord);
          setProfileLoading(false);
        }
        return;
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
    async function loadAppointments() {
      try {
        const res = await fetch(`/api/appointments?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; appointments?: AppointmentRecord[] };
        if (res.ok && data.ok) {
          setAppointments(data.appointments ?? []);
        }
      } catch {
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    }
    loadAppointments();
  }, [phone]);

  const upcomingAppointments = appointments.filter((a) => a.status !== "cancelled" && a.status !== "submitted");
  const pastAppointments = appointments.filter((a) => a.status === "submitted" || a.status === "cancelled");
  const canProceed = Boolean(patientRecord?.patientId);
  const questionnaireSessionId = patientRecord?.patientId ? `self-${patientRecord.patientId}` : "";
  const questionnaireHref = canProceed
    ? `/patient/${encodeURIComponent(questionnaireSessionId)}?phone=${encodeURIComponent(phone)}`
    : "/register";

  return (
    <div className="min-h-screen bg-gray-50">
      {consultModal && <ConsultConfirmModal modal={consultModal} onClose={() => setConsultModal(null)} />}

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Patient ID banner */}
        {profileLoading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 text-sm text-gray-500">Checking your profile…</div>
        ) : patientRecord ? (
          <div className="bg-teal-700 text-white rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-teal-200 mb-1">Patient ID</p>
                <p className="text-2xl font-mono font-bold tracking-wider">{patientRecord.patientId}</p>
                <p className="text-sm text-teal-100 mt-0.5">{patientRecord.fullName}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
            {patientRecord.bmi && (
              <div className="mt-3 flex gap-4 text-xs text-teal-200">
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
              <a href="/register" className="inline-block mt-2 text-xs font-semibold text-teal-700 underline">Register now →</a>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <button
            onClick={() => canProceed && router.push(questionnaireHref)}
            disabled={!canProceed}
            className={`bg-white border rounded-xl p-4 text-left transition-colors ${canProceed ? "border-gray-200 hover:border-teal-400 hover:bg-teal-50" : "border-gray-100 text-gray-400 cursor-not-allowed opacity-70"}`}
          >
            <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">Start questionnaire</p>
            <p className="text-xs text-gray-400 mt-0.5">Fill or continue your patient questionnaire without booking</p>
          </button>
          <button
            onClick={() => router.push("/register")}
            className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-gray-400 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">Update profile</p>
            <p className="text-xs text-gray-400 mt-0.5">Edit your registration details</p>
          </button>
          <button
            onClick={() => canProceed && router.push("/patient/upload")}
            disabled={!canProceed}
            className={`bg-white border rounded-xl p-4 text-left transition-colors ${canProceed ? "border-gray-200 hover:border-teal-400 hover:bg-teal-50" : "border-gray-100 text-gray-400 cursor-not-allowed opacity-70"}`}
          >
            <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 8l-3-3m3 3l3-3M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-800">Upload documents</p>
            <p className="text-xs text-gray-400 mt-0.5">Add MRI, X-ray, labs, and prescriptions anytime</p>
          </button>
        </div>

        {/* Upcoming appointments */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Upcoming</h2>
          {loading ? (
            <div className="text-sm text-gray-400 py-4">Loading…</div>
          ) : upcomingAppointments.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400">No upcoming appointments</p>
              {canProceed ? (
                <a
                  href={questionnaireHref}
                  className="mt-3 inline-flex rounded-full border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                >
                  Start questionnaire
                </a>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((appt, index) => {
                const consultId = appt.consultId ?? appt.sessionId;
                return (
                  <div key={`${appt.sessionId}-${consultId}-${index}`} className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{formatDoctorDisplayName(appt.doctorName) || "Doctor TBD"}</p>
                        <p className="text-xs text-gray-500">{appt.appointmentDate} at {appt.appointmentTime}</p>
                        {consultId && <p className="text-xs font-mono text-gray-400 mt-0.5">{consultId}</p>}
                      </div>
                      <StatusBadge status={appt.status} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={canProceed ? `/patient/consult/${consultId}` : "/register"}
                        className={`flex-1 text-center text-xs font-semibold py-2 px-3 rounded-lg transition-colors ${canProceed ? "bg-teal-600 text-white hover:bg-teal-700" : "bg-gray-100 text-gray-400"}`}
                      >
                        Fill pre-consult
                      </a>
                      <a
                        href={canProceed ? `/patient/upload/${consultId}` : "/register"}
                        className={`text-center border text-xs font-semibold py-2 px-3 rounded-lg transition-colors ${canProceed ? "border-gray-200 text-gray-600 hover:bg-gray-50" : "border-gray-100 text-gray-400"}`}
                      >
                        Upload reports
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Past appointments */}
        {pastAppointments.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Past</h2>
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
                    {appt.status === "submitted" ? (
                      <a
                        href={`/patient/consult/${appt.consultId ?? appt.sessionId}`}
                        className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                      >
                        View submitted form
                      </a>
                    ) : null}
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
