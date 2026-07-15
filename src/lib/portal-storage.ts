type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const storageKeys = {
	appointments: "sei-appointments",
	patientQuestionnairePrefix: "sei-pq:",
	doctorReviewPrefix: "sei-doctor-review:",
	receptionDraftPrefix: "sei-reception-draft:",
	patientRecordPrefix: "sei-patient-record:",
	patientRecordByPhone: "sei-patient-record-phone:",
	labReportsPrefix: "sei-lab-reports:",
} as const;

export type PatientRecord = {
	id: string;
	patientId: string;           // PT-2026-00001
	phone: string;
	email?: string;
	fullName: string;
	age?: number;
	gender?: string;
	heightCm?: number;
	weightKg?: number;
	bmi?: number;
	region?: string;
	preferredLanguage?: string;
	dailyActivity?: string;
	comorbidities?: string[];
	currentMeds?: string[];
	priorSurgery?: boolean;
	surgeryDetails?: string;
	createdAt: string;
	updatedAt: string;
};

export type LabReportRecord = {
	id: string;
	appointmentId: string;
	patientRecordId?: string;
	fileName: string;
	fileType: string;   // mri-images | mri-report | xray | labs | other
	fileSizeBytes?: number;
	uploadedAt: string;
};

export type AppointmentRecord = {
	sessionId: string;
	consultId?: string;          // CSL-YYYYMMDD-XXXX
	patientRecordId?: string;    // PT-YYYY-NNNNN
	patientName: string;
	patientPhone: string;
	doctorName: string;
	doctorId?: string;
	appointmentDate: string;
	appointmentTime: string;
	appointmentType: string;
	status: string;
	notes: string;
	videoConsultLink?: string;
	preConsultLink?: string;
	preConsultSentAt?: string;
	confirmationSentAt?: string;
	createdAt: string;
	updatedAt: string;
};

export type PatientQuestionnaireRecord = {
	sessionId: string;
	patientPhone?: string;
	answers: Record<string, unknown>;
	sectionIndex: number;
	questionIndex: number;
	submitted: boolean;
	updatedAt: string;
};

export type DoctorReviewRecord = {
	sessionId: string;
	validation: string;
	primaryProblem: string;
	riskLevel: string;
	diagnosis: string;
	mriAvailability: string;
	carePathway: string;
	investigations: string[];
	prescription: string;
	referral: string;
	followUp: string;
	outcome: string;
	notes: string;
	patientSummary: string;
	updatedAt: string;
};

export type ReceptionDraftRecord = {
	sessionId: string;
	patientName: string;
	patientPhone: string;
	doctorName: string;
	appointmentDate: string;
	appointmentTime: string;
	appointmentType: string;
	status: string;
	notes: string;
	updatedAt: string;
};

function canUseStorage() {
	return typeof window !== "undefined";
}

function readJson<T extends JsonValue>(key: string, fallback: T): T {
	if (!canUseStorage()) {
		return fallback;
	}

	const raw = window.localStorage.getItem(key);
	if (!raw) {
		return fallback;
	}

	try {
		return JSON.parse(raw) as T;
	} catch {
		window.localStorage.removeItem(key);
		return fallback;
	}
}

function writeJson(key: string, value: JsonValue) {
	if (!canUseStorage()) {
		return;
	}

	window.localStorage.setItem(key, JSON.stringify(value));
}

function removeKey(key: string) {
	if (!canUseStorage()) {
		return;
	}

	window.localStorage.removeItem(key);
}

export function createSessionId(label: string) {
	const normalized = label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 32);
	return `${normalized || "session"}-${Date.now()}`;
}

export function listAppointments() {
	return readJson<AppointmentRecord[]>(storageKeys.appointments, []);
}

export function saveAppointment(record: AppointmentRecord) {
	const current = listAppointments().filter((item) => item.sessionId !== record.sessionId);
	const next = [record, ...current];
	writeJson(storageKeys.appointments, next);
	return next;
}

export function updateAppointment(sessionId: string, patch: Partial<AppointmentRecord>) {
	const current = listAppointments();
	const next = current.map((item) =>
		item.sessionId === sessionId
			? {
				...item,
				...patch,
				updatedAt: new Date().toISOString(),
			}
			: item,
	);
	writeJson(storageKeys.appointments, next);
	return next;
}

export function loadPatientQuestionnaire(sessionId: string) {
	return readJson<PatientQuestionnaireRecord | null>(`${storageKeys.patientQuestionnairePrefix}${sessionId}`, null);
}

export function savePatientQuestionnaire(record: PatientQuestionnaireRecord) {
	writeJson(`${storageKeys.patientQuestionnairePrefix}${record.sessionId}`, record);
	return record;
}

export function loadDoctorReview(sessionId: string) {
	return readJson<DoctorReviewRecord | null>(`${storageKeys.doctorReviewPrefix}${sessionId}`, null);
}

export function saveDoctorReview(record: DoctorReviewRecord) {
	writeJson(`${storageKeys.doctorReviewPrefix}${record.sessionId}`, record);
	return record;
}

export function loadReceptionDraft(sessionId: string) {
	return readJson<ReceptionDraftRecord | null>(`${storageKeys.receptionDraftPrefix}${sessionId}`, null);
}

export function saveReceptionDraft(record: ReceptionDraftRecord) {
	writeJson(`${storageKeys.receptionDraftPrefix}${record.sessionId}`, record);
	return record;
}

export function clearReceptionDraft(sessionId: string) {
	removeKey(`${storageKeys.receptionDraftPrefix}${sessionId}`);
}

// ── Patient Record helpers ────────────────────────────────────────────────────

function generatePatientId(): string {
	const year = new Date().getFullYear();
	const existing = listAllPatientRecords();
	const seq = String(existing.length + 1).padStart(5, "0");
	return `PT-${year}-${seq}`;
}

function listAllPatientRecords(): PatientRecord[] {
	return readJson<PatientRecord[]>("sei-all-patient-records", []);
}

function persistAllPatientRecords(records: PatientRecord[]) {
	writeJson("sei-all-patient-records", records);
}

export function savePatientRecord(data: Omit<PatientRecord, "id" | "patientId" | "createdAt" | "updatedAt">): PatientRecord {
	const existing = findPatientRecordByPhone(data.phone);
	if (existing) {
		const updated: PatientRecord = {
			...existing,
			...data,
			updatedAt: new Date().toISOString(),
		};
		const all = listAllPatientRecords().map((r) => (r.id === existing.id ? updated : r));
		persistAllPatientRecords(all);
		writeJson(`${storageKeys.patientRecordByPhone}${data.phone}`, updated);
		return updated;
	}

	const record: PatientRecord = {
		id: `pr-${Date.now()}`,
		patientId: generatePatientId(),
		...data,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};
	const all = listAllPatientRecords();
	persistAllPatientRecords([record, ...all]);
	writeJson(`${storageKeys.patientRecordByPhone}${data.phone}`, record);
	return record;
}

export function findPatientRecordByPhone(phone: string): PatientRecord | null {
	const normalized = phone.replace(/\D/g, "");
	if (!normalized) {
		return null;
	}

	const direct = readJson<PatientRecord | null>(`${storageKeys.patientRecordByPhone}${normalized}`, null);
	if (direct) {
		return direct;
	}

	// Backward compatibility: older records may have been keyed by unnormalized phone values.
	const all = listAllPatientRecords();
	const match = all.find((record) => record.phone.replace(/\D/g, "") === normalized) ?? null;
	if (match) {
		writeJson(`${storageKeys.patientRecordByPhone}${normalized}`, match);
	}

	return match;
}

export function findPatientRecordById(patientId: string): PatientRecord | null {
	const all = listAllPatientRecords();
	return all.find((r) => r.patientId === patientId) ?? null;
}

// ── Consult ID generation ─────────────────────────────────────────────────────

export function generateConsultId(): string {
	const d = new Date();
	const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
	const seq = String(Math.floor(Math.random() * 9000) + 1000);
	return `CSL-${date}-${seq}`;
}

// ── Lab Report helpers ────────────────────────────────────────────────────────

export function loadLabReports(appointmentId: string): LabReportRecord[] {
	return readJson<LabReportRecord[]>(`${storageKeys.labReportsPrefix}${appointmentId}`, []);
}

export function saveLabReport(report: Omit<LabReportRecord, "id" | "uploadedAt">): LabReportRecord {
	const record: LabReportRecord = {
		id: `lr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		...report,
		uploadedAt: new Date().toISOString(),
	};
	const current = loadLabReports(report.appointmentId);
	writeJson(`${storageKeys.labReportsPrefix}${report.appointmentId}`, [record, ...current]);
	return record;
}

export function removeLabReport(appointmentId: string, reportId: string) {
	const current = loadLabReports(appointmentId).filter((r) => r.id !== reportId);
	writeJson(`${storageKeys.labReportsPrefix}${appointmentId}`, current);
}