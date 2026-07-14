import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { PatientLabUpload } from "@/components/patient-lab-upload";
import { PatientProfileGate } from "@/components/patient-profile-gate";

export const metadata = {
  title: "Upload Reports — SpineExpert",
};

export default async function LabUploadPage({
  params,
}: {
  params: Promise<{ consultId: string }>;
}) {
  const cookieStore = await cookies();
  const phone = (cookieStore.get("se_name")?.value ?? "").replace(/\D/g, "");
  const { consultId } = await params;

  return (
    <AppShell role="patient">
      <PatientProfileGate phone={phone}>
        <PatientLabUpload consultId={consultId} />
      </PatientProfileGate>
    </AppShell>
  );
}
