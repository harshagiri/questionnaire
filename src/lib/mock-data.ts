import { calculateBmi } from "@/lib/questionnaire";
import { roleCapabilities } from "@/lib/rbac";

export const sampleDoctors = [
  {
    name: "Aarav Mehta",
    specialty: "Internal Medicine",
    phone: "+91 98765 40111",
    licenseNumber: "MH-REG-901122",
    photo: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=256&q=80",
    bio: "Focuses on preventive care, screening workflows, and patient-first digital consultations.",
    links: ["Clinic profile", "Consultation notes", "Published talks"],
  },
  {
    name: "Neha Iyer",
    specialty: "Family Medicine",
    phone: "+91 98765 40222",
    licenseNumber: "TN-REG-440812",
    photo: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=256&q=80",
    bio: "Works with family screening, follow-up care, and simple explanations for high-confidence decision making.",
    links: ["Telehealth link", "Licensing board", "Practice page"],
  },
] as const;

export const todayPatients = [
  {
    name: "Ritika Sharma",
    age: 34,
    phone: "+91 98110 22334",
    appointmentDate: "2026-07-08 10:30",
    status: "Submitted",
    completion: 100,
    timeTaken: "04m 32s",
    doctor: sampleDoctors[0].name,
    bmi: calculateBmi(62, 168),
    summary: "Fever, sore throat, and fatigue for 3 days.",
    answers: [
      { label: "Pain score", value: "6/10" },
      { label: "Symptoms", value: "Fever, sore throat, fatigue" },
      { label: "Duration", value: "3 days" },
      { label: "BMI", value: calculateBmi(62, 168) },
    ],
  },
  {
    name: "Imran Khan",
    age: 47,
    phone: "+91 98110 22445",
    appointmentDate: "2026-07-08 11:00",
    status: "In progress",
    completion: 72,
    timeTaken: "03m 14s",
    doctor: sampleDoctors[1].name,
    bmi: calculateBmi(81, 175),
    summary: "Chest discomfort after exertion.",
    answers: [
      { label: "Pain score", value: "4/10" },
      { label: "Symptoms", value: "Chest discomfort after exertion" },
      { label: "Duration", value: "1 day" },
      { label: "BMI", value: calculateBmi(81, 175) },
    ],
  },
  {
    name: "Sahana Rao",
    age: 29,
    phone: "+91 98110 22556",
    appointmentDate: "2026-07-08 11:30",
    status: "Waiting",
    completion: 41,
    timeTaken: "01m 58s",
    doctor: sampleDoctors[0].name,
    bmi: calculateBmi(55, 162),
    summary: "Migraine screening and medication history.",
    answers: [
      { label: "Pain score", value: "8/10" },
      { label: "Symptoms", value: "Migraine and light sensitivity" },
      { label: "Duration", value: "2 days" },
      { label: "BMI", value: calculateBmi(55, 162) },
    ],
  },
];

export const usageMetrics = [
  {
    label: "Average completion time",
    value: "4m 11s",
    note: "Median across completed patient flows",
  },
  {
    label: "Weekly submissions",
    value: "500+",
    note: "Expected baseline throughput",
  },
  {
    label: "Autosave resume rate",
    value: "91%",
    note: "Users continue from the last saved step",
  },
  {
    label: "Doctor review latency",
    value: "12m",
    note: "Time from submit to consult-ready view",
  },
];

export const roleSummaries = roleCapabilities;