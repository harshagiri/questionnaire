"use client";

import { useEffect, useState } from "react";

type StaffRole = "doctor" | "receptionist" | "admin";

type StaffUser = {
  role: StaffRole;
  email: string;
  displayName: string;
  photoUrl?: string;
  createdAt: string;
};

const initialForm = {
  email: "",
  displayName: "",
  password: "",
  phone: "",
  registrationNumber: "",
  licenseNumber: "",
  bio: "",
  photoUrl: "",
};

const roleTabs: Array<{ role: StaffRole; label: string }> = [
  { role: "doctor", label: "Doctor" },
  { role: "receptionist", label: "Receptionist" },
  { role: "admin", label: "Admin" },
];

export function AdminStaffManagement() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [activeRole, setActiveRole] = useState<StaffRole>("doctor");
  const [form, setForm] = useState(initialForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, []);

  const visibleUsers = users
    .filter((user) => user.role === activeRole)
    .sort((a, b) => a.email.localeCompare(b.email));

  function resetForm() {
    setForm({ ...initialForm });
    setPhotoFile(null);
    setEditingEmail(null);
  }

  function startEdit(user: StaffUser) {
    setEditingEmail(user.email);
    setForm({
      email: user.email,
      displayName: user.displayName,
      password: "",
      phone: "",
      registrationNumber: "",
      licenseNumber: "",
      bio: "",
      photoUrl: user.photoUrl ?? "",
    });
    setPhotoFile(null);
    setMessage("");
  }

  function handleChangeRole(role: StaffRole) {
    setActiveRole(role);
    resetForm();
    setMessage("");
  }

  async function handleCreateUser() {
    if (!form.email.trim() || !form.displayName.trim() || !form.password.trim()) {
      setMessage("All fields are required");
      return;
    }
    if (form.password.trim().length < 8) {
      setMessage("Password must be at least 8 characters");
      return;
    }

    if (activeRole === "doctor") {
      if (!form.phone.trim() || !form.registrationNumber.trim() || !form.licenseNumber.trim() || !form.bio.trim()) {
        setMessage("All doctor profile fields are required.");
        return;
      }
      if (!photoFile && !form.photoUrl.trim()) {
        setMessage("Doctor profile photo is required.");
        return;
      }
    }

    setSubmitting(true);
    setMessage("");

    try {
      let resolvedPhotoUrl = form.photoUrl.trim();
      if (photoFile) {
        const uploadBody = new FormData();
        uploadBody.append("file", photoFile);

        const uploadResponse = await fetch("/api/uploads/staff-photo", {
          method: "POST",
          body: uploadBody,
        });
        const uploadPayload = (await uploadResponse.json()) as { ok: boolean; message?: string; photoUrl?: string };
        if (!uploadResponse.ok || !uploadPayload.ok || !uploadPayload.photoUrl) {
          setMessage(uploadPayload.message ?? "Could not upload photo");
          return;
        }

        resolvedPhotoUrl = uploadPayload.photoUrl;
      }

      if (activeRole === "doctor") {
        const doctorResponse = await fetch("/api/doctors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.displayName,
            email: form.email,
            password: form.password,
            phone: form.phone,
            registrationNumber: form.registrationNumber,
            licenseNumber: form.licenseNumber,
            bio: form.bio,
            photoUrl: resolvedPhotoUrl,
          }),
        });
        const doctorPayload = (await doctorResponse.json()) as { ok: boolean; message?: string; storage?: string };

        if (!doctorResponse.ok || !doctorPayload.ok) {
          setMessage(doctorPayload.message ?? "Could not create doctor profile");
          return;
        }

        if (doctorPayload.storage === "database") {
          resetForm();
          setMessage("Doctor profile and login created successfully.");
          await loadUsers();
          return;
        }
      }

      const response = await fetch("/api/staff-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          email: form.email,
          displayName: form.displayName,
          password: form.password,
          photoUrl: resolvedPhotoUrl,
        }),
      });

      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Could not create user");
        return;
      }

      resetForm();
      setMessage(activeRole === "doctor" ? "Doctor profile and login created successfully." : "Staff user created successfully.");
      await loadUsers();
    } catch {
      setMessage(activeRole === "doctor" ? "Could not create doctor" : "Could not create user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateUser() {
    if (!editingEmail) {
      return;
    }
    if (!form.displayName.trim()) {
      setMessage("Display name is required");
      return;
    }
    if (form.password.trim() && form.password.trim().length < 8) {
      setMessage("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      let resolvedPhotoUrl = form.photoUrl.trim();
      if (photoFile) {
        const uploadBody = new FormData();
        uploadBody.append("file", photoFile);

        const uploadResponse = await fetch("/api/uploads/staff-photo", {
          method: "POST",
          body: uploadBody,
        });
        const uploadPayload = (await uploadResponse.json()) as { ok: boolean; message?: string; photoUrl?: string };
        if (!uploadResponse.ok || !uploadPayload.ok || !uploadPayload.photoUrl) {
          setMessage(uploadPayload.message ?? "Could not upload photo");
          return;
        }

        resolvedPhotoUrl = uploadPayload.photoUrl;
      }

      const response = await fetch("/api/staff-users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          email: editingEmail,
          displayName: form.displayName,
          password: form.password.trim() || undefined,
          photoUrl: resolvedPhotoUrl,
        }),
      });

      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Could not update user");
        return;
      }

      setMessage("User updated successfully.");
      resetForm();
      await loadUsers();
    } catch {
      setMessage("Could not update user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
        <h2 className="headline text-2xl font-semibold">Manage staff users</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Switch tabs to view, add, and edit users per role. Doctor tab also creates doctor profile details.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.04)] p-1">
          {roleTabs.map((tab) => {
            const active = tab.role === activeRole;
            return (
              <button
                key={tab.role}
                type="button"
                onClick={() => handleChangeRole(tab.role)}
                className={
                  "focus-ring rounded-lg px-3 py-2.5 text-sm font-semibold transition " +
                  (active
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "bg-transparent text-[color:var(--foreground)] hover:bg-white")
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={form.displayName}
            onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
            placeholder="Display name"
            className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
          <input
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder={`${activeRole} email`}
            disabled={Boolean(editingEmail)}
            className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />

          <div className="sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] bg-[rgba(21,32,43,0.02)] px-3 py-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.photoUrl?.trim() || "https://www.gravatar.com/avatar/?d=identicon&s=96"}
                alt="Profile preview"
                className="h-10 w-10 rounded-full border border-[rgba(21,32,43,0.12)] object-cover"
              />
              <div className="text-xs text-[color:var(--muted)]">
                Upload profile photo
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                if (!selected) {
                  return;
                }
                if (selected.size > 5 * 1024 * 1024) {
                  setMessage("Image must be 5MB or smaller");
                  event.currentTarget.value = "";
                  return;
                }
                setPhotoFile(selected);
                const previewUrl = URL.createObjectURL(selected);
                setForm((current) => ({ ...current, photoUrl: previewUrl }));
                setMessage("");
              }}
              className="mt-2 block w-full text-xs"
            />
          </div>

          {activeRole === "doctor" && !editingEmail ? (
            <>
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Phone"
                className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
              />
              <input
                value={form.registrationNumber}
                onChange={(event) => setForm((current) => ({ ...current, registrationNumber: event.target.value }))}
                placeholder="Registration number"
                className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
              />
              <input
                value={form.licenseNumber}
                onChange={(event) => setForm((current) => ({ ...current, licenseNumber: event.target.value }))}
                placeholder="License number"
                className="focus-ring rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
              />
              <textarea
                value={form.bio}
                onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                placeholder="Bio"
                rows={3}
                className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
              />
            </>
          ) : null}

          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            placeholder={editingEmail ? "New password (optional, min 8)" : "Password (min 8)"}
            className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 outline-none"
          />
        </div>

        {message ? <p className="mt-3 text-sm text-[color:var(--muted)]">{message}</p> : null}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={editingEmail ? handleUpdateUser : handleCreateUser}
            disabled={submitting}
            className="focus-ring rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Saving..." : editingEmail ? "Update user" : activeRole === "doctor" ? "Create doctor" : "Create user"}
          </button>
          {editingEmail ? (
            <button
              type="button"
              onClick={() => resetForm()}
              className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-5 py-2.5 text-sm font-semibold"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white p-5 shadow-sm">
        <h2 className="headline text-2xl font-semibold">{roleTabs.find((tab) => tab.role === activeRole)?.label} users</h2>
        <div className="mt-4 space-y-3">
          {visibleUsers.length === 0 ? (
            <div className="rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2.5 text-sm text-[color:var(--muted)]">No users yet.</div>
          ) : (
            visibleUsers.map((user) => (
              <div key={`${user.role}:${user.email}`} className="flex items-center justify-between rounded-xl bg-[rgba(21,32,43,0.03)] px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={user.photoUrl?.trim() || "https://www.gravatar.com/avatar/?d=identicon&s=96"}
                    alt={user.displayName}
                    className="h-9 w-9 shrink-0 rounded-full border border-[rgba(21,32,43,0.12)] object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{user.displayName}</div>
                    <div className="truncate text-xs text-[color:var(--muted)]">{user.role} · {user.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(user)}
                  className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1.5 text-xs font-semibold"
                >
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
