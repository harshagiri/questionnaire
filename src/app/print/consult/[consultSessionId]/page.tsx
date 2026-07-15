import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ConsultPrintView } from "@/components/consult-print-view";

export default async function ConsultPrintPage({
  params,
}: {
  params: Promise<{ consultSessionId: string }>;
}) {
  const { consultSessionId } = await params;
  const cookieStore = await cookies();
  const role = (cookieStore.get("se_role")?.value ?? "").trim().toLowerCase();

  if (role !== "doctor" && role !== "receptionist" && role !== "admin") {
    redirect("/");
  }

  return <ConsultPrintView consultSessionId={consultSessionId} role={role} />;
}
