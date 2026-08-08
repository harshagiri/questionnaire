import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PatientOtpGate } from "@/components/patient-otp-gate";

export const metadata = {
  title: "Verify OTP — SpineExpert",
};

export default async function PatientOtpPage({
  searchParams,
}: {
  searchParams?: Promise<{ consultId?: string; phone?: string; journey?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const cookieStore = await cookies();
  const role = cookieStore.get("se_role")?.value;

  if (!role || role !== "patient") {
    const nextPath = "/patient/otp";
    redirect(`/?role=patient&next=${encodeURIComponent(nextPath)}`);
  }

  const cookiePhone = (cookieStore.get("se_phone")?.value ?? cookieStore.get("se_name")?.value ?? "").replace(/\D/g, "");
  const phone = (resolvedSearchParams?.phone ?? cookiePhone).replace(/\D/g, "");

  return (
    <AppShell role="patient">
      <PatientOtpGate consultId={resolvedSearchParams?.consultId} phone={phone} />
    </AppShell>
  );
}
