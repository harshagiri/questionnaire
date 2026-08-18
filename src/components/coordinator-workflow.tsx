"use client";

import { useEffect, useMemo, useState } from "react";

type ReadinessRow = {
  appointmentId: string;
  consultSessionId: string;
  patientName: string;
  patientPhone: string;
  patientId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  appointmentStatus: string;
  doctorName: string;
  doctorPhone?: string;
  doctorEmail: string;
  doctorPhotoUrl: string;
  checks: {
    profileComplete: boolean;
    paymentComplete: boolean;
    questionnaireComplete: boolean;
  };
  payment: {
    status: "pending" | "paid" | "failed" | "waived";
    paidAt: string | null;
  };
  redFlag: boolean;
  overallComplete: boolean;
};

type ReadinessSummary = {
  total: number;
  complete: number;
  pending: number;
  redFlags: number;
};

type SummaryFilter = "all" | "complete" | "pending" | "redFlags";

function todayAsInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function formatReadableDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const weekday = date.toLocaleDateString("en-IN", { weekday: "short" });
  const day = date.toLocaleDateString("en-IN", { day: "2-digit" });
  const month = date.toLocaleDateString("en-IN", { month: "short" });
  const year = date.toLocaleDateString("en-IN", { year: "numeric" });
  return `${day} ${month} ${year} (${weekday})`;
}

function formatReadableTime(value: string) {
  const date = new Date(`1970-01-01T${value}`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function completionPercent(checks: ReadinessRow["checks"]) {
  const done = [checks.profileComplete, checks.paymentComplete, checks.questionnaireComplete].filter(Boolean).length;
  return Math.round((done / 3) * 100);
}

function ActionIcons({ phone }: { phone: string }) {
  const normalized = normalizePhone(phone);
  const whatsappTarget = normalized.startsWith("91") ? normalized : `91${normalized}`;

  return (
    <div className="flex items-center gap-1.5">
      <a
        href={`tel:${normalized}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-100 bg-blue-50/55 text-blue-700 hover:bg-blue-50"
        title="Call patient"
        aria-label="Call patient"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.65a16 16 0 0 0 6.35 6.35l1.21-1.23a2 2 0 0 1 2.11-.45c.84.29 1.71.5 2.61.62A2 2 0 0 1 22 16.92Z" />
        </svg>
      </a>
      <a
        href={`https://wa.me/${whatsappTarget}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50/60 text-emerald-600 hover:bg-emerald-50"
        title="WhatsApp patient"
        aria-label="WhatsApp patient"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M20.52 3.48A11.83 11.83 0 0 0 12.1.01C5.56.01.23 5.33.22 11.88c0 2.09.55 4.13 1.6 5.93L.12 24l6.36-1.66a11.86 11.86 0 0 0 5.62 1.44h.01c6.54 0 11.87-5.32 11.88-11.87a11.8 11.8 0 0 0-3.47-8.43Zm-8.42 18.3h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.78.99 1.01-3.68-.23-.38a9.78 9.78 0 0 1-1.51-5.24c0-5.4 4.4-9.8 9.8-9.8 2.62 0 5.09 1.02 6.94 2.87a9.74 9.74 0 0 1 2.87 6.94c0 5.4-4.4 9.8-9.79 9.8Zm5.37-7.35c-.29-.15-1.7-.84-1.96-.93-.26-.1-.45-.15-.65.14-.19.29-.74.93-.91 1.12-.16.19-.33.22-.62.07-.29-.15-1.22-.45-2.33-1.43-.86-.76-1.45-1.69-1.62-1.98-.17-.29-.02-.44.12-.58.13-.13.29-.33.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.15-.65-1.57-.89-2.15-.23-.55-.47-.48-.65-.49l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 1-1 2.45s1.03 2.85 1.17 3.04c.14.19 2.01 3.07 4.86 4.3.68.29 1.21.46 1.63.58.68.22 1.3.19 1.79.12.55-.08 1.7-.69 1.94-1.35.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33Z" />
        </svg>
      </a>
      <a
        href={`sms:${normalized}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-50"
        title="Text patient"
        aria-label="Text patient"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </a>
    </div>
  );
}

function DoctorActionIcons({ phone, email }: { phone?: string; email: string }) {
  const normalized = normalizePhone(phone ?? "");
  const hasPhone = normalized.length >= 10;
  const whatsappTarget = hasPhone ? (normalized.startsWith("91") ? normalized : `91${normalized}`) : "";

  return (
    <div className="flex items-center gap-1.5">
      {hasPhone ? (
        <a
          href={`tel:${normalized}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-blue-100 bg-blue-50/55 text-blue-700 hover:bg-blue-50"
          title="Call doctor"
          aria-label="Call doctor"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.65a16 16 0 0 0 6.35 6.35l1.21-1.23a2 2 0 0 1 2.11-.45c.84.29 1.71.5 2.61.62A2 2 0 0 1 22 16.92Z" />
          </svg>
        </a>
      ) : (
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300"
          title="Doctor phone unavailable"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.08 4.18 2 2 0 0 1 4.06 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.77.62 2.61a2 2 0 0 1-.45 2.11L8 9.65a16 16 0 0 0 6.35 6.35l1.21-1.23a2 2 0 0 1 2.11-.45c.84.29 1.71.5 2.61.62A2 2 0 0 1 22 16.92Z" />
          </svg>
        </span>
      )}
      {hasPhone ? (
        <a
          href={`https://wa.me/${whatsappTarget}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50/60 text-emerald-600 hover:bg-emerald-50"
          title="WhatsApp doctor"
          aria-label="WhatsApp doctor"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M20.52 3.48A11.83 11.83 0 0 0 12.1.01C5.56.01.23 5.33.22 11.88c0 2.09.55 4.13 1.6 5.93L.12 24l6.36-1.66a11.86 11.86 0 0 0 5.62 1.44h.01c6.54 0 11.87-5.32 11.88-11.87a11.8 11.8 0 0 0-3.47-8.43Zm-8.42 18.3h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.78.99 1.01-3.68-.23-.38a9.78 9.78 0 0 1-1.51-5.24c0-5.4 4.4-9.8 9.8-9.8 2.62 0 5.09 1.02 6.94 2.87a9.74 9.74 0 0 1 2.87 6.94c0 5.4-4.4 9.8-9.79 9.8Zm5.37-7.35c-.29-.15-1.7-.84-1.96-.93-.26-.1-.45-.15-.65.14-.19.29-.74.93-.91 1.12-.16.19-.33.22-.62.07-.29-.15-1.22-.45-2.33-1.43-.86-.76-1.45-1.69-1.62-1.98-.17-.29-.02-.44.12-.58.13-.13.29-.33.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.15-.65-1.57-.89-2.15-.23-.55-.47-.48-.65-.49l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 1-1 2.45s1.03 2.85 1.17 3.04c.14.19 2.01 3.07 4.86 4.3.68.29 1.21.46 1.63.58.68.22 1.3.19 1.79.12.55-.08 1.7-.69 1.94-1.35.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33Z" />
          </svg>
        </a>
      ) : (
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-slate-300"
          title="Doctor phone unavailable"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M20.52 3.48A11.83 11.83 0 0 0 12.1.01C5.56.01.23 5.33.22 11.88c0 2.09.55 4.13 1.6 5.93L.12 24l6.36-1.66a11.86 11.86 0 0 0 5.62 1.44h.01c6.54 0 11.87-5.32 11.88-11.87a11.8 11.8 0 0 0-3.47-8.43Zm-8.42 18.3h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.78.99 1.01-3.68-.23-.38a9.78 9.78 0 0 1-1.51-5.24c0-5.4 4.4-9.8 9.8-9.8 2.62 0 5.09 1.02 6.94 2.87a9.74 9.74 0 0 1 2.87 6.94c0 5.4-4.4 9.8-9.79 9.8Zm5.37-7.35c-.29-.15-1.7-.84-1.96-.93-.26-.1-.45-.15-.65.14-.19.29-.74.93-.91 1.12-.16.19-.33.22-.62.07-.29-.15-1.22-.45-2.33-1.43-.86-.76-1.45-1.69-1.62-1.98-.17-.29-.02-.44.12-.58.13-.13.29-.33.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.15-.65-1.57-.89-2.15-.23-.55-.47-.48-.65-.49l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 1-1 2.45s1.03 2.85 1.17 3.04c.14.19 2.01 3.07 4.86 4.3.68.29 1.21.46 1.63.58.68.22 1.3.19 1.79.12.55-.08 1.7-.69 1.94-1.35.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33Z" />
          </svg>
        </span>
      )}
      <a
        href={`mailto:${encodeURIComponent(email)}`}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50/60 text-indigo-600 hover:bg-indigo-50"
        title="Message doctor"
        aria-label="Message doctor"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </a>
    </div>
  );
}

export function CoordinatorWorkflow() {
  const [selectedDate, setSelectedDate] = useState(todayAsInputDate());
  const [searchQuery, setSearchQuery] = useState("");
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<ReadinessRow[]>([]);

  useEffect(() => {
    let active = true;

    async function loadReadiness() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch(`/api/coordinator/readiness?date=${encodeURIComponent(selectedDate)}`, {
          cache: "no-store",
        });

        const payload = (await response.json()) as {
          ok?: boolean;
          message?: string;
          rows?: ReadinessRow[];
          summary?: ReadinessSummary;
        };

        if (!active) {
          return;
        }

        if (!response.ok || !payload.ok) {
          setRows([]);
          setMessage(payload.message ?? "Could not load coordinator dashboard.");
          return;
        }

        setRows(payload.rows ?? []);
      } catch {
        if (!active) {
          return;
        }
        setRows([]);
        setMessage("Network error while loading readiness.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadReadiness();

    return () => {
      active = false;
    };
  }, [selectedDate]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => `${a.appointmentDate}T${a.appointmentTime}`.localeCompare(`${b.appointmentDate}T${b.appointmentTime}`)),
    [rows],
  );

  const searchFilteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return sortedRows;
    }

    return sortedRows.filter((row) => {
      const haystack = [
        row.patientName,
        row.patientPhone,
        row.patientId,
        row.doctorName,
        row.doctorEmail,
        row.appointmentType,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [searchQuery, sortedRows]);

  const filteredRows = useMemo(() => {
    if (summaryFilter === "all") {
      return searchFilteredRows;
    }

    if (summaryFilter === "complete") {
      return searchFilteredRows.filter((item) => item.overallComplete);
    }

    if (summaryFilter === "pending") {
      return searchFilteredRows.filter((item) => !item.overallComplete);
    }

    return searchFilteredRows.filter((item) => item.redFlag);
  }, [searchFilteredRows, summaryFilter]);

  const summary: ReadinessSummary = useMemo(() => {
    const complete = searchFilteredRows.filter((item) => item.overallComplete).length;
    const pending = searchFilteredRows.length - complete;
    const redFlags = searchFilteredRows.filter((item) => item.redFlag).length;
    return { total: searchFilteredRows.length, complete, pending, redFlags };
  }, [searchFilteredRows]);

  return (
    <section className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 -mt-6 border-b border-[rgba(21,32,43,0.08)] bg-[rgba(240,248,255,0.94)] px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:-mt-10 lg:px-8">
        <div className="border border-[rgba(21,32,43,0.08)] bg-white p-2 shadow-sm sm:p-2.5">
        <div className="mb-1.5">
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => setSummaryFilter("all")}
              className={
                "h-11 min-w-0 rounded-lg border px-1.5 py-1 text-left transition " +
                (summaryFilter === "all"
                  ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100"
                  : "border-[rgba(21,32,43,0.08)] bg-white")
              }
            >
              <span className="flex h-full flex-col justify-start gap-0">
                <p className="text-[8px] uppercase tracking-wide text-[color:var(--muted)]">Total</p>
                <p className="text-lg font-semibold leading-none sm:text-xl">{summary.total}</p>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSummaryFilter((current) => (current === "complete" ? "all" : "complete"))}
              className={
                "h-11 min-w-0 rounded-lg border px-1.5 py-1 text-left transition " +
                (summaryFilter === "complete"
                  ? "border-emerald-300 bg-emerald-100 ring-2 ring-emerald-100"
                  : "border-emerald-100 bg-emerald-50")
              }
            >
              <span className="flex h-full flex-col justify-start gap-0">
                <p className="text-[8px] uppercase tracking-wide text-emerald-700">Complete</p>
                <p className="text-lg font-semibold leading-none text-emerald-700 sm:text-xl">{summary.complete}</p>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSummaryFilter((current) => (current === "pending" ? "all" : "pending"))}
              className={
                "h-11 min-w-0 rounded-lg border px-1.5 py-1 text-left transition " +
                (summaryFilter === "pending"
                  ? "border-amber-300 bg-amber-100 ring-2 ring-amber-100"
                  : "border-amber-100 bg-amber-50")
              }
            >
              <span className="flex h-full flex-col justify-start gap-0">
                <p className="text-[8px] uppercase tracking-wide text-amber-700">Pending</p>
                <p className="text-lg font-semibold leading-none text-amber-700 sm:text-xl">{summary.pending}</p>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSummaryFilter((current) => (current === "redFlags" ? "all" : "redFlags"))}
              className={
                "h-11 min-w-0 rounded-lg border px-1.5 py-1 text-left transition " +
                (summaryFilter === "redFlags"
                  ? "border-rose-300 bg-rose-100 ring-2 ring-rose-100"
                  : "border-rose-100 bg-rose-50")
              }
            >
              <span className="flex h-full flex-col justify-start gap-0">
                <p className="text-[8px] uppercase tracking-wide text-rose-700">Red flags</p>
                <p className="text-lg font-semibold leading-none text-rose-700 sm:text-xl">{summary.redFlags}</p>
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-1.5">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search patient, phone, doctor"
            className="focus-ring min-w-0 flex-1 rounded-lg border border-[rgba(21,32,43,0.12)] px-2.5 py-1.5 text-xs sm:text-sm"
          />
          <div className="relative shrink-0">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <input
              id="readiness-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="focus-ring h-8 w-[8rem] rounded-lg border border-[rgba(21,32,43,0.12)] py-1 pl-8 pr-2 text-xs sm:h-9 sm:w-[8.75rem] sm:text-sm"
              aria-label="Appointment date"
            />
          </div>
        </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[rgba(21,32,43,0.08)] bg-white p-6 text-sm text-[color:var(--muted)] shadow-sm">
          Loading readiness board...
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(21,32,43,0.08)] bg-white p-6 text-sm text-[color:var(--muted)] shadow-sm">
          No appointments match your search for this date.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => {
            const profilePercent = completionPercent(row.checks);
            return (
              <article
                key={row.appointmentId}
                className={
                  "rounded-[1.5rem] border bg-[linear-gradient(180deg,#f3f8ff_0%,#eef5ff_100%)] p-2 shadow-[0_8px_20px_rgba(60,100,170,0.1)] sm:p-2.5 " +
                  (row.redFlag ? "border-rose-200" : "border-[#c8ddfb]")
                }
              >
                <div className="space-y-2.5">
                  <section className="rounded-[1.1rem] border border-[#d7e4f6] bg-white/92 px-2.5 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dbe8fb] text-base font-semibold text-[#2a63d8]">
                          {row.patientName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[1.2rem] font-semibold leading-[1.1] text-slate-900 sm:text-[1.3rem]">{row.patientName}</p>
                          <p className="text-[11px] text-slate-700">{row.patientPhone}</p>
                          <p className="text-[11px] text-slate-500">{row.patientId ? `ID: ${row.patientId}` : "ID pending"}</p>
                        </div>
                      </div>
                      <ActionIcons phone={row.patientPhone} />
                    </div>
                  </section>

                  <section className="rounded-[1.1rem] border border-[#cfe1ff] bg-[#eef5ff] px-2.5 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#d8e9ff] text-blue-700">
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </span>
                        <p className="text-[0.95rem] font-semibold leading-[1.1] text-[#1f5ed5] sm:text-[1.05rem]">Upcoming Consultation</p>
                      </div>
                      <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#9fc1ff] bg-white px-1.5 py-1 text-xs font-semibold text-[#1f5ed5] sm:px-2">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                          <line x1="12" y1="14" x2="12" y2="19" />
                          <line x1="9.5" y1="16.5" x2="14.5" y2="16.5" />
                        </svg>
                        <span className="hidden sm:inline">Reschedule</span>
                      </button>
                    </div>
                    <div className="mt-2 grid gap-1.5 text-[13px] text-slate-700 sm:text-[14px]">
                      <div className="inline-flex flex-wrap items-center gap-1.5 rounded-md bg-white/45 px-2 py-1 text-[13px] sm:text-[14px]">
                        <span><span className="font-semibold">Date:</span> {formatReadableDate(row.appointmentDate)}</span>
                        <span className="h-3.5 w-px bg-[rgba(37,99,235,0.22)]" aria-hidden="true" />
                        <span><span className="font-semibold">Time:</span> {formatReadableTime(row.appointmentTime)}</span>
                      </div>
                    </div>

                    <div className="mt-2 border-t border-[rgba(37,99,235,0.14)] pt-2">
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          {row.doctorPhotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.doctorPhotoUrl} alt={row.doctorName} className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                              {row.doctorName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Doctor</p>
                            <p className="truncate text-[0.95rem] font-semibold leading-[1.1] text-slate-900">{row.doctorName}</p>
                          </div>
                        </div>
                        <DoctorActionIcons phone={row.doctorPhone} email={row.doctorEmail} />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[1.1rem] border border-[#d7e4f6] bg-white/92 px-2.5 py-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[1.2rem] font-semibold leading-[1.1] text-slate-900">Profile Completion</p>
                      <span className="rounded-lg border border-[#9fc1ff] bg-[#e9f1ff] px-2 py-0.5 text-[11px] font-semibold text-[#1f5ed5]">
                        {profilePercent}% Completed
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#e7edf7]">
                      <div className="h-full rounded-full bg-[#2f6fd1]" style={{ width: `${profilePercent}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-600">Complete pending checks to move this consultation to ready.</p>
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      <span className={"inline-flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1.5 py-1 text-center text-[9px] font-semibold " + (row.checks.profileComplete ? "border-emerald-200 bg-emerald-50/55 text-emerald-700" : "border-amber-200 bg-amber-50/55 text-amber-700")}>
                        <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-current">
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                        <span className="leading-tight"><span className="block">Profile</span><span className="block">{row.checks.profileComplete ? "Done" : "Pending"}</span></span>
                      </span>
                      <span className={"inline-flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1.5 py-1 text-center text-[9px] font-semibold " + (row.checks.paymentComplete ? "border-emerald-200 bg-emerald-50/55 text-emerald-700" : "border-amber-200 bg-amber-50/55 text-amber-700")}>
                        <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-current">
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                            <path d="M12 6v6l4 2" />
                            <circle cx="12" cy="12" r="9" />
                          </svg>
                        </span>
                        <span className="leading-tight"><span className="block">Payment</span><span className="block">{row.checks.paymentComplete ? "Done" : "Pending"}</span></span>
                      </span>
                      <span className={"inline-flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1.5 py-1 text-center text-[9px] font-semibold " + (row.checks.questionnaireComplete ? "border-emerald-200 bg-emerald-50/55 text-emerald-700" : "border-blue-200 bg-blue-50/55 text-blue-700")}>
                        <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-current">
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                            <path d="M12 6v6l4 2" />
                            <circle cx="12" cy="12" r="9" />
                          </svg>
                        </span>
                        <span className="leading-tight"><span className="block">Questionnaire</span><span className="block">{row.checks.questionnaireComplete ? "Done" : "Pending"}</span></span>
                      </span>
                      <span className={"inline-flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1.5 py-1 text-center text-[9px] font-semibold " + (row.redFlag ? "border-rose-200 bg-rose-50/55 text-rose-700" : "border-emerald-200 bg-emerald-50/55 text-emerald-700")}>
                        <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-current">
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                            <path d="M12 8v5" />
                            <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
                            <circle cx="12" cy="12" r="9" />
                          </svg>
                        </span>
                        <span className="leading-tight"><span className="block">Red Flags</span><span className="block">{row.redFlag ? "Review" : "Clear"}</span></span>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="mt-2 flex w-full items-center justify-center rounded-lg border border-[#7aa9ff] bg-white px-3 py-2 text-[11px] font-semibold text-[#1f5ed5]"
                    >
                      <span>Complete Pending Steps</span>
                      <span className="ml-auto inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.6">
                          <path d="m9 6 6 6-6 6" />
                        </svg>
                      </span>
                    </button>
                  </section>

                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
