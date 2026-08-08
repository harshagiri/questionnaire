import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { PatientLabUpload } from "@/components/patient-lab-upload";
import { PatientProfileGate } from "@/components/patient-profile-gate";

export const metadata = {
  title: "Upload Reports — SpineExpert",
};

export default async function LabUploadPage({
  params,
  searchParams,
}: {
  params: Promise<{ consultId: string }>;
  searchParams?: Promise<{ journey?: string; phone?: string }>;
}) {
  const cookieStore = await cookies();
  const cookiePhone = (cookieStore.get("se_phone")?.value ?? cookieStore.get("se_name")?.value ?? "").replace(/\D/g, "");
  const { consultId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const phone = (resolvedSearchParams?.phone ?? cookiePhone).replace(/\D/g, "");
  const journeyMode = resolvedSearchParams?.journey === "1";
  const continueHref = journeyMode
    ? `/patient/confirm/${encodeURIComponent(consultId)}?journey=1&phone=${encodeURIComponent(phone)}`
    : undefined;
  const backHref = journeyMode
    ? `/patient/consult/${encodeURIComponent(consultId)}?phone=${encodeURIComponent(phone)}&journey=1`
    : "/patient";

  return (
    <AppShell role="patient">
      <PatientProfileGate phone={phone}>
        <PatientLabUpload
          consultId={consultId}
          patientPhone={phone}
          backHref={backHref}
          continueHref={continueHref}
        />
      </PatientProfileGate>
    </AppShell>
  );
}
