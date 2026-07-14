import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientDashboard } from "@/components/patient-dashboard";

export const metadata = {
  title: "My Appointments — SpineExpert",
};

export default async function PatientPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("se_role")?.value;
  const name = cookieStore.get("se_name")?.value;

  if (!role || role !== "patient") {
    redirect("/?role=patient");
  }

  // Extract phone from se_name (we store phone as name for patients)
  const phone = (name ?? "").replace(/\D/g, "");

  return (
    <AppShell role="patient">
      <PatientDashboard phone={phone} />
    </AppShell>
  );
}
