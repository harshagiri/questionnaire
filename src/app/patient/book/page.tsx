import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientBookAppointment } from "@/components/patient-book-appointment";
import { PatientProfileGate } from "@/components/patient-profile-gate";

export const metadata = {
  title: "Book Appointment — SpineExpert",
};

export default async function PatientBookPage({
  searchParams,
}: {
  searchParams?: Promise<{ journey?: string; manage?: string; appointmentId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const journeyMode = resolvedSearchParams?.journey === "1";
  const manageMode = resolvedSearchParams?.manage === "1";
  const appointmentId = resolvedSearchParams?.appointmentId;
  const cookieStore = await cookies();
  const role = cookieStore.get("se_role")?.value;
  const name = cookieStore.get("se_name")?.value;
  const phoneCookie = cookieStore.get("se_phone")?.value;

  if (!role || role !== "patient") {
    const nextPath = journeyMode ? "/patient/book?journey=1" : "/patient/book";
    redirect(`/login?role=patient&next=${encodeURIComponent(nextPath)}`);
  }

  const phone = (phoneCookie ?? name ?? "").replace(/\D/g, "");

  return (
    <AppShell role="patient">
      {journeyMode ? (
        <PatientBookAppointment phone={phone} journeyMode />
      ) : (
        <PatientProfileGate phone={phone}>
          <PatientBookAppointment phone={phone} manageMode={manageMode} targetAppointmentId={appointmentId} />
        </PatientProfileGate>
      )}
    </AppShell>
  );
}
