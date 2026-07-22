"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import type { PromDisplaySummary } from "@/lib/prom-scoring";
import { formatDoctorDisplayName } from "@/lib/doctor-display";

type QueueAppointment = {
  id: string;
  consultSessionId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  status: string;
  notes: string;
  promSummary?: PromDisplaySummary;
  createdAt: string;
  updatedAt: string;
};

type AccessCodePreview = {
  code: string;
  expiresAt: string;
  minutesRemaining: number;
};

type MagicLinkStatusEntry = {
  phone: string;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "sent" | "failed" | "skipped" | "used" | "revoked" | "expired";
  note?: string;
};

const queueStatusOptions = [
  { label: "Booked", value: "booked" },
  { label: "Waiting", value: "waiting" },
  { label: "Submitted", value: "submitted" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Follow-up", value: "follow_up" },
] as const;

function formatPromSummary(summary?: PromDisplaySummary) {
  if (!summary) {
    return "PROM: Not scored";
  }

  return `PROM: ${summary.instrument} ${summary.percent.toFixed(1)}% (${summary.severity})`;
}

export function ReceptionistWorkflow() {
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [savedQueue, setSavedQueue] = useState<QueueAppointment[]>([]);
  const [saveMessage, setSaveMessage] = useState("");

  const [accessCodesByPhone, setAccessCodesByPhone] = useState<Record<string, AccessCodePreview>>({});
  const [accessCodeLoading, setAccessCodeLoading] = useState<Record<string, boolean>>({});
  const [accessCodeMessageByPhone, setAccessCodeMessageByPhone] = useState<Record<string, string>>({});

  const [selectedQueueCardId, setSelectedQueueCardId] = useState<string | null>(null);

  const [magicLinkPhone, setMagicLinkPhone] = useState("");
  const [magicLinkMessage, setMagicLinkMessage] = useState("");
  const [magicLinkSending, setMagicLinkSending] = useState(false);
  const [magicLinkPreviewUrl, setMagicLinkPreviewUrl] = useState("");
  const [magicLinkEntries, setMagicLinkEntries] = useState<MagicLinkStatusEntry[]>([]);

  const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
  const isValidIndianMobile = (phone: string) => {
    const digits = normalizePhone(phone);
    return /^[6-9]\d{9}$/.test(digits) || /^91[6-9]\d{9}$/.test(digits);
  };

  useEffect(() => {
    let active = true;

    async function loadAppointments() {
      try {
        const response = await fetch("/api/appointments", { cache: "no-store" });
        const payload = (await response.json()) as {
          ok: boolean;
          appointments?: QueueAppointment[];
        };

        if (!active || !response.ok || !payload.ok) return;
        setSavedQueue(payload.appointments ?? []);
      } catch {
        if (active) setSavedQueue([]);
      } finally {
        if (active) setIsLoadingQueue(false);
      }
    }

    void loadAppointments();
    return () => {
      active = false;
    };
  }, []);

  const loadAccessCode = useCallback(async (phone: string, rotate = false) => {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return;
    }

    setAccessCodeLoading((current) => ({ ...current, [normalizedPhone]: true }));
    setAccessCodeMessageByPhone((current) => ({ ...current, [normalizedPhone]: "" }));

    try {
      const response = await fetch(
        rotate ? "/api/patient-access-code" : `/api/patient-access-code?phone=${encodeURIComponent(normalizedPhone)}`,
        rotate
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: normalizedPhone, rotate: true }),
            }
          : { cache: "no-store" },
      );

      const payload = (await response.json()) as {
        ok?: boolean;
        code?: string;
        expiresAt?: string;
        minutesRemaining?: number;
        message?: string;
      };

      if (!response.ok || !payload.ok || !payload.code || !payload.expiresAt) {
        setAccessCodeMessageByPhone((current) => ({
          ...current,
          [normalizedPhone]: payload.message ?? "Could not load access code.",
        }));
        return;
      }

      setAccessCodesByPhone((current) => ({
        ...current,
        [normalizedPhone]: {
          code: payload.code as string,
          expiresAt: payload.expiresAt as string,
          minutesRemaining: Number(payload.minutesRemaining ?? 0),
        },
      }));
      setAccessCodeMessageByPhone((current) => ({
        ...current,
        [normalizedPhone]: rotate ? "Access code rotated." : "Access code ready.",
      }));
    } catch {
      setAccessCodeMessageByPhone((current) => ({
        ...current,
        [normalizedPhone]: "Network error while loading access code.",
      }));
    } finally {
      setAccessCodeLoading((current) => ({ ...current, [normalizedPhone]: false }));
    }
  }, []);

  const loadMagicLinkEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/patient-magic-link", { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        entries?: MagicLinkStatusEntry[];
      };

      if (!response.ok || !payload.ok) {
        return;
      }

      setMagicLinkEntries(payload.entries ?? []);
    } catch {
      // Do not block the dashboard if status list fetch fails.
    }
  }, []);

  useEffect(() => {
    const phones = Array.from(
      new Set(savedQueue.map((item) => item.patientPhone.replace(/\D/g, "")).filter((value) => value.length > 0)),
    );

    phones.forEach((phone) => {
      if (accessCodesByPhone[phone] || accessCodeLoading[phone]) {
        return;
      }

      void loadAccessCode(phone, false);
    });
  }, [savedQueue, accessCodesByPhone, accessCodeLoading, loadAccessCode]);

  const updateQueueStatus = async (id: string, status: string) => {
    try {
      const response = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      const payload = (await response.json()) as { ok: boolean; appointment?: QueueAppointment; message?: string };
      if (!response.ok || !payload.ok || !payload.appointment) {
        setSaveMessage(payload.message ?? "Could not update status.");
        return;
      }

      setSavedQueue((c) => c.map((item) => (item.id === id ? (payload.appointment as QueueAppointment) : item)));
    } catch {
      setSaveMessage("Network error.");
    }
  };

  const selectedQueueItem = selectedQueueCardId
    ? savedQueue.find((item) => item.id === selectedQueueCardId) ?? null
    : null;
  const selectedPhone = selectedQueueItem ? normalizePhone(selectedQueueItem.patientPhone) : "";
  const selectedAccessCode = selectedPhone ? accessCodesByPhone[selectedPhone] : undefined;
  const selectedAccessCodeLoading = selectedPhone ? accessCodeLoading[selectedPhone] : false;
  const selectedAccessCodeMessage = selectedPhone ? accessCodeMessageByPhone[selectedPhone] : "";

  const handleQueueCardSelection = (event: MouseEvent<HTMLDivElement>, id: string) => {
    const target = event.target as HTMLElement;
    if (target.closest("button,select,a,input,textarea,label")) {
      return;
    }

    setSelectedQueueCardId(id);
  };

  const generateMagicLink = async () => {
    const normalizedPhone = normalizePhone(magicLinkPhone);
    setMagicLinkMessage("");
    setMagicLinkPreviewUrl("");

    if (!isValidIndianMobile(magicLinkPhone)) {
      setMagicLinkMessage("Enter a valid Indian mobile number.");
      return;
    }

    setMagicLinkSending(true);
    try {
      const skipSms = typeof window !== "undefined" && window.location.hostname === "localhost";
      const response = await fetch("/api/patient-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, skipSms }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        expiresAt?: string;
        message?: string;
        sent?: boolean;
        magicLink?: string;
      };

      if (!response.ok || !payload.ok || !payload.expiresAt) {
        setMagicLinkMessage(payload.message ?? "Could not generate magic link.");
        return;
      }

      const expiresLocal = new Date(payload.expiresAt).toLocaleString();
      if (payload.sent === false && payload.magicLink) {
        setMagicLinkMessage(`SMS unavailable in local test. Use this direct link. Valid until ${expiresLocal}.`);
        setMagicLinkPreviewUrl(payload.magicLink);
      } else {
        setMagicLinkMessage(`Magic link sent by SMS. Valid until ${expiresLocal}.`);
      }

      setMagicLinkEntries((current) => [
        {
          phone: normalizedPhone,
          createdAt: new Date().toISOString(),
          expiresAt: payload.expiresAt,
          status: payload.sent ? "sent" : "skipped",
          note: payload.sent ? undefined : payload.message,
        },
        ...current,
      ]);
    } catch {
      setMagicLinkMessage("Network error while generating magic link.");
    } finally {
      setMagicLinkSending(false);
      void loadMagicLinkEntries();
    }
  };

  const magicStatusClass: Record<MagicLinkStatusEntry["status"], string> = {
    pending: "bg-slate-100 text-slate-700",
    sent: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
    skipped: "bg-amber-100 text-amber-700",
    used: "bg-indigo-100 text-indigo-700",
    revoked: "bg-zinc-100 text-zinc-700",
    expired: "bg-zinc-100 text-zinc-700",
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
        <h2 className="headline text-3xl font-semibold">Patient magic link</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Generate a unique 24-hour patient login link. Patient can open the link and directly continue with pre-consult workflow.
        </p>

        <div className="mt-4 grid gap-3 sm:max-w-lg">
          <label>
            <span className="text-sm font-semibold">Patient phone</span>
            <input
              type="tel"
              value={magicLinkPhone}
              onChange={(event) => setMagicLinkPhone(event.target.value)}
              placeholder="Enter Indian mobile number"
              className="mt-2 w-full rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none"
            />
          </label>

          <button
            type="button"
            onClick={generateMagicLink}
            disabled={magicLinkSending}
            className="focus-ring w-fit rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {magicLinkSending ? "Generating..." : "Generate magic link"}
          </button>
        </div>

        {magicLinkMessage ? <p className="mt-3 text-sm font-medium text-[color:#2f6f57]">{magicLinkMessage}</p> : null}
        {magicLinkPreviewUrl ? (
          <a
            href={magicLinkPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block break-all text-xs font-medium text-[var(--accent)] underline"
          >
            {magicLinkPreviewUrl}
          </a>
        ) : null}

        <div className="mt-5 rounded-2xl border border-[rgba(21,32,43,0.08)] bg-[rgba(21,32,43,0.02)] p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Recent magic links</p>
            <button
              type="button"
              onClick={() => void loadMagicLinkEntries()}
              className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1 text-xs font-semibold"
            >
              Refresh
            </button>
          </div>
          {magicLinkEntries.length === 0 ? (
            <p className="text-xs text-[color:var(--muted)]">No links generated yet.</p>
          ) : (
            <div className="space-y-2">
              {magicLinkEntries.slice(0, 10).map((entry, index) => (
                <div key={`${entry.phone}-${entry.createdAt}-${index}`} className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{entry.phone}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${magicStatusClass[entry.status]}`}>
                      {entry.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-[color:var(--muted)]">
                    Created {new Date(entry.createdAt).toLocaleString()} • Expires {new Date(entry.expiresAt).toLocaleString()}
                  </div>
                  {entry.note ? <div className="mt-1 text-[11px] text-rose-600">{entry.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-6 shadow-sm">
        <h2 className="headline text-3xl font-semibold">Today&apos;s queue</h2>
        <div className="mt-4 space-y-3">
          {savedQueue.length ? (
            savedQueue.map((item) => (
              <div
                key={item.id}
                className="cursor-pointer rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3 sm:cursor-default"
                onClick={(event) => handleQueueCardSelection(event, item.id)}
              >
                {(() => {
                  const normalizedPhone = normalizePhone(item.patientPhone);
                  const accessCode = accessCodesByPhone[normalizedPhone];
                  const isLoadingCode = accessCodeLoading[normalizedPhone];
                  const codeMessage = accessCodeMessageByPhone[normalizedPhone];

                  return (
                    <>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-semibold">{item.patientName} · {item.patientPhone}</span>
                        <div className="rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1 text-[11px] font-semibold text-[color:var(--muted)] sm:hidden">
                          Tap for actions
                        </div>
                        <div className="hidden items-center gap-2 sm:flex">
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `/print/consult/${encodeURIComponent(item.consultSessionId)}`,
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                            className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)]"
                          >
                            Print
                          </button>
                          <select
                            value={item.status}
                            onChange={(e) => updateQueueStatus(item.id, e.target.value)}
                            className="rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-3 py-1 text-xs font-semibold outline-none"
                          >
                            {queueStatusOptions.map((statusOption) => (
                              <option key={statusOption.value} value={statusOption.value}>
                                {statusOption.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">
                        {formatDoctorDisplayName(item.doctorName)} · {`${item.appointmentDate || "today"} ${item.appointmentTime || ""}`.trim()}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-[color:var(--accent)]">{formatPromSummary(item.promSummary)}</div>
                      <div className="mt-2 hidden rounded-xl border border-[rgba(21,32,43,0.1)] bg-white px-3 py-2 sm:block">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs text-[color:var(--muted)]">Patient access code</div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => loadAccessCode(item.patientPhone, false)}
                              disabled={Boolean(isLoadingCode)}
                              className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                            >
                              {isLoadingCode ? "Loading..." : accessCode ? "Refresh" : "Reveal"}
                            </button>
                            <button
                              type="button"
                              onClick={() => loadAccessCode(item.patientPhone, true)}
                              disabled={Boolean(isLoadingCode)}
                              className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                            >
                              Regenerate
                            </button>
                          </div>
                        </div>
                        {accessCode ? (
                          <div className="mt-1 text-xs">
                            <span className="font-semibold tracking-[0.2em] text-[var(--accent)]">{accessCode.code}</span>
                            <span className="ml-2 text-[color:var(--muted)]">expires in {accessCode.minutesRemaining} min</span>
                          </div>
                        ) : null}
                        {codeMessage ? <div className="mt-1 text-[11px] text-[color:var(--muted)]">{codeMessage}</div> : null}
                      </div>
                    </>
                  );
                })()}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[rgba(21,32,43,0.14)] px-4 py-6 text-sm text-[color:var(--muted)]">
              {isLoadingQueue ? "Loading appointments…" : "No appointments yet."}
            </div>
          )}
          {saveMessage ? <p className="text-sm font-medium text-[color:#2f6f57]">{saveMessage}</p> : null}
        </div>
      </section>

      {selectedQueueItem ? (
        <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true" aria-label="Queue actions">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedQueueCardId(null)}
            aria-label="Close actions"
          />
          <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-white p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.2)]">
            <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[rgba(21,32,43,0.18)]" />
            <div className="text-sm font-semibold">{selectedQueueItem.patientName} · {selectedQueueItem.patientPhone}</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">
              {formatDoctorDisplayName(selectedQueueItem.doctorName)} · {`${selectedQueueItem.appointmentDate || "today"} ${selectedQueueItem.appointmentTime || ""}`.trim()}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  window.open(`/print/consult/${encodeURIComponent(selectedQueueItem.consultSessionId)}`, "_blank", "noopener,noreferrer")
                }
                className="focus-ring rounded-xl border border-[rgba(21,32,43,0.14)] bg-white px-3 py-2 text-sm font-semibold text-[var(--accent)]"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setSelectedQueueCardId(null)}
                className="focus-ring rounded-xl border border-[rgba(21,32,43,0.14)] bg-white px-3 py-2 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-[color:var(--muted)]">Status</label>
              <select
                value={selectedQueueItem.status}
                onChange={(event) => updateQueueStatus(selectedQueueItem.id, event.target.value)}
                className="mt-1 w-full rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2 text-sm font-semibold outline-none"
              >
                {queueStatusOptions.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 rounded-xl border border-[rgba(21,32,43,0.1)] bg-[rgba(21,32,43,0.02)] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-[color:var(--muted)]">Patient access code</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadAccessCode(selectedQueueItem.patientPhone, false)}
                    disabled={Boolean(selectedAccessCodeLoading)}
                    className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                  >
                    {selectedAccessCodeLoading ? "Loading..." : selectedAccessCode ? "Refresh" : "Reveal"}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadAccessCode(selectedQueueItem.patientPhone, true)}
                    disabled={Boolean(selectedAccessCodeLoading)}
                    className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
              {selectedAccessCode ? (
                <div className="mt-1 text-xs">
                  <span className="font-semibold tracking-[0.2em] text-[var(--accent)]">{selectedAccessCode.code}</span>
                  <span className="ml-2 text-[color:var(--muted)]">expires in {selectedAccessCode.minutesRemaining} min</span>
                </div>
              ) : null}
              {selectedAccessCodeMessage ? <div className="mt-1 text-[11px] text-[color:var(--muted)]">{selectedAccessCodeMessage}</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
