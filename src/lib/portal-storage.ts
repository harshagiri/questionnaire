type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const storageKeys = {
	appointments: "sei-appointments",
	patientQuestionnairePrefix: "sei-pq:",
	doctorReviewPrefix: "sei-doctor-review:",
	receptionDraftPrefix: "sei-reception-draft:",
} as const;

export type AppointmentRecord = {
	sessionId: string;
	patientName: string;
	patientPhone: string;
	doctorName: string;
	appointmentDate: string;
	appointmentTime: string;
	appointmentType: string;
	status: string;
	notes: string;
	createdAt: string;
	updatedAt: string;
};

export type PatientQuestionnaireRecord = {
	sessionId: string;
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