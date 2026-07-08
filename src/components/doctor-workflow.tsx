"use client";

import { useEffect, useMemo, useState } from "react";
import { doctorWorkflowSections } from "@/lib/workflow-data";

const patients = [
  {
    id: "ritika",
    name: "Ritika Sharma",
    patientId: "SEI-001",
    age: 34,
    sex: "Female",
    appointmentTime: "10:30 AM",
    consultationType: "New consult",
    summary: "Fever, sore throat, and fatigue for 3 days. No red flags.",
    bmi: 22.0,
    painScore: 6,
    mriAvailable: "MRI report only",
    status: "Ready",
  },
  {
    id: "imran",
    name: "Imran Khan",
    patientId: "SEI-002",
    age: 47,
    sex: "Male",
    appointmentTime: "11:00 AM",
    consultationType: "Follow-up",
    summary: "Chest discomfort after exertion, pain score 4/10, incomplete MRI review.",
    bmi: 26.4,
    painScore: 4,
    mriAvailable: "No MRI yet",
    status: "Waiting",
  },
] as const;

const sectionStatusChoices = ["Clinically accurate", "Partially accurate", "Needs correction"] as const;

export function DoctorWorkflow() {
  const [patientIndex, setPatientIndex] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [isTabletLayout, setIsTabletLayout] = useState(false);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [isDemographicsCompact, setIsDemographicsCompact] = useState(false);
  const [validation, setValidation] = useState<(typeof sectionStatusChoices)[number]>("Clinically accurate");
  const [mriInterpretationVisible, setMriInterpretationVisible] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({
    intake: true,
    risk: true,
    decision: true,
    plan: true,
  });

  const activePatient = patients[patientIndex];
  const completion = Math.round(((sectionIndex + 1) / doctorWorkflowSections.length) * 100);
  const overallScore = Math.max(
    0,
    Math.min(100, Math.round(100 - activePatient.painScore * 5 - Math.abs(activePatient.bmi - 22) * 2 + completion * 0.2)),
  );

  const summaryCards = useMemo(
    () => [
      { label: "Patient ID", value: activePatient.patientId },
      { label: "Age", value: `${activePatient.age}` },
      { label: "Sex", value: activePatient.sex },
      { label: "Time", value: activePatient.appointmentTime },
      { label: "Consultation", value: activePatient.consultationType },
      { label: "BMI", value: activePatient.bmi.toFixed(1) },
      { label: "Pain score", value: `${activePatient.painScore}/10` },
      { label: "MRI", value: activePatient.mriAvailable },
    ],
    [activePatient],
  );

  const phaseGroups = useMemo(
    () => [
      {
        id: "intake",
        title: "Intake",
        subtitle: "Context and pre-consult validation",
        sectionIds: ["details", "validation", "primary-problem"],
      },
      {
        id: "risk",
        title: "Risk",
        subtitle: "Risk signals and diagnosis",
        sectionIds: ["risk", "diagnosis", "correlation"],
      },
      {
        id: "decision",
        title: "Decision",
        subtitle: "Clinical direction and tests",
        sectionIds: ["care-pathway", "investigations"],
      },
      {
        id: "plan",
        title: "Plan",
        subtitle: "Prescription, referral and follow-up",
        sectionIds: ["prescription", "referral", "follow-up", "outcome"],
      },
    ],
    [],
  );

  const go = (delta: number) => setSectionIndex((current) => Math.min(Math.max(current + delta, 0), doctorWorkflowSections.length - 1));
  const scoreTone = overallScore >= 70 ? "text-[var(--accent)]" : overallScore >= 45 ? "text-[color:#9a5f00]" : "text-[color:#b23b1e]";

  const getSectionStatus = (index: number) => {
    if (index < sectionIndex) {
      return "Done";
    }
    if (index === sectionIndex) {
      return "In progress";
    }
    return "Not started";
  };

  const statusStyles: Record<string, string> = {
    Done: "bg-[rgba(15,118,110,0.12)] text-[var(--accent)]",
    "In progress": "bg-[rgba(246,164,77,0.2)] text-[color:#8a5200]",
    "Not started": "bg-[rgba(21,32,43,0.08)] text-[color:var(--muted)]",
  };

  useEffect(() => {
    const updateLayout = () => {
      const tablet = window.innerWidth >= 768 && window.innerWidth < 1280;
      setIsTabletLayout(tablet);
      if (tablet) {
        setShowPatientPicker(true);
      }
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setIsDemographicsCompact(window.scrollY > 140);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function jumpToSection(sectionId: string) {
    const index = doctorWorkflowSections.findIndex((section) => section.id === sectionId);
    if (index >= 0) {
      setSectionIndex(index);
    }
  }

  function togglePhase(phaseId: string) {
    setExpandedPhases((current) => ({
      ...current,
      [phaseId]: !current[phaseId],
    }));
  }

  function selectPatient(index: number) {
    setPatientIndex(index);
    setSectionIndex(0);
    if (isTabletLayout) {
      setShowPatientPicker(false);
    }
  }

  const consultationPanel = (
    <section className="rounded-[2rem] border border-white/70 bg-[rgba(255,255,255,0.9)] p-5 shadow-[0_24px_80px_rgba(21,32,43,0.12)] lg:p-7">
      <div className="sticky top-20 z-20 overflow-hidden rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-[0_10px_24px_rgba(21,32,43,0.08)] transition-all">
        <div className={`grid gap-4 ${isDemographicsCompact ? "lg:grid-cols-[1fr_auto]" : "lg:grid-cols-[1fr_auto]"}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold tracking-[0.08em] text-[var(--accent)]">SEI-SCT v1.0</span>
            <span className="rounded-full bg-[rgba(21,32,43,0.08)] px-3 py-1 text-xs font-semibold text-[color:var(--foreground)]">{activePatient.status}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <h1 className={`headline font-semibold leading-tight transition-all ${isDemographicsCompact ? "text-xl sm:text-2xl" : "text-3xl sm:text-4xl"}`}>{activePatient.name}</h1>
            <span className={`pb-1 text-[color:var(--muted)] transition-all ${isDemographicsCompact ? "text-xs" : "text-sm"}`}>{activePatient.patientId}</span>
          </div>

          <div
            className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out ${
              isDemographicsCompact ? "max-h-0 opacity-0 mt-0 pointer-events-none" : "mt-3 max-h-[18rem] opacity-100"
            }`}
          >
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {summaryCards.map((item) => (
                <div key={item.label} className="rounded-xl border border-[rgba(21,32,43,0.08)] bg-white px-3 py-2">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]">{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-[color:var(--foreground)]">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out ${
              isDemographicsCompact ? "mt-3 max-h-20 opacity-100" : "max-h-0 opacity-0 mt-0 pointer-events-none"
            }`}
          >
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                `Age ${activePatient.age}`,
                activePatient.sex,
                `BMI ${activePatient.bmi.toFixed(1)}`,
                `Pain ${activePatient.painScore}/10`,
                `Score ${overallScore}`,
                `Progress ${completion}%`,
              ].map((item) => (
                <span key={item} className="shrink-0 rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-3 py-1 text-xs font-semibold text-[color:var(--foreground)]">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out ${
            isDemographicsCompact ? "max-h-0 opacity-0 mt-0 pointer-events-none" : "max-h-[16rem] opacity-100"
          }`}
        >
          <div className="grid min-w-[180px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[1.1rem] border border-[rgba(15,118,110,0.2)] bg-[rgba(15,118,110,0.08)] px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Overall score</div>
              <div className="mt-1 text-3xl font-semibold text-[var(--accent)]">{overallScore}</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">Composite of pain, BMI, and consult progression</div>
            </div>
            <div className="rounded-[1.1rem] border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">Progress</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--accent)]">{completion}%</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                Section {sectionIndex + 1} of {doctorWorkflowSections.length}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[rgba(21,32,43,0.08)]">
          <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${completion}%` }} />
        </div>
      </div>
      </div>

      <div className="mt-4">
        <aside className="rounded-[1.3rem] border border-[rgba(21,32,43,0.08)] bg-white p-3 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto">
          <div className="px-1 text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Consult navigator</div>
          <div className="mt-3 space-y-3">
            {phaseGroups.map((phase) => (
              <div key={phase.id} className="rounded-2xl border border-[rgba(21,32,43,0.08)] bg-[rgba(248,245,240,0.65)] p-2">
                <button
                  type="button"
                  onClick={() => togglePhase(phase.id)}
                  className="focus-ring flex w-full items-center justify-between rounded-xl px-2 py-2 text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-[color:var(--foreground)]">{phase.title}</div>
                    <div className="text-xs text-[color:var(--muted)]">{phase.subtitle}</div>
                  </div>
                  <div className="text-xs font-semibold text-[color:var(--muted)]">{expandedPhases[phase.id] ? "Hide" : "Show"}</div>
                </button>

                {expandedPhases[phase.id] ? (
                  <div className="mt-2 space-y-1.5">
                    {phase.sectionIds.map((sectionId) => {
                      const section = doctorWorkflowSections.find((item) => item.id === sectionId);
                      if (!section) {
                        return null;
                      }

                      const index = doctorWorkflowSections.findIndex((item) => item.id === sectionId);
                      const status = getSectionStatus(index);
                      const isActive = index === sectionIndex;

                      return (
                        <div key={section.id}>
                          <button
                            type="button"
                            onClick={() => jumpToSection(section.id)}
                            className={`focus-ring w-full rounded-xl border px-3 py-2.5 text-left transition ${isActive ? "border-[var(--accent)] bg-[rgba(15,118,110,0.08)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-[color:var(--foreground)]">{index + 1}. {section.title}</div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusStyles[status]}`}>
                                {status}
                              </span>
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--muted)]">{section.subtitle}</div>
                          </button>

                          {isActive ? (
                          <div className="mt-2 rounded-xl border border-[rgba(21,32,43,0.08)] bg-white p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">{section.title}</div>
                            <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{section.subtitle}</p>

                            <div className="mt-3 rounded-2xl border border-[rgba(21,32,43,0.08)] bg-[rgba(15,118,110,0.04)] p-4">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Patient summary</div>
                              <p className="mt-1 text-sm leading-7 text-[color:var(--foreground)]">{activePatient.summary}</p>
                            </div>

                            {section.id === "validation" ? (
                              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                {sectionStatusChoices.map((choice) => (
                                  <button
                                    key={choice}
                                    type="button"
                                    onClick={() => setValidation(choice)}
                                    className={`focus-ring rounded-2xl border px-4 py-3 text-sm font-medium ${validation === choice ? "border-[var(--accent)] bg-[rgba(15,118,110,0.08)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}
                                  >
                                    {choice}
                                  </button>
                                ))}
                                <textarea placeholder="Optional comments" rows={3} className="sm:col-span-3 focus-ring rounded-2xl border border-[rgba(21,32,43,0.12)] px-4 py-3 outline-none" />
                              </div>
                            ) : null}

                            {section.id === "primary-problem" ? (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {section.fields.map((field) => (
                                  <button key={field} type="button" className="focus-ring rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 text-left text-sm font-medium">
                                    {field}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {section.id === "risk" ? (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {["Motor weakness", "Sensory loss", "Bladder / bowel", "Walking imbalance"].map((item) => (
                                  <button key={item} type="button" className="focus-ring rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 text-left text-sm font-medium">
                                    {item}
                                  </button>
                                ))}
                                <select className="focus-ring sm:col-span-2 rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 outline-none">
                                  <option>Low risk</option>
                                  <option>Moderate risk</option>
                                  <option>High risk</option>
                                </select>
                              </div>
                            ) : null}

                            {section.id === "correlation" ? (
                              <div className="mt-4 space-y-3">
                                <div className="grid gap-3 sm:grid-cols-3">
                                  {["MRI available", "MRI not available", "Need interpretation"].map((item) => (
                                    <button key={item} type="button" className="focus-ring rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 text-left text-sm font-medium" onClick={() => setMriInterpretationVisible(item !== "MRI not available")}>{item}</button>
                                  ))}
                                </div>
                                <div className="rounded-2xl border border-[rgba(15,118,110,0.18)] bg-[rgba(15,118,110,0.06)] p-4 text-sm leading-7">
                                  MRI interpretation {mriInterpretationVisible ? "is visible" : "is hidden because MRI is not available"}.
                                </div>
                              </div>
                            ) : null}

                            {section.id === "care-pathway" ? (
                              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {section.fields.map((field) => (
                                  <button key={field} type="button" className="focus-ring rounded-[1.35rem] border border-[rgba(21,32,43,0.12)] bg-white px-4 py-4 text-left text-sm font-medium">
                                    {field}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {section.condition ? (
                              <div className="mt-4 rounded-3xl bg-[rgba(255,138,91,0.12)] px-4 py-3 text-sm font-medium text-[color:var(--foreground)]">{section.condition}</div>
                            ) : null}

                            {![["validation", "primary-problem", "risk", "correlation", "care-pathway"]].flat().includes(section.id) ? (
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {section.fields.map((field) => (
                                  <button key={field} type="button" className="focus-ring rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 text-left text-sm font-medium">
                                    {field}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => go(-1)} className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold">Previous</button>
        <button type="button" onClick={() => go(1)} className="focus-ring rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white">Next</button>
        <button type="button" className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold">Review answers</button>
        <button type="button" className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold">Edit answers</button>
        <button type="button" className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold">Resume later</button>
        <button type="button" className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-5 py-3 text-sm font-semibold">Draft save</button>
      </div>
    </section>
  );

  if (isTabletLayout && showPatientPicker) {
    return (
      <div className="space-y-4">
        <section className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white/95 p-4 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Doctor dashboard</div>
          <div className="headline mt-1 text-2xl font-semibold">Select patient</div>
          <div className="mt-3 rounded-2xl bg-[rgba(15,118,110,0.06)] p-4 text-sm leading-7 text-[color:var(--foreground)]">
            Choose a patient to open the consultation details.
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {patients.map((patient, index) => (
              <button
                key={patient.id}
                type="button"
                onClick={() => selectPatient(index)}
                className="focus-ring rounded-2xl border border-[rgba(21,32,43,0.12)] bg-white px-4 py-3 text-left transition hover:bg-[rgba(15,118,110,0.06)]"
              >
                <div className="text-sm font-semibold">{patient.name}</div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">{patient.appointmentTime} · {patient.status}</div>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (isTabletLayout) {
    return (
      <div className="space-y-4">{consultationPanel}</div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.32fr_1fr]">
      <aside className="space-y-4 rounded-[1.75rem] border border-[rgba(21,32,43,0.08)] bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:h-fit">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Doctor dashboard</div>
        <div className="headline text-2xl font-semibold">Today’s patient queue</div>
        {patients.map((patient, index) => (
          <button
            key={patient.id}
            type="button"
            onClick={() => selectPatient(index)}
            className={`focus-ring w-full rounded-2xl border px-4 py-3 text-left transition ${index === patientIndex ? "border-[var(--accent)] bg-[rgba(15,118,110,0.08)]" : "border-[rgba(21,32,43,0.12)] bg-white"}`}
          >
            <div className="text-sm font-semibold">{patient.name}</div>
            <div className="mt-1 text-xs text-[color:var(--muted)]">{patient.appointmentTime} · {patient.status}</div>
          </button>
        ))}

        <div className="rounded-2xl bg-[rgba(15,118,110,0.06)] p-4 text-sm leading-7 text-[color:var(--foreground)]">
          The consultation URL can open the same patient file for today’s consult and resume exactly where the doctor left off.
        </div>
      </aside>

      {consultationPanel}
    </div>
  );
}