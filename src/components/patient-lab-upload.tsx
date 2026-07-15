"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UploadedReport = {
  id: string;
  appointmentId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes?: number | null;
  storedPath?: string | null;
  uploadedAt: string;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg"]);
const ALLOWED_FILE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/jpg"]);

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function isAllowedFile(file: File) {
  const extension = getFileExtension(file.name);
  const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.has(extension);
  const normalizedMimeType = file.type.toLowerCase();
  const hasAllowedMimeType = !normalizedMimeType || ALLOWED_FILE_MIME_TYPES.has(normalizedMimeType);
  return hasAllowedExtension && hasAllowedMimeType;
}

const FILE_TYPES = [
  { value: "mri", label: "MRI images / PDF report", icon: "M" },
  { value: "xray", label: "X-ray", icon: "X" },
  { value: "ct-scan", label: "CT scan", icon: "C" },
  { value: "blood-reports", label: "Blood / lab reports", icon: "B" },
  { value: "prescriptions", label: "Previous prescriptions", icon: "P" },
  { value: "surgery-records", label: "Surgery records", icon: "S" },
  { value: "referral", label: "Referral letter", icon: "R" },
  { value: "insurance", label: "Insurance papers (optional)", icon: "I" },
  { value: "other", label: "Other documents", icon: "D" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: string }) {
  const entry = FILE_TYPES.find((f) => f.value === type);
  return <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-600">{entry?.icon ?? "D"}</span>;
}

export function PatientLabUpload({
  consultId,
  patientPhone,
  backHref = "/patient",
}: {
  consultId?: string;
  patientPhone?: string;
  backHref?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reports, setReports] = useState<UploadedReport[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedType, setSelectedType] = useState("mri");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingReports, setLoadingReports] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadReports() {
      setLoadingReports(true);
      setUploadError("");

      const query = new URLSearchParams();
      if (consultId) {
        query.set("consultId", consultId);
      } else if (patientPhone) {
        query.set("patientPhone", patientPhone);
      }

      if (!query.toString()) {
        if (active) {
          setReports([]);
          setLoadingReports(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/uploads/lab-reports?${query.toString()}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; reports?: UploadedReport[]; message?: string } | null;

        if (!active) {
          return;
        }

        if (!response.ok || !payload?.ok) {
          setReports([]);
          setUploadError(payload?.message ?? "Could not load uploaded reports.");
          return;
        }

        setReports(payload.reports ?? []);
      } catch {
        if (active) {
          setReports([]);
          setUploadError("Could not load uploaded reports.");
        }
      } finally {
        if (active) {
          setLoadingReports(false);
        }
      }
    }

    void loadReports();

    return () => {
      active = false;
    };
  }, [consultId, patientPhone]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.size > 0);
    const unsupported = arr.find((file) => !isAllowedFile(file));
    if (unsupported) {
      setUploadError(`\"${unsupported.name}\" is not supported. Only PDF and JPEG are allowed.`);
      return;
    }

    const oversized = arr.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      setUploadError(`\"${oversized.name}\" exceeds 5 MB limit.`);
      return;
    }

    setUploadError("");
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}:${f.size}`));
      return [...prev, ...arr.filter((f) => !existing.has(`${f.name}:${f.size}`))];
    });
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  }

  function removePending(name: string, size: number) {
    setPendingFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      if (consultId) {
        formData.append("consultId", consultId);
      }
      if (patientPhone) {
        formData.append("patientPhone", patientPhone);
      }
      formData.append("fileType", selectedType);
      for (const file of pendingFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/uploads/lab-reports", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json()) as { ok?: boolean; reports?: UploadedReport[]; message?: string };

      if (!res.ok || !payload.ok) {
        setUploadError(payload.message ?? "Could not upload files.");
        return;
      }

      setReports((prev) => [...(payload.reports ?? []), ...prev]);
      setPendingFiles([]);
      setSuccessMessage(`${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} uploaded successfully.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch {
      setUploadError("Could not upload files. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <a href={backHref} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Upload documents</h1>
            {consultId ? <p className="text-xs font-mono text-gray-400 mt-0.5">{consultId}</p> : null}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-6 flex gap-2 items-start">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700">
            Upload MRI films, X-rays, blood reports, and previous records. Files are saved on server and visible to doctors in patient details.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Document type</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FILE_TYPES.map((ft) => (
              <button
                key={ft.value}
                type="button"
                onClick={() => setSelectedType(ft.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${selectedType === ft.value ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-xs font-semibold text-gray-600">{ft.icon}</span>
                <span className="text-xs font-medium leading-tight">{ft.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-8 mb-4 text-center cursor-pointer transition-colors ${dragOver ? "border-teal-400 bg-teal-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm font-medium text-gray-500">Drop files here or <span className="text-teal-600 underline">browse</span></p>
          <p className="text-xs text-gray-400 mt-1">PDF or JPEG only - max 5 MB per file</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={handleFileInput}
            accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg"
          />
        </div>

        {pendingFiles.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 mb-4">
            <p className="px-4 py-2.5 text-xs font-semibold text-gray-500">Ready to upload ({pendingFiles.length})</p>
            {pendingFiles.map((f) => (
              <div key={`${f.name}:${f.size}`} className="flex items-center gap-3 px-4 py-3">
                <FileTypeIcon type={selectedType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{f.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
                </div>
                <button type="button" onClick={() => removePending(f.name, f.size)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadError && <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{uploadError}</div>}
        {successMessage && <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-100 text-sm text-green-700">{successMessage}</div>}

        {pendingFiles.length > 0 && (
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-teal-600 text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors mb-6"
          >
            {uploading ? "Uploading..." : `Upload ${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}`}
          </button>
        )}

        {loadingReports ? (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading uploaded files...</div>
        ) : reports.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Uploaded ({reports.length})</h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <FileTypeIcon type={r.fileType} />
                  <div className="flex-1 min-w-0">
                    {r.storedPath ? (
                      <a href={r.storedPath} target="_blank" rel="noreferrer" className="text-sm text-teal-700 hover:underline break-all">
                        {r.fileName}
                      </a>
                    ) : (
                      <p className="text-sm text-gray-700 truncate">{r.fileName}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{FILE_TYPES.find((f) => f.value === r.fileType)?.label ?? r.fileType}</span>
                      {typeof r.fileSizeBytes === "number" && r.fileSizeBytes > 0 ? <span className="text-xs text-gray-300">- {formatBytes(r.fileSizeBytes)}</span> : null}
                      <span className="text-xs text-gray-300">- {new Date(r.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {r.storedPath ? (
                    <a href={r.storedPath} target="_blank" rel="noreferrer" className="text-xs font-medium text-teal-700 hover:underline">
                      Open
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">No documents uploaded yet.</div>
        )}
      </div>
    </div>
  );
}
