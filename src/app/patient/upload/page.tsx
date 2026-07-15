import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { PatientLabUpload } from "@/components/patient-lab-upload";
import { PatientProfileGate } from "@/components/patient-profile-gate";

export const metadata = {
  title: "Upload Documents — SpineExpert",
};

export default async function PatientUploadPage() {
  const cookieStore = await cookies();
  const phone = (cookieStore.get("se_name")?.value ?? "").replace(/\D/g, "");

  return (
    <AppShell role="patient">
      <PatientProfileGate phone={phone}>
        <PatientLabUpload patientPhone={phone} backHref="/patient" />
      </PatientProfileGate>
    </AppShell>
  );
}