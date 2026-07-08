import { AppShell } from "@/components/app-shell";
import { AdminDoctorManagement } from "@/components/admin-doctor-management";
import { getAdminSummary } from "@/lib/metrics";
import { usageMetrics } from "@/lib/mock-data";
import { roleCapabilities } from "@/lib/rbac";

const adminSummary = getAdminSummary();

export default function AdminPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <section className="glass-panel rounded-[2rem] p-6 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-center">
            <div>
              <span className="rounded-full bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)]">
                Admin control plane
              </span>
              <h1 className="headline mt-4 text-4xl font-semibold sm:text-5xl">Usage metrics, RBAC, and operational monitoring</h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-[color:var(--muted)]">
                This view is designed for growth-stage oversight: completion speed, drop-off, autosave behavior, doctor throughput, and role permissions that can be configured in the backend.
              </p>
            </div>

            <div className="rounded-[1.75rem] bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Permissions model</div>
              <div className="mt-4 space-y-3">
                {roleCapabilities.map((role) => (
                  <div key={role.role} className="rounded-2xl bg-[rgba(21,32,43,0.03)] px-4 py-3 text-sm">
                    <div className="font-semibold capitalize">{role.role}</div>
                    <div className="mt-1 text-[color:var(--muted)]">{role.permissions.join(", ")}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total patients", value: adminSummary.totalPatients },
            { label: "Completed", value: adminSummary.completedPatients },
            { label: "Completion rate", value: `${adminSummary.completionRate}%` },
            { label: "Average BMI", value: adminSummary.averageBmi },
          ].map((metric) => (
            <div key={metric.label} className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
              <div className="text-sm text-[color:var(--muted)]">{metric.label}</div>
              <div className="mt-2 text-4xl font-semibold">{metric.value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="headline text-2xl font-semibold">Usage metrics</h2>
              <span className="text-sm text-[color:var(--muted)]">MVP instrument panel</span>
            </div>
            <div className="mt-5 space-y-4">
              {usageMetrics.map((metric) => (
                <div key={metric.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{metric.label}</span>
                    <span className="text-[color:var(--muted)]">{metric.value}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[rgba(21,32,43,0.06)]">
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: metric.value.includes("500") ? "100%" : metric.value.includes("91") ? "91%" : metric.value.includes("12") ? "58%" : "74%" }} />
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">{metric.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
            <h2 className="headline text-2xl font-semibold">Backend configuration hooks</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--muted)]">
              <div className="rounded-2xl bg-[rgba(15,118,110,0.06)] px-4 py-3">Toggle role permissions from an admin settings table in the database.</div>
              <div className="rounded-2xl bg-[rgba(15,118,110,0.06)] px-4 py-3">Manage questionnaire versions, conditional logic, and appointment assignment rules.</div>
              <div className="rounded-2xl bg-[rgba(15,118,110,0.06)] px-4 py-3">Track completion time, response duration, autosave resume, and export usage by doctor or clinic.</div>
            </div>
          </div>
        </section>

        <AdminDoctorManagement />
      </div>
    </AppShell>
  );
}