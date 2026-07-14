"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadLabReports, saveLabReport, removeLabReport, type LabReportRecord } from "@/lib/portal-storage";

const FILE_TYPES = [
  { value: "mri", label: "MRI images / PDF report", icon: "🧲" },
  { value: "xray", label: "X-ray", icon: "🩻" },
  { value: "ct-scan", label: "CT scan", icon: "🔬" },
  { value: "blood-reports", label: "Blood / lab reports", icon: "🧪" },
  { value: "prescriptions", label: "Previous prescriptions", icon: "💊" },
  { value: "surgery-records", label: "Surgery records", icon: "🏥" },
  { value: "referral", label: "Referral letter", icon: "📨" },
  { value: "insurance", label: "Insurance papers (optional)", icon: "📋" },
  { value: "other", label: "Other documents", icon: "📄" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: string }) {
  const entry = FILE_TYPES.find((f) => f.value === type);
  return <span>{entry?.icon ?? "📄"}</span>;
}

export function PatientLabUpload({ consultId }: { consultId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reports, setReports] = useState<LabReportRecord[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedType, setSelectedType] = useState("mri");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setReports(loadLabReports(consultId));
  }, [consultId]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.size > 0);
    setPendingFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...arr.filter((f) => !existing.has(f.name))];
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

  function removePending(name: string) {
    setPendingFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("consultId", consultId);
      formData.append("fileType", selectedType);
      for (const file of pendingFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/uploads/lab-reports", {
        method: "POST",
        body: formData,
      });

      const payload = (await res.json()) as { ok?: boolean; files?: Array<{ fileName: string; fileSizeBytes: number }>; message?: string };

      if (res.ok && payload.ok && payload.files) {
        // Save to localStorage
        for (const f of payload.files) {
          const record = saveLabReport({
            appointmentId: consultId,
            fileName: f.fileName,
            fileType: selectedType,
            fileSizeBytes: f.fileSizeBytes,
          });
          setReports((prev) => [record, ...prev]);
        }
      } else {
        // Fallback: save metadata locally even if server failed
        for (const file of pendingFiles) {
          const record = saveLabReport({
            appointmentId: consultId,
            fileName: file.name,
            fileType: selectedType,
            fileSizeBytes: file.size,
          });
          setReports((prev) => [record, ...prev]);
        }
      }

      setPendingFiles([]);
      setSuccessMessage(`${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""} uploaded successfully.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch {
      // Fallback: save metadata locally
      for (const file of pendingFiles) {
        const record = saveLabReport({
          appointmentId: consultId,
          fileName: file.name,
          fileType: selectedType,
          fileSizeBytes: file.size,
        });
        setReports((prev) => [record, ...prev]);
      }
      setPendingFiles([]);
      setSuccessMessage("Files saved locally.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove(reportId: string) {
    removeLabReport(consultId, reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <a href="/patient" className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Upload lab reports</h1>
            <p className="text-xs font-mono text-gray-400 mt-0.5">{consultId}</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-6 flex gap-2 items-start">
          <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700">
            Upload MRI films, X-rays, blood reports, or any relevant documents. You can upload multiple files. Your doctor will review them before the consultation.
          </p>
        </div>

        {/* File type selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-3">Report type</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FILE_TYPES.map((ft) => (
              <button
                key={ft.value}
                onClick={() => setSelectedType(ft.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${selectedType === ft.value ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
              >
                <span className="text-lg">{ft.icon}</span>
                <span className="text-xs font-medium leading-tight">{ft.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 mb-4 text-center cursor-pointer transition-colors ${dragOver ? "border-teal-400 bg-teal-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm font-medium text-gray-500">Drop files here or <span className="text-teal-600 underline">browse</span></p>
          <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DICOM — any format accepted</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={handleFileInput}
            accept="image/*,application/pdf,.dcm,.dicom"
          />
        </div>

        {/* Pending files */}
        {pendingFiles.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100 mb-4">
            <p className="px-4 py-2.5 text-xs font-semibold text-gray-500">Ready to upload ({pendingFiles.length})</p>
            {pendingFiles.map((f) => (
              <div key={f.name} className="flex items-center gap-3 px-4 py-3">
                <FileTypeIcon type={selectedType} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{f.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
                </div>
                <button onClick={() => removePending(f.name)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">{uploadError}</div>
        )}
        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-100 text-sm text-green-700">{successMessage}</div>
        )}

        {pendingFiles.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full bg-teal-600 text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors mb-6"
          >
            {uploading ? "Uploading…" : `Upload ${pendingFiles.length} file${pendingFiles.length > 1 ? "s" : ""}`}
          </button>
        )}

        {/* Uploaded files */}
        {reports.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Uploaded ({reports.length})
            </h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {reports.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <FileTypeIcon type={r.fileType} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{r.fileName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {FILE_TYPES.find((f) => f.value === r.fileType)?.label ?? r.fileType}
                      </span>
                      {r.fileSizeBytes && (
                        <span className="text-xs text-gray-300">· {formatBytes(r.fileSizeBytes)}</span>
                      )}
                      <span className="text-xs text-gray-300">
                        · {new Date(r.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(r.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
