import { AppShell } from "@/components/app-shell";
import { AdminStaffManagement } from "@/components/admin-staff-management";
import { AdminDoctorManagement } from "@/components/admin-doctor-management";
import { getAdminSummary, getUsageMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [adminSummary, usageMetrics] = await Promise.all([getAdminSummary(), getUsageMetrics()]);

  return (
    <AppShell role="admin">
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: "Total patients", value: adminSummary.totalPatients },
            { label: "Completed", value: adminSummary.completedPatients },
            { label: "Completion rate", value: `${adminSummary.completionRate}%` },
            { label: "Total patients screened", value: adminSummary.completedPatients },
            { label: "Total doctors", value: adminSummary.totalDoctors },
            { label: "Regions/Cities served", value: adminSummary.totalRegionsServed },
          ].map((metric) => (
            <div key={metric.label} className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
              <div className="text-sm text-[color:var(--muted)]">{metric.label}</div>
              <div className="mt-2 text-4xl font-semibold">{metric.value}</div>
            </div>
          ))}
        </section>

        <section>
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
                    <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${metric.progress}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">{metric.note}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <AdminDoctorManagement />
        <AdminStaffManagement />
      </div>
    </AppShell>
  );
}