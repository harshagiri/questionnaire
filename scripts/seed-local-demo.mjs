import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const today = new Date();
const todayDate = new Date(`${today.toISOString().slice(0, 10)}T09:00:00.000Z`);

const patientQuestionnaire = {
  slug: "sei-pq-v3-final",
  title: "SpinExpert patient spine intake",
  subtitle: "Pre-consult spine health assessment",
  version: 4,
  audience: ["patient", "doctor"],
};

const doctorQuestionnaire = {
  slug: "sei-doctor-consult-v1",
  title: "Doctor consultation questionnaire",
  subtitle: "A sectioned clinical review flow for validating, reviewing, and planning care.",
  version: 1,
  audience: ["doctor"],
};

const doctors = [
  {
    email: "meera@spinexpert.local",
    displayName: "Dr Meera Nair",
    phone: "9000011111",
    registrationNumber: "MCI-MN-1001",
    licenseNumber: "LIC-MN-1001",
    bio: "Spine surgeon - cervical and lumbar disorders",
    slots: [
      { dayOfWeek: 1, startTime: "09:30", slotDurationMinutes: 30 },
      { dayOfWeek: 1, startTime: "10:00", slotDurationMinutes: 30 },
      { dayOfWeek: 2, startTime: "11:00", slotDurationMinutes: 30 },
      { dayOfWeek: 4, startTime: "15:00", slotDurationMinutes: 30 },
    ],
  },
  {
    email: "arjun@spinexpert.local",
    displayName: "Dr Arjun Rao",
    phone: "9000022222",
    registrationNumber: "MCI-AR-1002",
    licenseNumber: "LIC-AR-1002",
    bio: "Spine and pain specialist",
    slots: [
      { dayOfWeek: 1, startTime: "14:00", slotDurationMinutes: 30 },
      { dayOfWeek: 3, startTime: "09:00", slotDurationMinutes: 30 },
      { dayOfWeek: 5, startTime: "10:30", slotDurationMinutes: 30 },
    ],
  },
  {
    email: "kavya@spinexpert.local",
    displayName: "Dr Kavya Iyer",
    phone: "9000033333",
    registrationNumber: "MCI-KI-1003",
    licenseNumber: "LIC-KI-1003",
    bio: "Minimally invasive spine care",
    slots: [
      { dayOfWeek: 2, startTime: "10:00", slotDurationMinutes: 30 },
      { dayOfWeek: 4, startTime: "09:30", slotDurationMinutes: 30 },
      { dayOfWeek: 6, startTime: "12:00", slotDurationMinutes: 30 },
    ],
  },
];

const receptionist = {
  email: "frontdesk@spinexpert.local",
  displayName: "Frontdesk One",
  phone: "9000099999",
};

const admin = {
  email: "admin.local@spinexpert.local",
  displayName: "Local Admin",
};

const patients = [
  {
    fullName: "Rohit Sharma",
    phone: "9880011111",
    email: "rohit.demo@patient.local",
    age: 38,
    gender: "male",
    region: "Bengaluru",
    preferredLanguage: "english",
    bmi: 27.1,
    consultSessionId: "DEMO-ROHIT-001",
    consultId: "CSL-DEMO-0001",
    appointmentTime: "09:30",
    appointmentType: "new",
    status: "waiting",
    doctorIndex: 0,
    intakeStatus: "submitted",
    answers: {
      patientName: "Rohit Sharma",
      phone: "9880011111",
      age: 38,
      gender: "male",
      region: "bengaluru",
      q1PrimaryReason: "back-pain",
      q2PainRegion: ["lower-back", "right-leg"],
      q6VasPain: 7,
      q7PainPattern: "constant",
      q8Trend: "slowly-worse",
      q9RadiatingPain: "frequent",
      q10Numbness: "occasional",
      q11Weakness: "mild",
      odiPainIntensity: "3",
      odiPersonalCare: "2",
      odiLifting: "3",
      odiWalking: "2",
      odiSitting: "3",
      odiStanding: "3",
      odiSleeping: "2",
      odiSexLife: "2",
      odiSocialLife: "2",
      odiTravelling: "2",
    },
    doctorAnswers: {
      summaryValidation: "clinically-accurate",
      consultationType: "new-consultation",
      clinicalDiagnosis: "degenerative",
      carePathway: "pathway-2",
      odiPercent: 48,
      vasPainScore: 7,
      qualityOfLifeScore: 4,
      mriRequiredStage: "yes",
      surgeryIndicatedStage: "no",
      followUpReview: "6-weeks",
      followUpMode: "physical-consultation",
    },
  },
  {
    fullName: "Sneha Patel",
    phone: "9880022222",
    email: "sneha.demo@patient.local",
    age: 31,
    gender: "female",
    region: "Pune",
    preferredLanguage: "english",
    bmi: 23.9,
    consultSessionId: "DEMO-SNEHA-002",
    consultId: "CSL-DEMO-0002",
    appointmentTime: "10:00",
    appointmentType: "new",
    status: "booked",
    doctorIndex: 1,
    intakeStatus: "submitted",
    answers: {
      patientName: "Sneha Patel",
      phone: "9880022222",
      age: 31,
      gender: "female",
      region: "pune",
      q1PrimaryReason: "neck-pain",
      q2PainRegion: ["neck", "left-arm"],
      q6VasPain: 6,
      q7PainPattern: "activity",
      q8Trend: "stable",
      q9RadiatingPain: "occasional",
      q10Numbness: "frequent",
      q11Weakness: "mild",
      ndiPainIntensity: "2",
      ndiPersonalCare: "1",
      ndiLifting: "2",
      ndiReading: "2",
      ndiHeadaches: "3",
      ndiConcentration: "2",
      ndiWork: "2",
      ndiDriving: "1",
      ndiSleeping: "2",
      ndiRecreation: "2",
    },
    doctorAnswers: {
      summaryValidation: "partially-accurate",
      consultationType: "new-consultation",
      clinicalDiagnosis: "radiculopathy",
      carePathway: "pathway-3",
      ndiPercent: 38,
      vasPainScore: 6,
      qualityOfLifeScore: 5,
      mriRequiredStage: "yes",
      surgeryIndicatedStage: "no",
      followUpReview: "2-weeks",
      followUpMode: "teleconsult",
    },
  },
  {
    fullName: "Manoj Verma",
    phone: "9880033333",
    email: "manoj.demo@patient.local",
    age: 46,
    gender: "male",
    region: "Hyderabad",
    preferredLanguage: "hindi",
    bmi: 29.3,
    consultSessionId: "DEMO-MANOJ-003",
    consultId: "CSL-DEMO-0003",
    appointmentTime: "10:30",
    appointmentType: "follow-up",
    status: "submitted",
    doctorIndex: 2,
    intakeStatus: "submitted",
    answers: {
      patientName: "Manoj Verma",
      phone: "9880033333",
      age: 46,
      gender: "male",
      region: "hyderabad",
      q1PrimaryReason: "back-pain",
      q2PainRegion: ["lower-back"],
      q6VasPain: 4,
      q7PainPattern: "intermittent",
      q8Trend: "improving",
      q9RadiatingPain: "no",
      q10Numbness: "none",
      q11Weakness: "none",
      odiPainIntensity: "1",
      odiPersonalCare: "1",
      odiLifting: "1",
      odiWalking: "1",
      odiSitting: "1",
      odiStanding: "1",
      odiSleeping: "1",
      odiSexLife: "1",
      odiSocialLife: "1",
      odiTravelling: "1",
    },
    doctorAnswers: {
      summaryValidation: "clinically-accurate",
      consultationType: "follow-up-consultation",
      clinicalDiagnosis: "mechanical-pain",
      carePathway: "pathway-2",
      odiPercent: 20,
      vasPainScore: 4,
      qualityOfLifeScore: 7,
      mriRequiredStage: "no",
      surgeryIndicatedStage: "no",
      followUpReview: "3-months",
      followUpMode: "teleconsult",
    },
  },
  {
    fullName: "Asha Menon",
    phone: "9880044444",
    email: "asha.demo@patient.local",
    age: 57,
    gender: "female",
    region: "Chennai",
    preferredLanguage: "english",
    bmi: 26.2,
    consultSessionId: "DEMO-ASHA-004",
    consultId: "CSL-DEMO-0004",
    appointmentTime: "11:00",
    appointmentType: "teleconsult",
    status: "follow_up",
    doctorIndex: 0,
    intakeStatus: "draft",
    answers: {
      patientName: "Asha Menon",
      phone: "9880044444",
      age: 57,
      gender: "female",
      region: "chennai",
      q1PrimaryReason: "neck-pain",
      q2PainRegion: ["neck"],
      q6VasPain: 8,
      q7PainPattern: "night",
      q8Trend: "rapidly-worse",
      q9RadiatingPain: "frequent",
      q10Numbness: "constant",
      q11Weakness: "moderate",
      ndiPainIntensity: "4",
      ndiPersonalCare: "3",
      ndiLifting: "4",
      ndiReading: "4",
      ndiHeadaches: "4",
      ndiConcentration: "3",
      ndiWork: "4",
      ndiDriving: "3",
      ndiSleeping: "4",
      ndiRecreation: "4",
    },
    doctorAnswers: {
      summaryValidation: "needs-correction",
      consultationType: "follow-up-consultation",
      clinicalDiagnosis: "cervical-myelopathy",
      carePathway: "pathway-4",
      ndiPercent: 74,
      vasPainScore: 8,
      qualityOfLifeScore: 3,
      mriRequiredStage: "yes",
      surgeryIndicatedStage: "yes",
      followUpReview: "2-weeks",
      followUpMode: "physical-consultation",
    },
  },
];

function inferInstrument(primaryReason) {
  const neckReasons = new Set(["neck-pain", "arm-pain", "numbness", "weakness", "walking-difficulty"]);
  return neckReasons.has(primaryReason) ? "NDI" : "ODI";
}

function computePromAudit(answers) {
  const instrument = inferInstrument(answers.q1PrimaryReason);
  const keys =
    instrument === "NDI"
      ? [
          "ndiPainIntensity",
          "ndiPersonalCare",
          "ndiLifting",
          "ndiReading",
          "ndiHeadaches",
          "ndiConcentration",
          "ndiWork",
          "ndiDriving",
          "ndiSleeping",
          "ndiRecreation",
        ]
      : [
          "odiPainIntensity",
          "odiPersonalCare",
          "odiLifting",
          "odiWalking",
          "odiSitting",
          "odiStanding",
          "odiSleeping",
          "odiSexLife",
          "odiSocialLife",
          "odiTravelling",
        ];

  const scores = keys
    .map((key) => {
      const raw = answers[key];
      const num = typeof raw === "number" ? raw : Number(raw);
      if (Number.isFinite(num) && num >= 0 && num <= 5) {
        return { key, score: num };
      }
      return { key, score: null };
    });

  const answered = scores.filter((x) => x.score !== null);
  const totalScore = answered.reduce((sum, x) => sum + x.score, 0);
  const maxScore = answered.length * 5;
  const percent = maxScore > 0 ? Math.round(((totalScore / maxScore) * 100) * 10) / 10 : null;

  let severity = "Not enough data";
  if (percent !== null) {
    if (percent <= 20) severity = "Minimal";
    else if (percent <= 40) severity = "Moderate";
    else if (percent <= 60) severity = "Severe";
    else if (percent <= 80) severity = "Crippling";
    else severity = "Bed-bound / exaggeration";
  }

  return {
    version: "prom-v1-strict",
    generatedAt: new Date().toISOString(),
    instrument,
    totalScore,
    answeredItems: answered.length,
    expectedItems: 10,
    maxScore,
    percent,
    severity,
    isComplete: answered.length === 10,
    itemScores: scores,
  };
}

async function ensureQuestionnaire(def) {
  return prisma.questionnaire.upsert({
    where: { slug: def.slug },
    create: def,
    update: {
      title: def.title,
      subtitle: def.subtitle,
      version: def.version,
      audience: def.audience,
    },
  });
}

async function upsertStaffUser(role, email, displayName, passwordPlain) {
  const passwordHash = await hash(passwordPlain, 10);
  return prisma.user.upsert({
    where: { email },
    create: {
      role,
      email,
      passwordHash,
      displayName,
    },
    update: {
      displayName,
      passwordHash,
      role,
    },
  });
}

async function seed() {
  const [patientQ, doctorQ] = await Promise.all([
    ensureQuestionnaire(patientQuestionnaire),
    ensureQuestionnaire(doctorQuestionnaire),
  ]);

  const adminUser = await upsertStaffUser("admin", admin.email, admin.displayName, "Admin@123");
  const receptionistUser = await upsertStaffUser("receptionist", receptionist.email, receptionist.displayName, "Reception@123");

  const doctorUsers = [];
  for (const doctor of doctors) {
    const user = await upsertStaffUser("doctor", doctor.email, doctor.displayName, "Doctor@123");
    doctorUsers.push(user);

    const profile = await prisma.doctorProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: doctor.displayName,
        phone: doctor.phone,
        registrationNumber: doctor.registrationNumber,
        licenseNumber: doctor.licenseNumber,
        bio: doctor.bio,
      },
      update: {
        name: doctor.displayName,
        phone: doctor.phone,
        registrationNumber: doctor.registrationNumber,
        licenseNumber: doctor.licenseNumber,
        bio: doctor.bio,
      },
    });

    await prisma.doctorAvailabilitySlot.deleteMany({ where: { doctorProfileId: profile.id } });
    await prisma.doctorAvailabilitySlot.createMany({
      data: doctor.slots.map((slot) => ({
        doctorProfileId: profile.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        slotDurationMinutes: slot.slotDurationMinutes,
      })),
    });

    await prisma.receptionistDoctorAssignment.upsert({
      where: {
        receptionistId_doctorProfileId: {
          receptionistId: receptionistUser.id,
          doctorProfileId: profile.id,
        },
      },
      create: {
        receptionistId: receptionistUser.id,
        doctorProfileId: profile.id,
      },
      update: {},
    });
  }

  const createdSessions = [];

  for (const [index, patient] of patients.entries()) {
    const patientUser = await prisma.user.upsert({
      where: { email: patient.email },
      create: {
        role: "patient",
        email: patient.email,
        passwordHash: `patient:${patient.phone}`,
        displayName: patient.fullName,
      },
      update: {
        displayName: patient.fullName,
      },
    });

    await prisma.patientProfile.upsert({
      where: { userId: patientUser.id },
      create: {
        userId: patientUser.id,
        fullName: patient.fullName,
        age: patient.age,
        gender: patient.gender,
        region: patient.region,
        phone: patient.phone,
        aadhar: `DEMO-AADHAR-${index + 1}`,
      },
      update: {
        fullName: patient.fullName,
        age: patient.age,
        gender: patient.gender,
        region: patient.region,
        phone: patient.phone,
      },
    });

    const patientRecord = await prisma.patientRecord.upsert({
      where: { phone: patient.phone },
      create: {
        patientId: `PT-DEMO-${String(index + 1).padStart(5, "0")}`,
        phone: patient.phone,
        email: patient.email,
        fullName: patient.fullName,
        age: patient.age,
        gender: patient.gender,
        region: patient.region,
        preferredLanguage: patient.preferredLanguage,
        bmi: patient.bmi,
      },
      update: {
        email: patient.email,
        fullName: patient.fullName,
        age: patient.age,
        gender: patient.gender,
        region: patient.region,
        preferredLanguage: patient.preferredLanguage,
        bmi: patient.bmi,
      },
    });

    const assignedDoctor = doctorUsers[patient.doctorIndex % doctorUsers.length];

    const appointment = await prisma.appointment.upsert({
      where: { consultSessionId: patient.consultSessionId },
      create: {
        consultSessionId: patient.consultSessionId,
        consultId: patient.consultId,
        patientId: patientUser.id,
        patientRecordId: patientRecord.id,
        patientName: patient.fullName,
        patientPhone: patient.phone,
        doctorId: assignedDoctor.id,
        doctorName: assignedDoctor.displayName,
        appointmentDate: todayDate,
        appointmentTime: patient.appointmentTime,
        appointmentType: patient.appointmentType,
        status: patient.status,
        createdBy: "seed",
        notes: "Demo seeded appointment",
      },
      update: {
        consultId: patient.consultId,
        patientId: patientUser.id,
        patientRecordId: patientRecord.id,
        patientName: patient.fullName,
        patientPhone: patient.phone,
        doctorId: assignedDoctor.id,
        doctorName: assignedDoctor.displayName,
        appointmentDate: todayDate,
        appointmentTime: patient.appointmentTime,
        appointmentType: patient.appointmentType,
        status: patient.status,
        notes: "Demo seeded appointment",
      },
    });

    const intakeSubmission = await prisma.questionnaireSubmission.upsert({
      where: { sessionId: patient.consultSessionId },
      create: {
        questionnaireId: patientQ.id,
        appointmentId: appointment.id,
        patientId: patientUser.id,
        patientRecordId: patientRecord.id,
        doctorId: assignedDoctor.id,
        sessionId: patient.consultSessionId,
        patientPhone: patient.phone,
        status: patient.intakeStatus,
        sectionIndex: 0,
        questionIndex: 0,
        completionPct: 100,
        durationSeconds: 180,
        bmi: patient.bmi,
      },
      update: {
        questionnaireId: patientQ.id,
        appointmentId: appointment.id,
        patientId: patientUser.id,
        patientRecordId: patientRecord.id,
        doctorId: assignedDoctor.id,
        patientPhone: patient.phone,
        status: patient.intakeStatus,
        completionPct: 100,
        durationSeconds: 180,
        bmi: patient.bmi,
      },
    });

    await prisma.questionnaireAnswer.deleteMany({ where: { submissionId: intakeSubmission.id } });

    const patientAudit = computePromAudit(patient.answers);
    const patientAnswerRows = Object.entries(patient.answers).map(([key, value]) => ({
      submissionId: intakeSubmission.id,
      key,
      value,
    }));

    await prisma.questionnaireAnswer.createMany({
      data: [
        ...patientAnswerRows,
        { submissionId: intakeSubmission.id, key: "__promAutoAudit", value: patientAudit },
        { submissionId: intakeSubmission.id, key: "__promAutoInstrument", value: patientAudit.instrument },
        { submissionId: intakeSubmission.id, key: "__promAutoPercent", value: patientAudit.percent ?? "" },
        { submissionId: intakeSubmission.id, key: "__promAutoSeverity", value: patientAudit.severity },
        { submissionId: intakeSubmission.id, key: "__promAutoGeneratedAt", value: patientAudit.generatedAt },
      ],
    });

    const doctorSessionId = `${patient.consultSessionId}:doctor`;
    const doctorSubmission = await prisma.questionnaireSubmission.upsert({
      where: { sessionId: doctorSessionId },
      create: {
        questionnaireId: doctorQ.id,
        appointmentId: appointment.id,
        patientId: patientUser.id,
        patientRecordId: patientRecord.id,
        doctorId: assignedDoctor.id,
        sessionId: doctorSessionId,
        patientPhone: patient.phone,
        status: "submitted",
        sectionIndex: 0,
        questionIndex: 0,
        completionPct: 100,
        durationSeconds: 220,
      },
      update: {
        questionnaireId: doctorQ.id,
        appointmentId: appointment.id,
        patientId: patientUser.id,
        patientRecordId: patientRecord.id,
        doctorId: assignedDoctor.id,
        patientPhone: patient.phone,
        status: "submitted",
        completionPct: 100,
        durationSeconds: 220,
      },
    });

    await prisma.questionnaireAnswer.deleteMany({ where: { submissionId: doctorSubmission.id } });

    const doctorInstrument = patientAudit.instrument;
    const doctorPercent = doctorInstrument === "NDI"
      ? Number(patient.doctorAnswers.ndiPercent ?? patientAudit.percent ?? 0)
      : Number(patient.doctorAnswers.odiPercent ?? patientAudit.percent ?? 0);

    await prisma.questionnaireAnswer.createMany({
      data: [
        ...Object.entries(patient.doctorAnswers).map(([key, value]) => ({
          submissionId: doctorSubmission.id,
          key,
          value,
        })),
        { submissionId: doctorSubmission.id, key: "doctorScore", value: 100 },
        { submissionId: doctorSubmission.id, key: "__doctorPromAutoAudit", value: patientAudit },
        { submissionId: doctorSubmission.id, key: "__doctorPromAutoInstrument", value: doctorInstrument },
        { submissionId: doctorSubmission.id, key: "__doctorPromAutoPercent", value: doctorPercent },
        { submissionId: doctorSubmission.id, key: "__doctorPromAutoSeverity", value: patientAudit.severity },
        { submissionId: doctorSubmission.id, key: "__doctorPromAutoGeneratedAt", value: new Date().toISOString() },
      ],
    });

    createdSessions.push({
      patientName: patient.fullName,
      phone: patient.phone,
      consultSessionId: patient.consultSessionId,
      doctor: assignedDoctor.displayName,
      instrument: patientAudit.instrument,
      percent: patientAudit.percent,
      status: patient.status,
    });
  }

  console.log("\nDemo seed completed.\n");
  console.log("Staff login credentials:");
  console.log("- Admin: admin.local@spinexpert.local / Admin@123");
  console.log("- Receptionist: frontdesk@spinexpert.local / Reception@123");
  console.log("- Doctors: meera@spinexpert.local, arjun@spinexpert.local, kavya@spinexpert.local / Doctor@123");
  console.log("\nPatient OTP login:");
  console.log("- Use patient phone numbers below with demo OTP 482931");
  console.log("\nSeeded consult sessions:");
  for (const row of createdSessions) {
    console.log(
      `- ${row.consultSessionId} | ${row.patientName} (${row.phone}) | ${row.doctor} | ${row.instrument} ${row.percent ?? "n/a"}% | ${row.status}`,
    );
  }

  console.log("\nSuggested quick checks:");
  console.log("1) Receptionist queue should show PROM summary badges.");
  console.log("2) Doctor queue should show PROM in demographics and queue cards.");
  console.log("3) Doctor form should open with ODI/NDI values already populated and still editable.");

  await prisma.$disconnect();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
