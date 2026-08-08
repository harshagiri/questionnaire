"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateConsultId, findPatientRecordByPhone, saveAppointment } from "@/lib/portal-storage";
import { formatDoctorDisplayName, formatDoctorOptionLabel } from "@/lib/doctor-display";
import { isPatientProfileComplete } from "@/lib/patient-profile-completion";

type DoctorSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  slotDurationMinutes: number;
};

type DoctorOption = {
  label: string;
  value: string;
  name: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  bio?: string;
  photoUrl?: string;
  slots: DoctorSlot[];
};

type BookingForm = {
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
};

type BookedResult = {
  consultId: string;
  appointmentId: string;
  doctorName: string;
  date: string;
  time: string;
  preConsultUrl: string;
  videoConsultUrl: string;
};

type ConsultMode = "clinic" | "video";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function resolveDoctorSpecialty(doctor: DoctorOption) {
  const rawBio = String(doctor.bio ?? "").trim();
  if (!rawBio) {
    return "Spine Specialist";
  }

  const firstSentence = rawBio.split(/[\n.]/).map((item) => item.trim()).find((item) => item.length > 0);
  if (!firstSentence) {
    return "Spine Specialist";
  }

  return firstSentence.length > 58 ? `${firstSentence.slice(0, 55)}...` : firstSentence;
}

function getDoctorExperienceYears(doctor: DoctorOption) {
  const seed = (doctor.value || doctor.name).length;
  return 12 + (seed % 18);
}

function getDoctorRating(doctor: DoctorOption) {
  const seed = (doctor.name || doctor.value).length;
  return 86 + (seed % 11);
}

function getDoctorFee(doctor: DoctorOption, mode: ConsultMode) {
  const seed = (doctor.registrationNumber || doctor.value || "").length;
  const base = 1400 + (seed % 6) * 250;
  return mode === "video" ? Math.max(900, base - 200) : base;
}

function getRelativeDateLabel(isoDate: string) {
  const target = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Tomorrow";
  }

  return `${DAY_SHORT_NAMES[target.getDay()]} ${target.getDate()}/${target.getMonth() + 1}`;
}

function formatReadableDate(isoDate: string) {
  if (!isoDate) {
    return "";
  }

  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getNextAvailableDates(slots: DoctorSlot[], maxDaysAhead = 45, maxResults = 10) {
  if (slots.length === 0) {
    return [] as Array<{ iso: string; label: string; dayName: string }>;
  }

  const slotDays = new Set(slots.map((slot) => slot.dayOfWeek));
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const dates: Array<{ iso: string; label: string; dayName: string }> = [];
  for (let offset = 0; offset <= maxDaysAhead && dates.length < maxResults; offset += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + offset);
    const weekday = current.getDay();
    if (!slotDays.has(weekday)) {
      continue;
    }

    const iso = current.toISOString().slice(0, 10);
    const dayName = DAY_SHORT_NAMES[weekday];
    const label = `${dayName} ${current.getDate()}/${current.getMonth() + 1}`;
    dates.push({ iso, label, dayName });
  }

  return dates;
}

function pseudoHashHex(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  const hex = Math.abs(hash).toString(16).padStart(32, "0");
  return hex.slice(0, 32);
}

function getDoctorAvatarUrl(doctor: DoctorOption) {
  const photo = String(doctor.photoUrl ?? "").trim();
  if (photo) {
    return photo;
  }

  const seed = String(doctor.email ?? doctor.name).trim().toLowerCase();
  const hash = pseudoHashHex(seed || "doctor");
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=256`;
}

function ConfirmationScreen({ result, onDone }: { result: BookedResult; onDone: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Appointment booked!</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {formatDoctorDisplayName(result.doctorName)} · {result.date} at {result.time}
          </p>
        </div>

        <div className="bg-blue-700 text-white rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-blue-200 mb-1">Your consult ID</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold tracking-widest">{result.consultId}</span>
            <button onClick={() => copy(result.consultId, "cid")} className="text-blue-200 text-xs hover:text-white">
              {copied === "cid" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex gap-2 items-start">
          <svg className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2v-3H6v3a2 2 0 002 2zm10-12V7a6 6 0 00-12 0v2H4l1 9h14l1-9h-2z" />
          </svg>
          <p className="text-xs text-amber-700">Pre-consult link and appointment details sent to your registered phone and email.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Step 1 — Fill your pre-consult questionnaire</p>
          <p className="text-xs font-mono text-gray-500 bg-gray-50 rounded-lg p-2 mb-3 break-all">{result.preConsultUrl}</p>
          <div className="flex gap-2">
            <a href={result.preConsultUrl} className="flex-1 text-center bg-blue-600 text-white text-sm font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              Fill now
            </a>
            <button onClick={() => copy(result.preConsultUrl, "pre")} className="px-3 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
              {copied === "pre" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Step 2 — Upload your lab reports / MRI films (optional)</p>
          <a href={`/patient/upload/${result.consultId}`} className="block w-full text-center border border-blue-600 text-blue-600 text-sm font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-50 transition-colors">
            Upload reports
          </a>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-gray-500 mb-1">Video consult link (active after pre-consult submitted)</p>
          <p className="text-xs font-mono text-gray-400 mb-2 break-all">{result.videoConsultUrl}</p>
          <button onClick={() => copy(result.videoConsultUrl, "video")} className="w-full border border-gray-200 text-xs text-gray-500 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
            {copied === "video" ? "Copied!" : "Copy video link"}
          </button>
        </div>

        <button onClick={onDone} className="w-full bg-gray-100 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors">
          Back to my appointments
        </button>
      </div>
    </div>
  );
}

export function PatientBookAppointment({
  phone,
  journeyMode = false,
}: {
  phone: string;
  journeyMode?: boolean;
}) {
  const router = useRouter();
  const [bookingStep, setBookingStep] = useState<"doctors" | "schedule" | "checkout">("doctors");
  const [consultMode, setConsultMode] = useState<ConsultMode>("clinic");
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [form, setForm] = useState<BookingForm>({
    doctorId: "",
    doctorName: "",
    appointmentDate: "",
    appointmentTime: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<BookedResult | null>(null);

  const patientRecord = findPatientRecordByPhone(phone);
  const selectedDoctor = useMemo(
    () => doctorOptions.find((doctor) => doctor.value === form.doctorId) ?? null,
    [doctorOptions, form.doctorId],
  );
  const selectedDateDay = form.appointmentDate ? new Date(form.appointmentDate).getDay() : null;
  const nextAvailableDates = useMemo(
    () => (selectedDoctor ? getNextAvailableDates(selectedDoctor.slots) : []),
    [selectedDoctor],
  );

  const filteredDoctors = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return doctorOptions;
    }

    return doctorOptions.filter((doctor) => {
      const specialty = resolveDoctorSpecialty(doctor).toLowerCase();
      const haystack = [doctor.name, doctor.registrationNumber, doctor.bio, specialty]
        .map((item) => String(item ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(query);
    });
  }, [doctorOptions, searchTerm]);

  const availableSlots = useMemo(() => {
    if (!selectedDoctor) {
      return [] as DoctorSlot[];
    }

    if (selectedDateDay === null || Number.isNaN(selectedDateDay)) {
      return selectedDoctor.slots;
    }

    return selectedDoctor.slots.filter((slot) => slot.dayOfWeek === selectedDateDay);
  }, [selectedDateDay, selectedDoctor]);

  useEffect(() => {
    async function loadDoctors() {
      try {
        const res = await fetch("/api/doctors?withSlots=true", { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          doctors?: Array<{
            id: string;
            name: string;
            phone?: string;
            email?: string;
            registrationNumber?: string;
            bio?: string;
            photoUrl?: string;
            slots?: DoctorSlot[];
          }>;
        };
        if (res.ok && data.ok) {
          setDoctorOptions(
            (data.doctors ?? []).map((d) => ({
              label: formatDoctorOptionLabel(d.name, d.registrationNumber),
              value: d.id,
              name: d.name,
              phone: d.phone,
              email: d.email,
              registrationNumber: d.registrationNumber,
              bio: d.bio,
              photoUrl: d.photoUrl,
              slots: d.slots ?? [],
            })),
          );
        }
      } catch {
        setDoctorOptions([]);
      }
    }
    void loadDoctors();
  }, []);

  function setField(key: keyof BookingForm, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "doctorId") {
        const opt = doctorOptions.find((d) => d.value === value);
        next.doctorName = opt?.name ?? "";
        next.appointmentDate = "";
        next.appointmentTime = "";
      }
      if (key === "appointmentDate") {
        next.appointmentTime = "";
      }
      return next;
    });
  }

  function handleSelectDoctor(doctorId: string) {
    const opt = doctorOptions.find((doctor) => doctor.value === doctorId) ?? null;
    const upcoming = opt ? getNextAvailableDates(opt.slots) : [];
    const earliestDate = upcoming[0]?.iso ?? "";

    setForm({
      doctorId,
      doctorName: opt?.name ?? "",
      appointmentDate: earliestDate,
      appointmentTime: "",
    });
    setBookingStep("schedule");
  }

  function handleBack() {
    if (bookingStep === "checkout") {
      setBookingStep("schedule");
      return;
    }

    if (bookingStep === "schedule") {
      setBookingStep("doctors");
      setForm((prev) => ({
        ...prev,
        appointmentDate: "",
        appointmentTime: "",
      }));
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/patient");
  }

  function canSubmit() {
    if (!form.doctorId || !form.appointmentDate || !form.appointmentTime) {
      return false;
    }

    return availableSlots.some((slot) => slot.startTime === form.appointmentTime);
  }

  async function handleBook() {
    setError("");
    setSubmitting(true);

    try {
      const patientName = patientRecord?.fullName ?? phone;
      if (!canSubmit()) {
        setError("Choose one of the doctor's available time slots.");
        return;
      }

      const consultId = generateConsultId();
      const origin = window.location.origin;
      const preConsultUrl = `${origin}/patient/consult/${consultId}`;
      const videoConsultUrl = `https://meet.spinexpert.ai/consult/${consultId}`;

      const body = {
        patientName,
        patientPhone: phone,
        doctorId: form.doctorId,
        appointmentDate: form.appointmentDate,
        appointmentTime: form.appointmentTime,
        appointmentType: "new",
        consultSessionId: consultId,
        consultId,
        videoConsultLink: videoConsultUrl,
        preConsultLink: preConsultUrl,
        status: "booked",
        notes: "",
      };

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json()) as { ok?: boolean; appointment?: { id?: string } };

      if (!res.ok || !payload.ok) {
        const now = new Date().toISOString();
        saveAppointment({
          sessionId: consultId,
          consultId,
          patientRecordId: patientRecord?.patientId,
          patientName,
          patientPhone: phone,
          doctorName: form.doctorName,
          doctorId: form.doctorId,
          appointmentDate: form.appointmentDate,
          appointmentTime: form.appointmentTime,
          appointmentType: "new",
          status: "booked",
          notes: "",
          videoConsultLink: videoConsultUrl,
          preConsultLink: preConsultUrl,
          createdAt: now,
          updatedAt: now,
        });
      }

      const bookedResult = {
        consultId,
        appointmentId: payload.appointment?.id ?? consultId,
        doctorName: form.doctorName,
        date: form.appointmentDate,
        time: form.appointmentTime,
        preConsultUrl,
        videoConsultUrl,
      };

      if (journeyMode) {
        const normalizedPhone = phone.replace(/\D/g, "");
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            `sei-patient-journey:${consultId}`,
            JSON.stringify({
              ...bookedResult,
              phone: normalizedPhone,
              bookedAt: new Date().toISOString(),
            }),
          );
        }

        let profileComplete = isPatientProfileComplete(patientRecord);
        if (!profileComplete) {
          try {
            const profileResponse = await fetch(`/api/patient-register?phone=${encodeURIComponent(normalizedPhone)}`, {
              cache: "no-store",
            });
            const profilePayload = (await profileResponse.json().catch(() => null)) as
              | {
                  ok?: boolean;
                  record?: {
                    patientId?: string;
                    fullName?: string;
                    age?: number;
                    gender?: string;
                    region?: string;
                    preferredLanguage?: string;
                    heightCm?: number;
                    weightKg?: number;
                  } | null;
                }
              | null;

            profileComplete = Boolean(
              profileResponse.ok && profilePayload?.ok && isPatientProfileComplete(profilePayload.record),
            );
          } catch {
            profileComplete = false;
          }
        }

        if (!profileComplete) {
          router.push(`/register?journey=1&consultId=${encodeURIComponent(consultId)}&phone=${encodeURIComponent(normalizedPhone)}`);
          return;
        }

        router.push(`/patient/otp?consultId=${encodeURIComponent(consultId)}&phone=${encodeURIComponent(normalizedPhone)}&journey=1`);
        return;
      }

      setBooked(bookedResult);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (booked) {
    return <ConfirmationScreen result={booked} onDone={() => router.push("/patient")} />;
  }

  return (
    <div className="w-full bg-[radial-gradient(circle_at_5%_10%,#eaf5ff_0%,#f7fafe_38%,#f8fafc_100%)]">
      <div className="mx-auto w-full max-w-3xl px-2 py-2 pb-24 sm:px-3 sm:py-3">
        <div className="mb-2.5 flex items-center justify-between rounded-xl bg-white/80 px-2.5 py-1.5 text-xs text-gray-600 ring-1 ring-[rgba(166,189,227,0.24)]">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 font-semibold text-blue-700 hover:bg-blue-50"
          >
            <span aria-hidden="true">←</span>
            <span>
              {bookingStep === "checkout" ? "Back to slots" : bookingStep === "schedule" ? "Back to doctors" : "Back"}
            </span>
          </button>
          <span className="font-medium text-gray-700">
            {bookingStep === "doctors" ? "Find doctor" : bookingStep === "schedule" ? "Choose slot" : "Review & pay"}
          </span>
        </div>

        <div className="rounded-2xl bg-white/92 p-2 shadow-[0_8px_18px_rgba(60,93,154,0.08)] backdrop-blur">
          {bookingStep === "doctors" ? (
            <>
              <div className="rounded-xl bg-white p-2 ring-1 ring-[rgba(139,169,212,0.25)]">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Orthopedist near you"
                  className="w-full rounded-xl bg-[rgba(243,246,255,0.95)] px-3 py-2 text-sm outline-none ring-1 ring-[rgba(141,171,216,0.2)] placeholder:text-gray-500 focus:ring-[rgba(59,130,246,0.55)]"
                />

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConsultMode("clinic")}
                    className={`w-full rounded-xl px-3 py-2 text-sm font-semibold ${consultMode === "clinic" ? "bg-blue-700 text-white" : "bg-[rgba(59,130,246,0.1)] text-blue-700"}`}
                  >
                    Physical Appointment
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultMode("video")}
                    className={`w-full rounded-xl px-3 py-2 text-sm font-semibold ${consultMode === "video" ? "bg-blue-700 text-white" : "bg-[rgba(59,130,246,0.1)] text-blue-700"}`}
                  >
                    Video Consult
                  </button>
                </div>
              </div>

              <div className="mt-2.5 grid gap-2.5">
                {filteredDoctors.map((doctor) => {
                  const selected = doctor.value === form.doctorId;
                  const firstDate = getNextAvailableDates(doctor.slots, 45, 1)[0];
                  const firstDaySlots = doctor.slots.filter((slot) => slot.dayOfWeek === (firstDate ? new Date(`${firstDate.iso}T00:00:00`).getDay() : -1));
                  const nextTime = firstDaySlots[0]?.startTime ?? doctor.slots[0]?.startTime ?? "TBA";
                  const experienceYears = getDoctorExperienceYears(doctor);
                  const rating = getDoctorRating(doctor);
                  const fee = getDoctorFee(doctor, consultMode);
                  const avatarUrl = getDoctorAvatarUrl(doctor);

                  return (
                    <div
                      key={doctor.value}
                      className={`overflow-hidden rounded-2xl bg-white p-3 shadow-[0_6px_16px_rgba(44,96,170,0.11)] ring-1 transition-all ${selected ? "ring-[rgba(59,130,246,0.45)]" : "ring-[rgba(160,180,213,0.25)]"}`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarUrl}
                          alt={formatDoctorDisplayName(doctor.name)}
                          className="h-14 w-14 rounded-xl object-cover shadow-sm ring-1 ring-white/70"
                        />

                        <div className="min-w-0">
                          <p className="truncate text-[17px] font-semibold leading-5 text-gray-900">{formatDoctorDisplayName(doctor.name)}</p>
                          <p className="truncate text-[13px] leading-4 text-blue-900/90">{resolveDoctorSpecialty(doctor)}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{experienceYears} years experience</p>
                          <p className="mt-0.5 text-xs font-semibold text-green-700">👍 {rating}% patient recommendation</p>
                        </div>
                      </div>

                      <div className="mt-2.5 rounded-xl bg-[rgba(244,247,255,0.9)] px-3 py-2">
                        <p className="text-sm font-semibold text-gray-800">SpinExpert Clinic</p>
                        <p className="text-xs text-gray-600">Bandra West • 0.6 km away</p>
                        <p className="mt-1 text-sm font-semibold text-gray-800">₹{fee} consultation fee</p>
                      </div>

                      <p className="mt-2 text-sm text-gray-700">Next available at {nextTime} {firstDate ? getRelativeDateLabel(firstDate.iso) : ""}</p>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <a
                          href={doctor.phone ? `tel:${doctor.phone}` : "#"}
                          className="flex h-12 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.12)] px-3 text-center text-base font-semibold text-blue-700"
                        >
                          Call Clinic
                        </a>
                        <button
                          type="button"
                          onClick={() => handleSelectDoctor(doctor.value)}
                          className="flex h-12 items-center justify-center rounded-xl bg-blue-700 px-3 text-center text-base font-semibold text-white"
                        >
                          {consultMode === "video" ? "Book Video" : "Book Visit"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredDoctors.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-gray-200 px-3 py-2.5 text-sm text-gray-500">
                  No doctors found for this search.
                </div>
              ) : null}
            </>
          ) : bookingStep === "schedule" ? (
            <div className="rounded-xl bg-white p-2.5 ring-1 ring-[rgba(166,189,227,0.3)]">
              <div className="flex gap-2.5 rounded-2xl bg-[rgba(228,242,255,0.8)] p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedDoctor ? getDoctorAvatarUrl(selectedDoctor) : ""}
                  alt={selectedDoctor ? formatDoctorDisplayName(selectedDoctor.name) : "Doctor"}
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-gray-900">
                    {formatDoctorDisplayName(selectedDoctor?.name ?? "Selected doctor")}
                  </p>
                  <p className="truncate text-[13px] text-gray-700">{resolveDoctorSpecialty(selectedDoctor as DoctorOption)}</p>
                  <p className="mt-0.5 text-[13px] text-gray-600">{selectedDoctor ? getDoctorExperienceYears(selectedDoctor) : 0} years experience</p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 rounded-xl bg-[rgba(59,130,246,0.12)] p-1">
                <button
                  type="button"
                  onClick={() => setConsultMode("clinic")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${consultMode === "clinic" ? "bg-white text-blue-700" : "text-blue-700"}`}
                >
                  Clinic Visit
                </button>
                <button
                  type="button"
                  onClick={() => setConsultMode("video")}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${consultMode === "video" ? "bg-white text-blue-700" : "text-blue-700"}`}
                >
                  Video Consult
                </button>
              </div>

              <div className="mt-2.5">
                <p className="mb-2 block text-sm font-medium text-gray-700">Available days</p>
                {nextAvailableDates.length > 0 ? (
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {nextAvailableDates.map((dateOption) => (
                      <button
                        key={dateOption.iso}
                        type="button"
                        onClick={() => setField("appointmentDate", dateOption.iso)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${form.appointmentDate === dateOption.iso ? "bg-blue-600 text-white" : "bg-white text-gray-700 ring-1 ring-[rgba(156,181,217,0.4)] hover:ring-[rgba(59,130,246,0.45)]"}`}
                      >
                        {getRelativeDateLabel(dateOption.iso)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                    No upcoming availability configured for this doctor.
                  </p>
                )}
              </div>

              <div className="mt-2.5">
                <label className="mb-2 block text-sm font-medium text-gray-700">Available slots</label>
                {form.appointmentDate ? (
                  availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setField("appointmentTime", slot.startTime)}
                          className={`rounded-lg px-2.5 py-2 text-center text-xs font-medium transition-colors ${form.appointmentTime === slot.startTime ? "bg-blue-600 text-white" : "bg-[rgba(59,130,246,0.12)] text-blue-700 ring-1 ring-[rgba(59,130,246,0.2)]"}`}
                        >
                          <span className="block text-sm font-semibold">{slot.startTime}</span>
                          <span className={`mt-0.5 block ${form.appointmentTime === slot.startTime ? "text-blue-50" : "text-blue-700/80"}`}>
                            {slot.slotDurationMinutes}m
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                      No slots are configured for {formatDoctorDisplayName(selectedDoctor?.name ?? "this doctor")} on {DAY_NAMES[selectedDateDay ?? 0]}.
                    </p>
                  )
                ) : (
                  <p className="rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-500">
                    Pick one of the upcoming dates to see slots.
                  </p>
                )}
              </div>

              <p className="mt-3 text-center text-sm font-semibold text-blue-700">View all slots</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-white p-3 ring-1 ring-[rgba(166,189,227,0.3)]">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedDoctor ? getDoctorAvatarUrl(selectedDoctor) : ""}
                    alt={selectedDoctor ? formatDoctorDisplayName(selectedDoctor.name) : "Doctor"}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                  <div>
                    <p className="text-[18px] font-semibold leading-6 text-gray-900">{formatDoctorDisplayName(selectedDoctor?.name ?? "Doctor")}</p>
                    <p className="text-[13px] leading-5 text-blue-900/85">{resolveDoctorSpecialty(selectedDoctor as DoctorOption)}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                    <p>{formatReadableDate(form.appointmentDate)} {form.appointmentTime}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                    <p>Speaks: English</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                    <p>Appointment confirmed instantly</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-[rgba(166,189,227,0.3)]">
                <p className="text-lg font-semibold text-gray-900">Savings</p>
                <button type="button" className="mt-2 flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-left">
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">Apply Coupon</span>
                    <span className="block text-xs text-gray-500">Unlock offers with coupon codes</span>
                  </span>
                  <span className="text-lg text-gray-400">›</span>
                </button>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-[rgba(166,189,227,0.3)]">
                <p className="text-lg font-semibold text-gray-900">Bill Details</p>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Consultation Fee</span>
                    <span className="font-semibold text-gray-900">₹{selectedDoctor ? getDoctorFee(selectedDoctor, consultMode) : 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Service Fee & Tax</span>
                    <span className="font-semibold text-gray-900">₹49</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-2 text-base">
                    <span className="font-semibold text-gray-900">Total Payable</span>
                    <span className="font-bold text-gray-900">
                      ₹{(selectedDoctor ? getDoctorFee(selectedDoctor, consultMode) : 0) + 49}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-3 ring-1 ring-[rgba(166,189,227,0.3)]">
                <p className="text-lg font-semibold text-gray-900">SpinExpert Assurance</p>
                <p className="mt-1 text-sm text-gray-700">Appointment confirmation happens instantly.</p>
                <p className="text-sm text-gray-700">If the consult cannot be completed, support will help with refund/rebooking.</p>
              </div>
            </div>
          )}
        </div>

        {error ? (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-white/92 backdrop-blur ring-1 ring-[rgba(166,189,227,0.45)]">
        <div className="mx-auto w-full max-w-3xl px-2 py-2.5 sm:px-3">
          {bookingStep === "doctors" ? (
            <button
              type="button"
              disabled
              className="w-full rounded-xl bg-gray-100 py-3.5 px-6 font-semibold text-gray-500"
            >
              Select a doctor to continue
            </button>
          ) : bookingStep === "schedule" ? (
            <button
              type="button"
              onClick={() => setBookingStep("checkout")}
              disabled={!canSubmit()}
              className="w-full rounded-xl bg-blue-700 py-3.5 px-6 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue to review
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="min-w-[110px] text-left">
                <p className="text-2xl font-bold text-gray-900">
                  ₹{(selectedDoctor ? getDoctorFee(selectedDoctor, consultMode) : 0) + 49}
                </p>
                <p className="text-xs text-gray-500">View bill</p>
              </div>
              <button
                onClick={handleBook}
                disabled={!canSubmit() || submitting}
                className="w-full rounded-xl bg-[linear-gradient(90deg,#2563eb,#1d4ed8)] py-3.5 px-6 font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Booking..." : consultMode === "video" ? "Pay & Confirm Video Consult" : "Pay & Confirm Clinic Visit"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
