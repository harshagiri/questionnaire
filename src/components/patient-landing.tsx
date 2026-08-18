"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const POPULAR_SEARCHES = ["Back Pain", "Slipped Disc", "Sciatica", "Post-Surgery Rehab"];

export function PatientLanding() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  function goToSearch(term?: string) {
    const query = (term ?? searchTerm).trim();
    router.push(query ? `/find-doctors?q=${encodeURIComponent(query)}` : "/find-doctors");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_5%_10%,#eaf5ff_0%,#f7fafe_38%,#f8fafc_100%)]">
      <header className="border-b border-[color:var(--border)] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="focus-ring flex items-center gap-2.5">
            <span className="relative h-9 w-9 overflow-hidden rounded-2xl bg-white shadow-sm">
              <Image src="/logo.jpg" alt="SpinExperts icon" fill sizes="36px" className="object-cover object-[50%_22%] scale-[1.24]" />
            </span>
            <span className="headline text-lg font-semibold leading-none text-[color:var(--foreground)]">SpinExperts India</span>
          </Link>
          <Link
            href="/login"
            className="focus-ring shrink-0 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[rgba(59,130,246,0.08)]"
          >
            Sign In
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="text-center">
          <h1 className="headline text-3xl font-semibold leading-tight text-[color:var(--foreground)] sm:text-4xl">
            Find and book spine specialists you can trust
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted)] sm:text-base">
            Search doctors, check live slots, and book a clinic or video consult — no sign-in needed to browse.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              goToSearch();
            }}
            className="mx-auto mt-6 flex w-full max-w-xl items-center gap-2 rounded-full border border-[rgba(21,32,43,0.12)] bg-white p-1.5 shadow-[0_16px_40px_rgba(16,53,103,0.1)]"
          >
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search doctors, conditions, e.g. Sciatica"
              className="focus-ring w-full rounded-full bg-transparent px-4 py-2.5 text-sm outline-none"
            />
            <button
              type="submit"
              className="focus-ring shrink-0 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Search
            </button>
          </form>

          <div className="mx-auto mt-3 flex max-w-xl flex-wrap justify-center gap-2">
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => goToSearch(term)}
                className="focus-ring rounded-full border border-[rgba(21,32,43,0.12)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] hover:border-[rgba(59,130,246,0.4)] hover:text-[var(--accent)]"
              >
                {term}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/find-doctors?mode=clinic")}
            className="focus-ring rounded-2xl border border-[rgba(21,32,43,0.1)] bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.12)] text-xl">🏥</div>
            <p className="text-lg font-semibold text-[color:var(--foreground)]">In-Clinic Appointment</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Visit our specialists at the clinic</p>
          </button>
          <button
            type="button"
            onClick={() => router.push("/find-doctors?mode=video")}
            className="focus-ring rounded-2xl border border-[rgba(21,32,43,0.1)] bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(59,130,246,0.12)] text-xl">🎥</div>
            <p className="text-lg font-semibold text-[color:var(--foreground)]">Video Consultation</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Connect with a doctor from home</p>
          </button>
        </section>

        <section className="mt-10 text-center">
          <Link href="/find-doctors" className="focus-ring text-sm font-semibold text-[var(--accent)] underline">
            Browse all doctors →
          </Link>
        </section>
      </main>

      <footer className="mt-8 border-t border-[color:var(--border)] bg-[rgba(240,248,255,0.78)] py-6 text-center text-xs text-[color:var(--muted)]">
        Expert care. Every spine. Every time.
      </footer>
    </div>
  );
}
