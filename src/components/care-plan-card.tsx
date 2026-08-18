"use client";

import { useState } from "react";
import { formatCarePlanMessage, formatDoctorSignature, type CarePlan } from "@/lib/care-plan";

type CarePlanCardProps = {
  plan: CarePlan;
  updatedAt?: string;
  editable?: boolean;
  phone?: string;
  onSave?: (plan: CarePlan) => Promise<void> | void;
};

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.18-1.36a9.94 9.94 0 0 0 4.86 1.24h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.92-7.04A9.9 9.9 0 0 0 12.04 2Zm0 18.15h-.01a8.27 8.27 0 0 1-4.21-1.15l-.3-.18-3.07.8.82-3-.2-.31a8.23 8.23 0 0 1-1.26-4.39c0-4.57 3.72-8.29 8.29-8.29 2.21 0 4.29.86 5.86 2.43a8.23 8.23 0 0 1 2.42 5.86c0 4.57-3.72 8.23-8.34 8.23Zm4.52-6.17c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.71-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.56-.42h-.48c-.16 0-.43.06-.65.31-.22.24-.85.83-.85 2.03s.87 2.35.99 2.51c.12.16 1.71 2.6 4.14 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

function listToText(items: string[]) {
  return items.join("\n");
}

function textToList(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[rgba(21,32,43,0.1)] bg-white px-4 py-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">{title}</h4>
      <div className="mt-1.5 text-sm leading-6 text-[color:var(--foreground)]">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-[color:var(--muted)]">Not recorded</p>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[var(--accent)]" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CarePlanCard({ plan, updatedAt, editable = false, phone, onSave }: CarePlanCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CarePlan>(plan);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!onSave) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave(draft);
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save care plan");
    } finally {
      setSaving(false);
    }
  }

  const whatsappDigits = String(phone ?? "").replace(/\D/g, "");
  const whatsappHref = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(formatCarePlanMessage(plan))}`;

  const fieldClass =
    "mt-1 w-full rounded-lg border border-[rgba(21,32,43,0.14)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

  return (
    <div className="rounded-[1.25rem] border border-[rgba(22,95,192,0.22)] bg-[rgba(22,95,192,0.05)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-[color:var(--foreground)]">My Care Plan</h3>
          {updatedAt ? (
            <p className="text-[11px] text-[color:var(--muted)]">Last updated {new Date(updatedAt).toLocaleString()}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            aria-label="Send care plan on WhatsApp"
            className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[#25D366] bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"
          >
            <WhatsAppIcon />
            WhatsApp
          </a>
          {editable && !isEditing ? (
            <button
              type="button"
              onClick={() => {
                setDraft(plan);
                setIsEditing(true);
              }}
              className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      {isEditing ? (
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
            What the doctor thinks
            <textarea
              rows={3}
              value={draft.doctorAssessment}
              onChange={(event) => setDraft((current) => ({ ...current, doctorAssessment: event.target.value }))}
              className={fieldClass}
            />
          </label>

          {(
            [
              ["whatIShouldDoNow", "What I should do now (one per line)"],
              ["whatIShouldNotWorryAbout", "What I should not worry about (one per line)"],
              ["warningSigns", "Warning signs (one per line)"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="block text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
              {label}
              <textarea
                rows={4}
                value={listToText(draft[field])}
                onChange={(event) => setDraft((current) => ({ ...current, [field]: textToList(event.target.value) }))}
                className={fieldClass}
              />
            </label>
          ))}

          {(
            [
              ["nextAction", "My next appointment or action"],
              ["responsiblePerson", "Who is responsible"],
              ["whenItShouldHappen", "When it should happen"],
              ["reviewedBy", "Reviewed and approved by"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="block text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--muted)]">
              {label}
              <input
                type="text"
                value={draft[field]}
                onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                className={fieldClass}
              />
            </label>
          ))}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="focus-ring rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save final version"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(plan);
                setIsEditing(false);
              }}
              className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-4 py-2 text-xs font-semibold text-[color:var(--muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <Section title="What the doctor thinks">
            <p>{plan.doctorAssessment || "Not recorded"}</p>
          </Section>
          <Section title="What I should do now">
            <BulletList items={plan.whatIShouldDoNow} />
          </Section>
          <Section title="What I should not worry about">
            <BulletList items={plan.whatIShouldNotWorryAbout} />
          </Section>
          <Section title="Warning signs">
            <BulletList items={plan.warningSigns} />
          </Section>
          <Section title="My next appointment or action">
            <p>{plan.nextAction || "Not recorded"}</p>
          </Section>
          <Section title="Who is responsible">
            <p>{plan.responsiblePerson || "Not recorded"}</p>
          </Section>
          <Section title="When it should happen">
            <p>{plan.whenItShouldHappen || "Not recorded"}</p>
          </Section>
          <p className="px-1 pt-1 text-xs font-semibold italic text-[color:var(--muted)]">
            Reviewed and approved by {formatDoctorSignature(plan.reviewedBy)} as per consultation.
          </p>
        </div>
      )}
    </div>
  );
}
