"use client";

import { useEffect, useState } from "react";

type StaffRole = "doctor" | "receptionist" | "admin";

type StaffUser = {
  role: StaffRole;
  email: string;
  displayName: string;
  createdAt: string;
};

const initialForm = {
  role: "doctor" as StaffRole,
  email: "",
  displayName: "",
  password: "",
};

export function AdminStaffManagement() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadUsers() {
    try {
      const response = await fetch("/api/staff-users", { cache: "no-store" });
      const payload = (await response.json()) as { ok: boolean; users?: StaffUser[]; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Could not load staff users");
        return;
      }
      setUsers(payload.users ?? []);
    } catch {
      setMessage("Could not load staff users");
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreateUser() {
    if (!form.email.trim() || !form.displayName.trim() || !form.password.trim()) {
      setMessage("All fields are required");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/staff-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Could not create user");
        return;
      }

      setForm(initialForm);
      setMessage("Staff user created successfully.");
      await loadUsers();
    } catch {
      setMessage("Could not create user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
        <h2 className="headline text-2xl font-semibold">Manage staff users</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Create role-specific users for doctor, receptionist, and admin logins.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            value={form.role}
            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as StaffRole }))}
            className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] bg-white px-3 py-2.5 outline-none"
          >
            <option value="doctor">Doctor</option>
            <option value="receptionist">Receptionist</option>
            <option value="admin">Admin</option>
          </select>
          <input
            value={form.displayName}
            onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            placeholder="Display name"
            className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email"
            className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Password (min 8)"
            className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
        </div>

        {message ? <p className="mt-3 text-sm text-[color:var(--muted)]">{message}</p> : null}

        <button
          type="button"
          onClick={handleCreateUser}
          disabled={submitting}
          className="focus-ring mt-4 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Create user"}
        </button>
      </div>

      <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
        <h2 className="headline text-2xl font-semibold">Staff roster</h2>
        <div className="mt-4 space-y-3">
          {users.length === 0 ? (
            <div className="rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2.5 text-sm text-[color:var(--muted)]">No users yet.</div>
          ) : (
            users.map((user) => (
              <div key={`${user.role}:${user.email}`} className="rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2.5">
                <div className="text-sm font-semibold">{user.displayName}</div>
                <div className="text-xs text-[color:var(--muted)]">
                  {user.role} · {user.email}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
