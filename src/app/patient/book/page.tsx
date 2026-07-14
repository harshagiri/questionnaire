import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientBookAppointment } from "@/components/patient-book-appointment";
import { PatientProfileGate } from "@/components/patient-profile-gate";

export const metadata = {
  title: "Book Appointment — SpineExpert",
};

export default async function PatientBookPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get("se_role")?.value;
  const name = cookieStore.get("se_name")?.value;

  if (!role || role !== "patient") {
    redirect("/?role=patient&next=/patient/book");
  }

  const phone = (name ?? "").replace(/\D/g, "");

  return (
    <AppShell role="patient">
      <PatientProfileGate phone={phone}>
        <PatientBookAppointment phone={phone} />
      </PatientProfileGate>
    </AppShell>
  );
}
