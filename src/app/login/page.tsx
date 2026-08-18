import { LoginPortal } from "@/components/login-portal";

export const metadata = {
  title: "Sign In — SpineExpert",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; role?: string };
}) {
  return <LoginPortal searchParams={searchParams ?? {}} />;
}
