import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const questionnaire = {
  slug: "sei-pq-v3-final",
  title: "SEI-PQ v3.0 Final",
  subtitle: "Pre-Consult Spine Health Assessment",
  version: 3,
  audience: ["patient", "doctor"],
};

const questions = [
  {
    key: "red_flag_prescreen",
    label: "Urgent red flag pre-screen",
    type: "multi-select",
    config: {
      part: "Pre-screen",
      section: "Urgent Red Flag Pre-Screen",
      source: "PDF",
      scored: false,
      options: [
        "Loss of bladder or bowel control",
        "Rapidly increasing limb weakness",
        "Fever with spine pain",
        "Severe pain after trauma",
        "Known cancer with worsening spine pain",
        "Unexplained weight loss",
        "None of the above",
      ],
    },
  },
  {
    key: "q1_age_group",
    label: "Age group",
    type: "select",
    config: { part: "Part 1 - Patient Profile", section: "Basic Patient Details", source: "PDF" },
  },
  {
    key: "q2_gender",
    label: "Gender",
    type: "select",
    config: { part: "Part 1 - Patient Profile", section: "Basic Patient Details", source: "PDF" },
  },
  {
    key: "q3_medical_conditions",
    label: "Medical conditions",
    type: "multi-select",
    config: { part: "Part 1 - Patient Profile", section: "Medical History", source: "PDF" },
  },
  {
    key: "q4_current_medicines",
    label: "Current medicines",
    type: "multi-select",
    config: { part: "Part 1 - Patient Profile", section: "Medical History", source: "PDF" },
  },
  {
    key: "q5_lifestyle_habits",
    label: "Lifestyle habits",
    type: "multi-select",
    config: { part: "Part 1 - Patient Profile", section: "Medical History", source: "PDF" },
  },
  {
    key: "q6_height_weight_bmi",
    label: "Height, weight and BMI",
    type: "number",
    config: { part: "Part 1 - Patient Profile", section: "Medical History", source: "PDF" },
  },
  {
    key: "q7_treatments_so_far",
    label: "Treatments received so far",
    type: "multi-select",
    config: { part: "Part 1 - Patient Profile", section: "Medical History", source: "PDF" },
  },
  {
    key: "q8_prior_surgery",
    label: "Any surgery previously",
    type: "select",
    config: { part: "Part 1 - Patient Profile", section: "Medical History", source: "PDF" },
  },
  {
    key: "q9_reports_available",
    label: "Reports available today",
    type: "multi-select",
    config: { part: "Part 1 - Patient Profile", section: "Previous Medical Reports Available", source: "PDF" },
  },
  {
    key: "q10_diagnosis_explained",
    label: "Has diagnosis been explained before",
    type: "select",
    config: { part: "Part 1 - Patient Profile", section: "Understanding of Your Diagnosis", source: "PDF" },
  },
  {
    key: "q11_main_reason",
    label: "Main reason for consultation",
    type: "select",
    config: { part: "Part 2 - Your Current Problem", section: "Current Problem", source: "PDF" },
  },
  {
    key: "q12_pain_location",
    label: "Where exactly is your pain",
    type: "multi-select",
    config: { part: "Part 2 - Your Current Problem", section: "Current Problem", source: "PDF" },
  },
  {
    key: "q13_side_affected",
    label: "Which side is most affected",
    type: "select",
    config: { part: "Part 2 - Your Current Problem", section: "Current Problem", source: "PDF" },
  },
  {
    key: "q14_pain_triggers",
    label: "Activities that increase pain",
    type: "multi-select",
    config: { part: "Part 2 - Your Current Problem", section: "Pain Behaviour and Triggers", source: "PDF" },
  },
  {
    key: "q15_relief_factors",
    label: "Activities or measures that reduce pain",
    type: "multi-select",
    config: { part: "Part 2 - Your Current Problem", section: "Pain Behaviour and Triggers", source: "PDF" },
  },
  {
    key: "q16_problem_start",
    label: "How did this problem start",
    type: "select",
    config: { part: "Part 2 - Your Current Problem", section: "Pain Behaviour and Triggers", source: "PDF" },
  },
  {
    key: "q17_problem_duration",
    label: "How long this spine problem has existed",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 1 Symptom Severity", source: "PDF" },
  },
  {
    key: "q18_nerve_symptom_onset",
    label: "When numbness or weakness started",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 1 Symptom Severity", source: "PDF" },
  },
  {
    key: "q19_pain_now",
    label: "Pain level right now",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 1 Symptom Severity", source: "PDF" },
  },
  {
    key: "q20_pain_pattern",
    label: "Pain pattern",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 1 Symptom Severity", source: "PDF" },
  },
  {
    key: "q21_condition_trend",
    label: "Condition trend",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 1 Symptom Severity", source: "PDF" },
  },
  {
    key: "q22_radiating_pain",
    label: "Radiating pain to arm or leg",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 2 Neurological Symptoms", source: "PDF" },
  },
  {
    key: "q23_numbness_tingling",
    label: "Numbness or tingling",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 2 Neurological Symptoms", source: "PDF" },
  },
  {
    key: "q24_weakness",
    label: "Weakness in limb",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 2 Neurological Symptoms", source: "PDF" },
  },
  {
    key: "q25_balance",
    label: "Walking or balance problems",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 2 Neurological Symptoms", source: "PDF" },
  },
  {
    key: "q26_fine_hand_tasks",
    label: "Fine hand task difficulty",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 2 Neurological Symptoms", source: "PDF" },
  },
  {
    key: "q27_daily_impact",
    label: "Overall impact on daily life",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 3 Functional Disability", source: "PDF" },
  },
  {
    key: "q28_work_impact",
    label: "Work and household impact",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 3 Functional Disability", source: "PDF" },
  },
  {
    key: "q29_personal_care",
    label: "Personal care ability",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 3 Functional Disability", source: "PDF" },
  },
  {
    key: "q30_walking_distance",
    label: "Walking distance before stopping",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 3 Functional Disability", source: "PDF" },
  },
  {
    key: "q31_sitting_duration",
    label: "Sitting tolerance",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 3 Functional Disability", source: "PDF" },
  },
  {
    key: "q32_standing_duration",
    label: "Standing tolerance",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 3 Functional Disability", source: "PDF" },
  },
  {
    key: "q33_sleep_quality",
    label: "Sleep quality",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 3 Functional Disability", source: "PDF" },
  },
  {
    key: "q34_doctors_seen",
    label: "Number of doctors or specialists seen",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 4 Previous Treatment Journey", source: "PDF" },
  },
  {
    key: "q35_therapy_duration",
    label: "How long treatment has been ongoing",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 4 Previous Treatment Journey", source: "PDF" },
  },
  {
    key: "q36_treatment_response",
    label: "Response to previous treatment",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 4 Previous Treatment Journey", source: "PDF" },
  },
  {
    key: "q37_biggest_worry",
    label: "Biggest worry about spine problem",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 5 Your Concerns and Goals", source: "PDF" },
  },
  {
    key: "q38_fear_avoidance",
    label: "Fear of pain stopping activity",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 5 Your Concerns and Goals", source: "PDF" },
  },
  {
    key: "q39_consult_priority",
    label: "Top priority from consultation",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 5 Your Concerns and Goals", source: "PDF" },
  },
  {
    key: "q40_baseline_spine_health",
    label: "Baseline self-rated spine health",
    type: "select",
    config: { part: "Part 3 - Symptom and Function Assessment", section: "Section 5 Your Concerns and Goals", source: "PDF" },
  },
];

async function main() {
  const entity = await prisma.questionnaire.upsert({
    where: { slug: questionnaire.slug },
    create: questionnaire,
    update: {
      title: questionnaire.title,
      subtitle: questionnaire.subtitle,
      version: questionnaire.version,
      audience: questionnaire.audience,
    },
  });

  await prisma.questionnaireQuestion.deleteMany({
    where: { questionnaireId: entity.id },
  });

  await prisma.questionnaireQuestion.createMany({
    data: questions.map((question, index) => ({
      questionnaireId: entity.id,
      key: question.key,
      label: question.label,
      type: question.type,
      helpText: null,
      sortOrder: index + 1,
      config: question.config,
    })),
  });

  const distinctSections = new Set(questions.map((question) => String(question.config.section)));

  console.log(`Seeded questionnaire: ${entity.slug}`);
  console.log(`Total questions inserted: ${questions.length}`);
  console.log(`Distinct sections inserted: ${distinctSections.size}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
