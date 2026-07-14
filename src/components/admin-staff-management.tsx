"use client";

import { useEffect, useState } from "react";

type StaffRole = "receptionist" | "admin";

type StaffUser = {
  id?: string;
  role: StaffRole;
  email: string;
  displayName: string;
  photoUrl?: string;
  createdAt: string;
};

type DoctorOption = { id: string; name: string; registrationNumber: string };

function ReceptionistAssignments({ receptionistEmail }: { receptionistEmail: string }) {
  const [allDoctors, setAllDoctors] = useState<DoctorOption[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // Load all doctors
    fetch("/api/doctors", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; doctors?: DoctorOption[] }) => setAllDoctors(d.doctors ?? []))
      .catch(() => {});

    // Load existing assignments
    fetch(`/api/receptionist-assignments?receptionistEmail=${encodeURIComponent(receptionistEmail)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; assignments?: Array<{ doctorProfile?: { id: string } }> }) => {
        const ids = new Set<string>((d.assignments ?? []).map((a) => a.doctorProfile?.id ?? "").filter(Boolean));
        setAssignedIds(ids);
      })
      .catch(() => {});
  }, [receptionistEmail]);

  async function toggle(doctorId: string) {
    setSaving(doctorId);
    setMsg("");
    const isAssigned = assignedIds.has(doctorId);
    try {
      if (isAssigned) {
        // Get receptionist userId first
        const res = await fetch(`/api/receptionist-assignments?receptionistEmail=${encodeURIComponent(receptionistEmail)}&doctorProfileId=${doctorId}`, { method: "DELETE" });
        if (res.ok) setAssignedIds((prev) => { const n = new Set(prev); n.delete(doctorId); return n; });
        else setMsg("Could not remove assignment.");
      } else {
        // We need receptionistId — look it up via staff-users or pass email
        const res = await fetch("/api/receptionist-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receptionistEmail, doctorProfileId: doctorId }),
        });
        const data = (await res.json()) as { ok?: boolean; message?: string };
        if (res.ok && data.ok) setAssignedIds((prev) => new Set([...prev, doctorId]));
        else setMsg(data.message ?? "Could not assign doctor.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setSaving(null);
    }
  }

  if (allDoctors.length === 0) {
    return <p className="text-xs text-[color:var(--muted)] mt-2">No doctors in system yet.</p>;
  }

  return (
    <div className="mt-3 border-t border-[rgba(21,32,43,0.08)] pt-3">
      <p className="text-xs font-semibold text-gray-600 mb-2">Assigned doctors</p>
      <div className="space-y-1.5">
        {allDoctors.map((doc) => {
          const checked = assignedIds.has(doc.id);
          return (
            <label key={doc.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${checked ? "border-teal-400 bg-teal-50" : "border-gray-200 hover:border-gray-300"}`}>
              <input
                type="checkbox"
                checked={checked}
                disabled={saving === doc.id}
                onChange={() => toggle(doc.id)}
                className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-700">{doc.name}</span>
              {doc.registrationNumber && <span className="text-xs text-gray-400 ml-auto">{doc.registrationNumber}</span>}
            </label>
          );
        })}
      </div>
      {msg && <p className="text-xs text-red-600 mt-1">{msg}</p>}
    </div>
  );
}

const initialForm = {
  email: "",
  displayName: "",
  password: "",
  photoUrl: "",
};

const ROLES: Array<{ role: StaffRole; label: string; color: string }> = [
  { role: "receptionist", label: "Receptionists", color: "bg-blue-600" },
  { role: "admin", label: "Admins", color: "bg-purple-600" },
];

type SectionForm = {
  email: string;
  displayName: string;
  password: string;
  photoUrl: string;
};

const emptyForm: SectionForm = { email: "", displayName: "", password: "", photoUrl: "" };

// ── Doctor picker shown inside the receptionist add/edit form ─────────────────
function DoctorPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  useEffect(() => {
    fetch("/api/doctors", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; doctors?: DoctorOption[] }) => setDoctors(d.doctors ?? []))
      .catch(() => {});
  }, []);

  if (doctors.length === 0) {
    return <p className="text-xs text-[color:var(--muted)]">No doctors in system yet.</p>;
  }

  return (
    <div className="space-y-1.5">
      {doctors.map((doc) => {
        const checked = selected.includes(doc.id);
        return (
          <label
            key={doc.id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${checked ? "border-teal-400 bg-teal-50" : "border-gray-200 hover:border-gray-300"}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? selected.filter((id) => id !== doc.id) : [...selected, doc.id])}
              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-gray-700 flex-1">{doc.name}</span>
            {doc.registrationNumber && <span className="text-xs text-gray-400">{doc.registrationNumber}</span>}
          </label>
        );
      })}
    </div>
  );
}

function UserForm({
  role,
  editingEmail,
  form,
  setForm,
  submitting,
  message,
  selectedDoctorIds,
  onDoctorSelectionChange,
  onSave,
  onCancel,
}: {
  role: StaffRole;
  editingEmail: string | null;
  form: SectionForm;
  setForm: (f: SectionForm) => void;
  submitting: boolean;
  message: string;
  selectedDoctorIds: string[];
  onDoctorSelectionChange: (ids: string[]) => void;
  onSave: (photoFile: File | null) => void;
  onCancel: () => void;
}) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [localMsg, setLocalMsg] = useState("");

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setLocalMsg("Image must be 5 MB or smaller"); e.target.value = ""; return; }
    setPhotoFile(file);
    setForm({ ...form, photoUrl: URL.createObjectURL(file) });
    setLocalMsg("");
  }

  const resolvedAvatar = form.photoUrl?.trim() || "https://www.gravatar.com/avatar/?d=identicon&s=96";

  return (
    <div className="mt-3 border-t border-[rgba(21,32,43,0.06)] pt-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">
        {editingEmail ? `Edit — ${editingEmail}` : `Add ${role}`}
      </p>

      {/* Avatar upload */}
      <div className="flex items-center gap-3 rounded-xl border border-[rgba(21,32,43,0.10)] bg-[rgba(21,32,43,0.02)] px-3 py-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={resolvedAvatar} alt="Preview" className="h-10 w-10 rounded-full object-cover border border-white shadow-sm" />
        <div className="flex-1">
          <p className="text-xs text-[color:var(--muted)] mb-1">Profile photo (optional)</p>
          <input type="file" accept="image/*" onChange={handlePhotoChange} className="block w-full text-xs" />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          placeholder="Display name"
          className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 text-sm outline-none"
        />
        <input
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder={`${role} email`}
          disabled={Boolean(editingEmail)}
          className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 text-sm outline-none disabled:opacity-60"
        />
        <input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder={editingEmail ? "New password (leave blank to keep)" : "Password (min 8 chars)"}
          className="focus-ring sm:col-span-2 rounded-xl border border-[rgba(21,32,43,0.12)] px-3 py-2.5 text-sm outline-none"
        />
      </div>

      {/* Doctor assignments — shown for receptionists */}
      {role === "receptionist" && (
        <div className="rounded-xl border border-[rgba(21,32,43,0.10)] bg-blue-50/40 p-3">
          <p className="text-xs font-semibold text-gray-600 mb-2">Assign doctors to this receptionist</p>
          <DoctorPicker selected={selectedDoctorIds} onChange={onDoctorSelectionChange} />
        </div>
      )}

      {(message || localMsg) && (
        <p className="text-sm text-[color:var(--muted)]">{localMsg || message}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(photoFile)}
          disabled={submitting}
          className="focus-ring rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Saving…" : editingEmail ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => { onCancel(); setPhotoFile(null); }}
          className="focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-4 py-2 text-sm font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RoleSection({
  role,
  label,
  colorClass,
  users,
  reloadUsers,
}: {
  role: StaffRole;
  label: string;
  colorClass: string;
  users: StaffUser[];
  reloadUsers: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<SectionForm>(emptyForm);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const roleUsers = users.filter((u) => u.role === role).sort((a, b) => a.email.localeCompare(b.email));
  const adminLimitReached = role === "admin" && roleUsers.length >= 1;

  function openAdd() {
    setEditingEmail(null);
    setForm(emptyForm);
    setSelectedDoctorIds([]);
    setMessage("");
    setShowAddForm(true);
  }
  function openEdit(user: StaffUser) {
    setEditingEmail(user.email);
    setForm({ email: user.email, displayName: user.displayName, password: "", photoUrl: user.photoUrl ?? "" });
    setSelectedDoctorIds([]);
    setMessage("");
    setShowAddForm(true);
  }
  function cancelForm() {
    setEditingEmail(null);
    setShowAddForm(false);
    setForm(emptyForm);
    setSelectedDoctorIds([]);
    setMessage("");
  }

  async function handleSave(photoFile: File | null) {
    if (!editingEmail && (!form.email.trim() || !form.displayName.trim() || !form.password.trim())) {
      setMessage("Email, display name, and password are required."); return;
    }
    if (!editingEmail && form.password.length < 8) { setMessage("Password must be at least 8 characters."); return; }
    if (editingEmail && form.password && form.password.length < 8) { setMessage("Password must be at least 8 characters."); return; }

    setSubmitting(true);
    setMessage("");

    try {
      let resolvedPhotoUrl = form.photoUrl.trim();
      if (photoFile) {
        const fd = new FormData();
        fd.append("file", photoFile);
        const up = await fetch("/api/uploads/staff-photo", { method: "POST", body: fd });
        const upPayload = (await up.json()) as { ok: boolean; photoUrl?: string; message?: string };
        if (!up.ok || !upPayload.ok || !upPayload.photoUrl) { setMessage(upPayload.message ?? "Photo upload failed."); return; }
        resolvedPhotoUrl = upPayload.photoUrl;
      }

      const resolvedEmail = editingEmail ?? form.email.trim().toLowerCase();

      const res = await fetch("/api/staff-users", {
        method: editingEmail ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          email: resolvedEmail,
          displayName: form.displayName.trim(),
          password: form.password.trim() || undefined,
          photoUrl: resolvedPhotoUrl,
        }),
      });
      const payload = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !payload.ok) { setMessage(payload.message ?? "Could not save."); return; }

      // For new receptionists: immediately create doctor assignments
      if (role === "receptionist" && !editingEmail && selectedDoctorIds.length > 0) {
        await Promise.all(
          selectedDoctorIds.map((doctorProfileId) =>
            fetch("/api/receptionist-assignments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ receptionistEmail: resolvedEmail, doctorProfileId }),
            }).catch(() => {}),
          ),
        );
      }

      setMessage(editingEmail ? "Updated successfully." : "Created successfully.");
      cancelForm();
      await reloadUsers();
    } catch {
      setMessage("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-[rgba(21,32,43,0.08)] bg-white shadow-sm overflow-hidden">
      {/* Section header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); if (showAddForm) cancelForm(); }}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[rgba(21,32,43,0.02)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white ${colorClass}`}>
            {label.charAt(0)}
          </span>
          <div>
            <p className="text-base font-semibold text-gray-900">{label}</p>
            <p className="text-xs text-[color:var(--muted)]">
              {roleUsers.length === 0 ? "No accounts yet" : `${roleUsers.length} account${roleUsers.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5">
          {/* Existing users */}
          <div className="space-y-2 mb-4">
            {roleUsers.length === 0 ? (
              <p className="text-sm text-[color:var(--muted)] py-2">No {label.toLowerCase()} added yet.</p>
            ) : (
              roleUsers.map((user) => (
                <div key={user.email} className="rounded-xl border border-[rgba(21,32,43,0.08)] overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={user.photoUrl?.trim() || `https://www.gravatar.com/avatar/${user.email}?d=identicon&s=64`}
                      alt={user.displayName}
                      className="h-9 w-9 shrink-0 rounded-full object-cover border border-white shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{user.displayName}</p>
                      <p className="text-xs text-[color:var(--muted)] truncate">{user.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="shrink-0 focus-ring rounded-full border border-[rgba(21,32,43,0.14)] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </div>
                  {/* Doctor assignments shown inside each receptionist card */}
                  {role === "receptionist" && (
                    <div className="px-3 pb-3">
                      <ReceptionistAssignments receptionistEmail={user.email} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add / Edit form */}
          {showAddForm ? (
            <UserForm
              role={role}
              editingEmail={editingEmail}
              form={form}
              setForm={setForm}
              submitting={submitting}
              message={message}
              selectedDoctorIds={selectedDoctorIds}
              onDoctorSelectionChange={setSelectedDoctorIds}
              onSave={handleSave}
              onCancel={cancelForm}
            />
          ) : adminLimitReached ? (
            <p className="text-xs text-[color:var(--muted)] py-2 text-center">
              Only one admin account is allowed. Edit the existing admin to make changes.
            </p>
          ) : (
            <button
              type="button"
              onClick={openAdd}
              className="focus-ring w-full rounded-xl border-2 border-dashed border-[rgba(21,32,43,0.12)] px-4 py-3 text-sm font-medium text-[color:var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              + Add {role}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminStaffManagement() {
  const [users, setUsers] = useState<StaffUser[]>([]);

  async function loadUsers() {
    try {
      const response = await fetch("/api/staff-users", { cache: "no-store" });
      const payload = (await response.json()) as { ok: boolean; users?: StaffUser[]; message?: string };
      if (response.ok && payload.ok) setUsers(payload.users ?? []);
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, []);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="headline text-2xl font-semibold">Staff accounts</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Expand a role section to view, add, or edit accounts. Doctor accounts are managed in the Doctor section above.
        </p>
      </div>
      {ROLES.map(({ role, label, color }) => (
        <RoleSection
          key={role}
          role={role}
          label={label}
          colorClass={color}
          users={users}
          reloadUsers={loadUsers}
        />
      ))}
    </section>
  );
}

