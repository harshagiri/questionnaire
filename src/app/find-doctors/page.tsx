import { AppShell } from "@/components/app-shell";
import { PatientBookAppointment } from "@/components/patient-book-appointment";

export const metadata = {
  title: "Find Doctors — SpineExpert",
};

export default async function FindDoctorsPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; q?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialConsultMode = resolvedSearchParams?.mode === "video" ? "video" : "clinic";
  const initialSearchTerm = resolvedSearchParams?.q ?? "";

  return (
    <AppShell>
      <PatientBookAppointment
        phone=""
        publicMode
        initialConsultMode={initialConsultMode}
        initialSearchTerm={initialSearchTerm}
      />
    </AppShell>
  );
}
