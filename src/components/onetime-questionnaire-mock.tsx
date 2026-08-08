"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { computePromScore } from "@/lib/prom-scoring";
import { preConsultSections } from "@/lib/workflow-data";

type Hotspot = {
  id: string;
  label: string;
  x: number;
  y: number;
};

type CalloutLayout = {
  position: "top" | "bottom" | "left" | "right";
  dx: number;
  dy: number;
};

type MockStep = "risk" | "reason" | "pain-map" | "side" | "duration" | "onset" | "pain-score" | "pattern" | "change-overall" | "radiating" | "numbness" | "pain-worse-with" | "pain-improves-with" | "treatments-tried" | "treatment-helped" | "legacy-followup";
type SideChoice = "right" | "left" | "both" | "midline";
type DurationChoice = "lt-2w" | "w2-m3" | "m3-m6" | "gt-6m";
type OnsetChoice = "gradual" | "lifting" | "accident" | "posture" | "sports" | "surgery";
type PatternChoice = "intermittent" | "activity" | "constant" | "night";
type ChangeOverallChoice = "improving" | "stable" | "slowly-worse" | "rapidly-worse";
type RadiatingChoice = "none" | "occasional" | "frequent" | "constant";
type NumbnessChoice = "none" | "occasional" | "frequent" | "constant";
type PainWorseChoice = "sitting" | "standing" | "walking" | "forward-bending" | "backward-bending" | "lifting" | "coughing-sneezing";
type PainImprovesChoice = "rest-lying-down" | "walking" | "changing-position" | "medicines" | "heat-cold" | "nothing-gives-relief";
type TreatmentTriedChoice = "medicines-painkillers" | "physiotherapy-rehab" | "injection-nerve-block" | "surgery" | "alternative-therapy" | "none-yet";
type TreatmentHelpedChoice = "significant" | "partial" | "none" | "worsened" | "not-tried";

type RiskOption = {
  id: string;
  label: string;
  imageSrc: string;
};

type SideOption = {
  id: SideChoice;
  label: string;
  helper: string;
  icon: SideChoice;
  imageSrc: string;
};

type DurationOption = {
  id: DurationChoice;
  label: string;
  helper: string;
  badge?: string;
  imageSrc: string;
};

type ReasonIconKind = "neck" | "back" | "arm" | "leg" | "numbness" | "weakness" | "walking" | "followup" | "second";

type ReasonOption = {
  id: string;
  label: string;
  helper: string;
  icon: ReasonIconKind;
};

type OnsetOption = {
  id: OnsetChoice;
  label: string;
  helper: string;
  imageSrc: string;
};

type PatternOption = {
  id: PatternChoice;
  label: string;
  imageSrc: string;
};
type ChangeOverallOption = {
  id: ChangeOverallChoice;
  label: string;
  imageSrc: string;
};

type RadiatingOption = {
  id: RadiatingChoice;
  title: string;
  helper: string;
  imageSrc: string;
};

type NumbnessOption = {
  id: NumbnessChoice;
  title: string;
  helper: string;
  imageSrc: string;
};

type PainWorseOption = {
  id: PainWorseChoice;
  label: string;
  imageSrc: string;
};

type PainImprovesOption = {
  id: PainImprovesChoice;
  label: string;
  imageSrc: string;
};

type TreatmentTriedOption = {
  id: TreatmentTriedChoice;
  label: string;
  imageSrc: string;
};

type TreatmentHelpedOption = {
  id: TreatmentHelpedChoice;
  label: string;
  helper: string;
  imageSrc: string;
};

type LegacyAnswerValue = string | number | boolean | string[];

const hotspots: Hotspot[] = [
  { id: "neck", label: "Neck", x: 50, y: 18 },
  { id: "upper-back", label: "Upper back / mid back", x: 64, y: 30 },
  { id: "lower-back", label: "Lower back", x: 54, y: 48 },
  { id: "right-arm", label: "Right arm / hand", x: 73, y: 41 },
  { id: "left-arm", label: "Left arm / hand", x: 27, y: 41 },
  { id: "right-leg", label: "Right leg / foot", x: 61, y: 73 },
  { id: "left-leg", label: "Left leg / foot", x: 41, y: 73 },
  { id: "central", label: "Central / midline", x: 50, y: 38 },
];

const bodyImage = "/gamification-crops/pain-map/body-stage-back-clean.jpg";

const calloutLayoutById: Record<string, CalloutLayout> = {
  neck: { position: "top", dx: 0, dy: -8 },
  "upper-back": { position: "top", dx: 22, dy: -14 },
  "lower-back": { position: "bottom", dx: 0, dy: 16 },
  "right-arm": { position: "bottom", dx: 0, dy: 14 },
  "left-arm": { position: "bottom", dx: 0, dy: 14 },
  "right-leg": { position: "right", dx: 20, dy: 16 },
  "left-leg": { position: "left", dx: -20, dy: 16 },
  central: { position: "top", dx: 0, dy: 18 },
};

const leftLateralLabels = new Set(["Left arm / hand", "Left leg / foot"]);
const rightLateralLabels = new Set(["Right arm / hand", "Right leg / foot"]);
const midlineLabels = new Set(["Neck", "Upper back / mid back", "Lower back", "Central / midline"]);

const sideOptions: SideOption[] = [
  {
    id: "right",
    label: "Right",
    helper: "Right-sided symptoms",
    icon: "right",
    imageSrc: "/illustrations/pain-map/side-options-v2/right.png",
  },
  {
    id: "left",
    label: "Left",
    helper: "Left-sided symptoms",
    icon: "left",
    imageSrc: "/illustrations/pain-map/side-options-v2/left.png",
  },
  {
    id: "both",
    label: "Both sides equally",
    helper: "Both sides feel similar",
    icon: "both",
    imageSrc: "/illustrations/pain-map/side-options-v2/both.png",
  },
  {
    id: "midline",
    label: "Midline / central",
    helper: "Mostly central symptoms",
    icon: "midline",
    imageSrc: "/illustrations/pain-map/side-options-v2/midline.png",
  },
];

const durationOptions: DurationOption[] = [
  {
    id: "lt-2w",
    label: "Less than 2 weeks",
    helper: "Very recent",
    badge: "Most common",
    imageSrc: "/illustrations/pain-map/duration-options/less-than-2-weeks.svg",
  },
  {
    id: "w2-m3",
    label: "2 weeks to 3 months",
    helper: "Recent",
    imageSrc: "/illustrations/pain-map/duration-options/two-weeks-to-three-months.svg",
  },
  {
    id: "m3-m6",
    label: "3 to 6 months",
    helper: "A few months",
    imageSrc: "/illustrations/pain-map/duration-options/three-to-six-months.svg",
  },
  {
    id: "gt-6m",
    label: "More than 6 months",
    helper: "Ongoing for a while",
    imageSrc: "/illustrations/pain-map/duration-options/more-than-6-months.svg",
  },
];

const reasonOptions: ReasonOption[] = [
  { id: "neck-pain", label: "Neck pain", helper: "Cervical pain", icon: "neck" },
  { id: "back-pain", label: "Back pain", helper: "Spinal pain", icon: "back" },
  { id: "arm-pain", label: "Arm pain", helper: "Upper limb pain", icon: "arm" },
  { id: "leg-sciatica", label: "Leg pain / sciatica", helper: "Radiating pain", icon: "leg" },
  { id: "numbness", label: "Numbness", helper: "Sensory change", icon: "numbness" },
  { id: "weakness", label: "Weakness", helper: "Motor weakness", icon: "weakness" },
  { id: "walking", label: "Walking difficulty", helper: "Gait concern", icon: "walking" },
  { id: "followup", label: "Follow-up visit", helper: "Planned review", icon: "followup" },
  { id: "second-opinion", label: "Second opinion", helper: "Independent review", icon: "second" },
];

const onsetOptions: OnsetOption[] = [
  {
    id: "gradual",
    label: "Gradual / no specific cause",
    helper: "Developed over time",
    imageSrc: "/illustrations/pain-map/onset-options/gradual-no-specific-cause.svg",
  },
  {
    id: "lifting",
    label: "After lifting or straining",
    helper: "Triggered by load",
    imageSrc: "/illustrations/pain-map/onset-options/after-lifting-or-straining.svg",
  },
  {
    id: "accident",
    label: "After an accident or fall",
    helper: "Trauma-related onset",
    imageSrc: "/illustrations/pain-map/onset-options/after-accident-or-fall.svg",
  },
  {
    id: "posture",
    label: "Bad posture / long sitting",
    helper: "Posture-related onset",
    imageSrc: "/illustrations/pain-map/onset-options/bad-posture-long-sitting.svg",
  },
  {
    id: "sports",
    label: "After exercise or sports",
    helper: "Activity-related onset",
    imageSrc: "/illustrations/pain-map/onset-options/after-exercise-or-sports.svg",
  },
  {
    id: "surgery",
    label: "After a previous surgery",
    helper: "Post-procedure onset",
    imageSrc: "/illustrations/pain-map/onset-options/after-previous-surgery.svg",
  },
];

const painScoreOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

const painScoreWords: Record<(typeof painScoreOptions)[number], string> = {
  0: "No pain",
  1: "Very mild",
  2: "Mild",
  3: "Noticeable",
  4: "Uncomfortable",
  5: "Moderate",
  6: "Distressing",
  7: "Intense",
  8: "Severe",
  9: "Very severe",
  10: "Worst imaginable",
};

const patternOptions: PatternOption[] = [
  {
    id: "intermittent",
    label: "Intermittent — comes and goes with pain-free periods",
    imageSrc: "/illustrations/pain-map/pattern-options/intermittent.png",
  },
  {
    id: "activity",
    label: "Activity-related — worse with movement, better with rest",
    imageSrc: "/illustrations/pain-map/pattern-options/activity.png",
  },
  {
    id: "constant",
    label: "Constant — present most of the time",
    imageSrc: "/illustrations/pain-map/pattern-options/constant.png",
  },
  {
    id: "night",
    label: "Night pain — wakes me from sleep",
    imageSrc: "/illustrations/pain-map/pattern-options/night.png",
  },
];
const changeOverallOptions: ChangeOverallOption[] = [
  {
    id: "improving",
    label: "Improving",
    imageSrc: "/illustrations/pain-map/change-options/improving.png",
  },
  {
    id: "stable",
    label: "Stable, no major change",
    imageSrc: "/illustrations/pain-map/change-options/stable.png",
  },
  {
    id: "slowly-worse",
    label: "Slowly getting worse",
    imageSrc: "/illustrations/pain-map/change-options/slowly-worse.png",
  },
  {
    id: "rapidly-worse",
    label: "Rapidly getting worse",
    imageSrc: "/illustrations/pain-map/change-options/rapidly-worse.png",
  },
];

const radiatingOptions: RadiatingOption[] = [
  {
    id: "none",
    title: "No radiating pain",
    helper: "Pain stays in one area and does not travel.",
    imageSrc: "/illustrations/pain-map/radiating-options/no-radiating.png",
  },
  {
    id: "occasional",
    title: "Occasional",
    helper: "Pain comes and goes, traveling down the arm or leg.",
    imageSrc: "/illustrations/pain-map/radiating-options/occasional.png",
  },
  {
    id: "frequent",
    title: "Frequent",
    helper: "Pain often travels down the arm or leg.",
    imageSrc: "/illustrations/pain-map/radiating-options/frequent.png",
  },
  {
    id: "constant",
    title: "Constant",
    helper: "Pain is constant and travels all the way down the arm or leg.",
    imageSrc: "/illustrations/pain-map/radiating-options/constant.png",
  },
];

const numbnessOptions: NumbnessOption[] = [
  {
    id: "none",
    title: "None",
    helper: "No numbness or tingling.",
    imageSrc: "/illustrations/pain-map/numbness-options/none.png",
  },
  {
    id: "occasional",
    title: "Occasional",
    helper: "Numbness or tingling comes and goes.",
    imageSrc: "/illustrations/pain-map/numbness-options/occasional.png",
  },
  {
    id: "frequent",
    title: "Frequent",
    helper: "Numbness or tingling happens often.",
    imageSrc: "/illustrations/pain-map/numbness-options/frequent.png",
  },
  {
    id: "constant",
    title: "Constant",
    helper: "Numbness or tingling is constant.",
    imageSrc: "/illustrations/pain-map/numbness-options/constant.png",
  },
];

const painWorseOptions: PainWorseOption[] = [
  { id: "sitting", label: "Sitting", imageSrc: "/illustrations/pain-map/pain-worse-options/sitting.png" },
  { id: "standing", label: "Standing", imageSrc: "/illustrations/pain-map/pain-worse-options/standing.png" },
  { id: "walking", label: "Walking", imageSrc: "/illustrations/pain-map/pain-worse-options/walking.png" },
  { id: "forward-bending", label: "Forward bending", imageSrc: "/illustrations/pain-map/pain-worse-options/forward-bending.png" },
  { id: "backward-bending", label: "Backward bending / extension", imageSrc: "/illustrations/pain-map/pain-worse-options/backward-bending.png" },
  { id: "lifting", label: "Lifting", imageSrc: "/illustrations/pain-map/pain-worse-options/lifting.png" },
  { id: "coughing-sneezing", label: "Coughing or sneezing", imageSrc: "/illustrations/pain-map/pain-worse-options/coughing-sneezing.png" },
];

const painImprovesOptions: PainImprovesOption[] = [
  { id: "rest-lying-down", label: "Rest / lying down", imageSrc: "/illustrations/pain-map/pain-improves-options/rest-lying-down.png" },
  { id: "walking", label: "Walking", imageSrc: "/illustrations/pain-map/pain-improves-options/walking.png" },
  { id: "changing-position", label: "Changing position", imageSrc: "/illustrations/pain-map/pain-improves-options/changing-position.png" },
  { id: "medicines", label: "Medicines", imageSrc: "/illustrations/pain-map/pain-improves-options/medicines.png" },
  { id: "heat-cold", label: "Heat or cold", imageSrc: "/illustrations/pain-map/pain-improves-options/heat-cold.png" },
  { id: "nothing-gives-relief", label: "Nothing gives relief", imageSrc: "/illustrations/pain-map/pain-improves-options/nothing-gives-relief.png" },
];

const treatmentTriedOptions: TreatmentTriedOption[] = [
  { id: "medicines-painkillers", label: "Medicines / painkillers", imageSrc: "/illustrations/pain-map/treatments-options/medicines-painkillers.png" },
  { id: "physiotherapy-rehab", label: "Physiotherapy / rehabilitation", imageSrc: "/illustrations/pain-map/treatments-options/physiotherapy-rehab.png" },
  { id: "injection-nerve-block", label: "Injection / nerve block", imageSrc: "/illustrations/pain-map/treatments-options/injection-nerve-block.png" },
  { id: "surgery", label: "Surgery", imageSrc: "/illustrations/pain-map/treatments-options/surgery.png" },
  { id: "alternative-therapy", label: "Alternative therapy (yoga, Ayurveda, etc.)", imageSrc: "/illustrations/pain-map/treatments-options/alternative-therapy.png" },
  { id: "none-yet", label: "None yet", imageSrc: "/illustrations/pain-map/treatments-options/none-yet.png" },
];

const treatmentHelpedOptions: TreatmentHelpedOption[] = [
  {
    id: "significant",
    label: "Significant improvement",
    helper: "Symptoms improved clearly.",
    imageSrc: "/illustrations/pain-map/treatment-helped-cropped/significant.png",
  },
  {
    id: "partial",
    label: "Partial improvement",
    helper: "Some improvement, but symptoms remain.",
    imageSrc: "/illustrations/pain-map/treatment-helped-cropped/partial.png",
  },
  {
    id: "none",
    label: "No improvement",
    helper: "No meaningful change so far.",
    imageSrc: "/illustrations/pain-map/treatment-helped-cropped/none.png",
  },
  {
    id: "worsened",
    label: "Worsened after treatment",
    helper: "Symptoms became worse.",
    imageSrc: "/illustrations/pain-map/treatment-helped-cropped/worsened.png",
  },
  {
    id: "not-tried",
    label: "Not yet tried any treatment",
    helper: "No treatment trial completed yet.",
    imageSrc: "/illustrations/pain-map/treatment-helped-cropped/not-tried.png",
  },
];

const ndiPainIntensityCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-pain-intensity-cards/ndi-0.png", label: "No pain" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-pain-intensity-cards/ndi-1.png", label: "Very mild" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-pain-intensity-cards/ndi-2.png", label: "Moderate" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-pain-intensity-cards/ndi-3.png", label: "Fairly severe" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-pain-intensity-cards/ndi-4.png", label: "Very severe" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-pain-intensity-cards/ndi-5.png", label: "Worst imaginable" },
];

const ndiPersonalCareCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-personal-care-cards/ndi-pc-0.png", label: "No extra pain" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-personal-care-cards/ndi-pc-1.png", label: "Normal care with extra pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-personal-care-cards/ndi-pc-2.png", label: "Slow and careful" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-personal-care-cards/ndi-pc-3.png", label: "Need some help" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-personal-care-cards/ndi-pc-4.png", label: "Need daily help" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-personal-care-cards/ndi-pc-5.png", label: "Unable to self-care" },
];

const ndiLiftingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-lifting-cards/ndi-lift-0.png", label: "Lift heavy weights normally" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-lifting-cards/ndi-lift-1.png", label: "Heavy lifting with extra pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-lifting-cards/ndi-lift-2.png", label: "Heavy from floor prevented" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-lifting-cards/ndi-lift-3.png", label: "Only light to medium" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-lifting-cards/ndi-lift-4.png", label: "Very light only" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-lifting-cards/ndi-lift-5.png", label: "Cannot lift at all" },
];

const ndiReadingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-reading-cards/ndi-read-0.png", label: "Read without neck pain" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-reading-cards/ndi-read-1.png", label: "Read with slight neck pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-reading-cards/ndi-read-2.png", label: "Read with moderate neck pain" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-reading-cards/ndi-read-3.png", label: "Cannot read as much as desired" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-reading-cards/ndi-read-4.png", label: "Can hardly read" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-reading-cards/ndi-read-5.png", label: "Cannot read at all" },
];

const ndiHeadachesCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-headache-cards/ndi-head-0.png", label: "No headaches" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-headache-cards/ndi-head-1.png", label: "Slight, infrequent" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-headache-cards/ndi-head-2.png", label: "Moderate, infrequent" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-headache-cards/ndi-head-3.png", label: "Moderate, frequent" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-headache-cards/ndi-head-4.png", label: "Severe, frequent" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-headache-cards/ndi-head-5.png", label: "Almost all the time" },
];

const ndiConcentrationCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-concentration-cards/ndi-conc-0.png", label: "Concentrate fully with no difficulty" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-concentration-cards/ndi-conc-1.png", label: "Concentrate fully with slight difficulty" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-concentration-cards/ndi-conc-2.png", label: "Fair difficulty concentrating" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-concentration-cards/ndi-conc-3.png", label: "A lot of difficulty concentrating" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-concentration-cards/ndi-conc-4.png", label: "Great difficulty concentrating" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-concentration-cards/ndi-conc-5.png", label: "Cannot concentrate at all" },
];

const ndiWorkCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-work-cards/ndi-work-0.png", label: "Can do as much work as I want" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-work-cards/ndi-work-1.png", label: "Can do usual work only" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-work-cards/ndi-work-2.png", label: "Can do most usual work" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-work-cards/ndi-work-3.png", label: "Cannot do usual work" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-work-cards/ndi-work-4.png", label: "Can hardly do any work" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-work-cards/ndi-work-5.png", label: "Cannot do any work" },
];

const ndiDrivingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-driving-cards/ndi-drive-0.png", label: "Drive without neck pain" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-driving-cards/ndi-drive-1.png", label: "Drive as long as needed with slight pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-driving-cards/ndi-drive-2.png", label: "Drive as long as needed with moderate pain" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-driving-cards/ndi-drive-3.png", label: "Cannot drive as long as wanted" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-driving-cards/ndi-drive-4.png", label: "Can hardly drive" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-driving-cards/ndi-drive-5.png", label: "Cannot drive at all" },
];

const ndiSleepingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-sleeping-cards/ndi-sleep-0.png", label: "No trouble sleeping" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-sleeping-cards/ndi-sleep-1.png", label: "Slightly disturbed sleep" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-sleeping-cards/ndi-sleep-2.png", label: "Mildly disturbed sleep" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-sleeping-cards/ndi-sleep-3.png", label: "Moderately disturbed sleep" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-sleeping-cards/ndi-sleep-4.png", label: "Greatly disturbed sleep" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-sleeping-cards/ndi-sleep-5.png", label: "Completely disturbed sleep" },
];

const ndiRecreationCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/ndi-recreation-cards/ndi-rec-0.png", label: "Recreation without neck pain" },
  { value: "1", imageSrc: "/illustrations/pain-map/ndi-recreation-cards/ndi-rec-1.png", label: "Recreation with some neck pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/ndi-recreation-cards/ndi-rec-2.png", label: "Moderate limitation" },
  { value: "3", imageSrc: "/illustrations/pain-map/ndi-recreation-cards/ndi-rec-3.png", label: "Limited in most recreation" },
  { value: "4", imageSrc: "/illustrations/pain-map/ndi-recreation-cards/ndi-rec-4.png", label: "Hardly any recreation possible" },
  { value: "5", imageSrc: "/illustrations/pain-map/ndi-recreation-cards/ndi-rec-5.png", label: "No recreation possible" },
];

const spineHealthCardOptions: Array<{ value: number; imageSrc: string; label: string }> = [
  { value: 0, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-0.png", label: "0" },
  { value: 1, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-1.png", label: "1" },
  { value: 2, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-2.png", label: "2" },
  { value: 3, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-3.png", label: "3" },
  { value: 4, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-4.png", label: "4" },
  { value: 5, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-5.png", label: "5" },
  { value: 6, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-6.png", label: "6" },
  { value: 7, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-7.png", label: "7" },
  { value: 8, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-8.png", label: "8" },
  { value: 9, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-9.png", label: "9" },
  { value: 10, imageSrc: "/illustrations/pain-map/spine-health-cards/spine-v2-10.png", label: "10" },
];

const odiPainIntensityCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-pain-intensity-cards/odi-pain-0.png", label: "No pain" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-pain-intensity-cards/odi-pain-1.png", label: "Very mild" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-pain-intensity-cards/odi-pain-2.png", label: "Moderate" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-pain-intensity-cards/odi-pain-3.png", label: "Fairly severe" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-pain-intensity-cards/odi-pain-4.png", label: "Very severe" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-pain-intensity-cards/odi-pain-5.png", label: "Worst possible" },
];

const odiPersonalCareCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-personal-care-cards/odi-pc-0.png", label: "No extra pain" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-personal-care-cards/odi-pc-1.png", label: "Normal care with extra pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-personal-care-cards/odi-pc-2.png", label: "Slow and careful" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-personal-care-cards/odi-pc-3.png", label: "Need some help" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-personal-care-cards/odi-pc-4.png", label: "Need daily help" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-personal-care-cards/odi-pc-5.png", label: "Unable to self-care" },
];

const odiLiftingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-lifting-cards/odi-lift-0.png", label: "Lift heavy weights normally" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-lifting-cards/odi-lift-1.png", label: "Heavy lifting with extra pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-lifting-cards/odi-lift-2.png", label: "Heavy from floor prevented" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-lifting-cards/odi-lift-3.png", label: "Only light to medium" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-lifting-cards/odi-lift-4.png", label: "Very light only" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-lifting-cards/odi-lift-5.png", label: "Cannot lift at all" },
];

const odiWalkingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-walking-cards/odi-walk-0.png", label: "Walk any distance" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-walking-cards/odi-walk-1.png", label: "Up to 1 mile" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-walking-cards/odi-walk-2.png", label: "Up to 0.5 mile" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-walking-cards/odi-walk-3.png", label: "Up to 0.25 mile" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-walking-cards/odi-walk-4.png", label: "Need stick/crutches" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-walking-cards/odi-walk-5.png", label: "Mostly bed-bound" },
];

const odiSittingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-sitting-cards/odi-sit-0.png", label: "Any chair, any duration" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-sitting-cards/odi-sit-1.png", label: "Favorite chair only" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-sitting-cards/odi-sit-2.png", label: "Up to 1 hour" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-sitting-cards/odi-sit-3.png", label: "Up to 30 minutes" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-sitting-cards/odi-sit-4.png", label: "Up to 10 minutes" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-sitting-cards/odi-sit-5.png", label: "Cannot sit" },
];

const odiStandingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-standing-cards/odi-stand-0.png", label: "Stand as long as needed" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-standing-cards/odi-stand-1.png", label: "Standing with extra pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-standing-cards/odi-stand-2.png", label: "Up to 1 hour" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-standing-cards/odi-stand-3.png", label: "Up to 30 minutes" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-standing-cards/odi-stand-4.png", label: "Up to 10 minutes" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-standing-cards/odi-stand-5.png", label: "Cannot stand" },
];

const odiSleepingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-sleeping-cards/odi-sleep-0.png", label: "Sleep undisturbed" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-sleeping-cards/odi-sleep-1.png", label: "Occasionally disturbed" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-sleeping-cards/odi-sleep-2.png", label: "Sleep less than 6 hours" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-sleeping-cards/odi-sleep-3.png", label: "Sleep less than 4 hours" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-sleeping-cards/odi-sleep-4.png", label: "Sleep less than 2 hours" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-sleeping-cards/odi-sleep-5.png", label: "Cannot sleep" },
];

const odiSexLifeCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-sex-life-cards/odi-sex-0.png", label: "Normal, no extra pain" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-sex-life-cards/odi-sex-1.png", label: "Normal with some pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-sex-life-cards/odi-sex-2.png", label: "Nearly normal, painful" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-sex-life-cards/odi-sex-3.png", label: "Severely restricted" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-sex-life-cards/odi-sex-4.png", label: "Nearly absent" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-sex-life-cards/odi-sex-5.png", label: "Prevented entirely" },
];

const odiSocialLifeCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-social-life-cards/odi-social-0.png", label: "Normal social life" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-social-life-cards/odi-social-1.png", label: "Normal but painful" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-social-life-cards/odi-social-2.png", label: "Limited only in energetic interests" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-social-life-cards/odi-social-3.png", label: "Go out less often" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-social-life-cards/odi-social-4.png", label: "Restricted to home" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-social-life-cards/odi-social-5.png", label: "Almost no social life" },
];

const odiTravellingCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "0", imageSrc: "/illustrations/pain-map/odi-travelling-cards/odi-travel-0.png", label: "Travel anywhere" },
  { value: "1", imageSrc: "/illustrations/pain-map/odi-travelling-cards/odi-travel-1.png", label: "Travel with extra pain" },
  { value: "2", imageSrc: "/illustrations/pain-map/odi-travelling-cards/odi-travel-2.png", label: "Can manage 2+ hour journeys" },
  { value: "3", imageSrc: "/illustrations/pain-map/odi-travelling-cards/odi-travel-3.png", label: "Journeys under 1 hour" },
  { value: "4", imageSrc: "/illustrations/pain-map/odi-travelling-cards/odi-travel-4.png", label: "Necessary short journeys only" },
  { value: "5", imageSrc: "/illustrations/pain-map/odi-travelling-cards/odi-travel-5.png", label: "Treatment travel only" },
];

const myelopathyHandTasksCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "normal", imageSrc: "/illustrations/pain-map/myelopathy-hand-cards/hand-1.png", label: "Normal" },
  { value: "slight", imageSrc: "/illustrations/pain-map/myelopathy-hand-cards/hand-2.png", label: "Slight clumsiness" },
  { value: "noticeable", imageSrc: "/illustrations/pain-map/myelopathy-hand-cards/hand-3.png", label: "Noticeable difficulty" },
  { value: "significant", imageSrc: "/illustrations/pain-map/myelopathy-hand-cards/hand-4.png", label: "Significant impairment" },
];

const myelopathyBalanceCardOptions: Array<{ value: string; imageSrc: string; label: string }> = [
  { value: "normal", imageSrc: "/illustrations/pain-map/myelopathy-balance-cards/balance-1.png", label: "Normal" },
  { value: "mild", imageSrc: "/illustrations/pain-map/myelopathy-balance-cards/balance-2.png", label: "Mild unsteadiness" },
  { value: "frequent", imageSrc: "/illustrations/pain-map/myelopathy-balance-cards/balance-3.png", label: "Frequent imbalance" },
  { value: "needs-support", imageSrc: "/illustrations/pain-map/myelopathy-balance-cards/balance-4.png", label: "Needs support to walk" },
];

const legacyDeckCardOptionMap: Record<string, Array<{ value: string; imageSrc: string; label: string }>> = {
  odiPainIntensity: odiPainIntensityCardOptions,
  odiPersonalCare: odiPersonalCareCardOptions,
  odiLifting: odiLiftingCardOptions,
  odiWalking: odiWalkingCardOptions,
  odiSitting: odiSittingCardOptions,
  odiStanding: odiStandingCardOptions,
  odiSleeping: odiSleepingCardOptions,
  odiSexLife: odiSexLifeCardOptions,
  odiSocialLife: odiSocialLifeCardOptions,
  odiTravelling: odiTravellingCardOptions,
  myelopathyHandTasks: myelopathyHandTasksCardOptions,
  myelopathyBalance: myelopathyBalanceCardOptions,
};

const wrapIndex = (index: number, total: number) => ((index % total) + total) % total;

const circularDistance = (index: number, activeIndex: number, total: number) => {
  const forward = (index - activeIndex + total) % total;
  const backward = forward - total;
  return Math.abs(backward) < forward ? backward : forward;
};

const riskOptions: RiskOption[] = [
  {
    id: "bladder-bowel",
    label: "New bladder or bowel change",
    imageSrc: "/illustrations/pain-map/safety-first-options/bladder-bowel.png",
  },
  {
    id: "rapid-weakness",
    label: "Rapid leg weakness or numbness",
    imageSrc: "/illustrations/pain-map/safety-first-options/rapid-weakness.png",
  },
  {
    id: "fever-spine",
    label: "Fever with severe spinal pain",
    imageSrc: "/illustrations/pain-map/safety-first-options/fever-spine.png",
  },
  {
    id: "fall-accident",
    label: "Recent fall or accident",
    imageSrc: "/illustrations/pain-map/safety-first-options/fall-accident.png",
  },
  {
    id: "cancer-history",
    label: "Known cancer history",
    imageSrc: "/illustrations/pain-map/safety-first-options/cancer-history.png",
  },
  {
    id: "weight-loss",
    label: "Unintentional weight loss",
    imageSrc: "/illustrations/pain-map/safety-first-options/weight-loss.png",
  },
  {
    id: "none",
    label: "None of these",
    imageSrc: "/illustrations/pain-map/safety-first-options/none.png",
  },
];

const riskKeyByOptionId: Record<string, string> = {
  "bladder-bowel": "redFlagBladderBowel",
  "rapid-weakness": "redFlagRapidWeakness",
  "fever-spine": "redFlagFever",
  "fall-accident": "redFlagTrauma",
  "cancer-history": "redFlagCancer",
  "weight-loss": "redFlagWeightLoss",
};

const reasonToQ1: Record<string, string> = {
  "neck-pain": "neck-pain",
  "back-pain": "back-pain",
  "arm-pain": "arm-pain",
  "leg-sciatica": "leg-pain",
  numbness: "numbness",
  weakness: "weakness",
  walking: "walking-difficulty",
  followup: "follow-up",
  "second-opinion": "second-opinion",
};

const painRegionByLabel: Record<string, string> = {
  Neck: "neck",
  "Upper back / mid back": "upper-back",
  "Lower back": "lower-back",
  "Right arm / hand": "right-arm",
  "Left arm / hand": "left-arm",
  "Right leg / foot": "right-leg",
  "Left leg / foot": "left-leg",
  "Central / midline": "central",
};

const durationToQ4: Record<DurationChoice, string> = {
  "lt-2w": "lt-2wk",
  "w2-m3": "2wk-3m",
  "m3-m6": "3m-6m",
  "gt-6m": "gt-6m",
};

const onsetToQ5: Record<OnsetChoice, string> = {
  gradual: "gradual",
  lifting: "lifting",
  accident: "accident",
  posture: "posture",
  sports: "exercise",
  surgery: "post-surgery",
};

const painWorseToQ12: Record<PainWorseChoice, string> = {
  sitting: "sitting",
  standing: "standing",
  walking: "walking",
  "forward-bending": "forward-bend",
  "backward-bending": "backward-bend",
  lifting: "lifting",
  "coughing-sneezing": "coughing",
};

const painImprovesToQ13: Record<PainImprovesChoice, string> = {
  "rest-lying-down": "rest",
  walking: "walking",
  "changing-position": "position-change",
  medicines: "medicines",
  "heat-cold": "heat-cold",
  "nothing-gives-relief": "nothing",
};

const treatmentsToQ14: Record<TreatmentTriedChoice, string> = {
  "medicines-painkillers": "medicines",
  "physiotherapy-rehab": "physio",
  "injection-nerve-block": "injection",
  surgery: "surgery",
  "alternative-therapy": "alternative",
  "none-yet": "none",
};

function SideOptionIcon({ kind }: { kind: SideChoice }) {
  if (kind === "right") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "left") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "both") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M12 4v16M6 12h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ReasonIcon({ kind }: { kind: ReasonIconKind }) {
  if (kind === "neck") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <path d="M8 6c0-2 1.6-3 4-3s4 1 4 3v4c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2V6Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 12v4c0 1.1.9 2 2 2s2-.9 2-2v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "back") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <path d="M8 4h8v4H8zM9 8h6l1 8h-8l1-8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "arm") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <path d="M7 6h4v5l3 2v5H9l-2-2V8l0-2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "leg") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <path d="M10 4h4l-1 7 2 9h-3l-1.2-6L9 20H6l2.3-8L10 4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "numbness") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <path d="M12 4v5M12 15v5M4 12h5M15 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (kind === "weakness") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <path d="M13 4c3 2 4 5 4 8a5 5 0 0 1-10 0c0-2.5 1.2-4.6 3-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M11 7h2v7h-2z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "walking") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <circle cx="13" cy="5" r="2" fill="currentColor" />
        <path d="m9 11 3-2 2 1 2 4M7 20l3-5 2-2M13 20l-1-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "followup") {
    return (
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <path d="M19 5v6h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 11a7 7 0 1 1-2-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
      <path d="M12 4 4 8v5c0 4.5 3.3 6.9 8 8 4.7-1.1 8-3.5 8-8V8l-8-4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PainFaceIcon({ score }: { score: number }) {
  const toneHue = Math.max(5, 114 - score * 10);
  const tone = `hsl(${toneHue} 68% 42%)`;

  const mouthPath = score <= 3 ? "M6 14 Q12 18 18 14" : score <= 6 ? "M6 15 L18 15" : "M6 16 Q12 12 18 16";

  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke={tone} strokeWidth="1.8" />
      <circle cx="8.5" cy="10" r="1" fill={tone} />
      <circle cx="15.5" cy="10" r="1" fill={tone} />
      <path d={mouthPath} fill="none" stroke={tone} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PainOrbitTicks({ score }: { score: number }) {
  const totalTicks = 20;
  const filledTicks = Math.max(2, Math.round((score / 10) * totalTicks));

  return (
    <span className="pain-score-orbit" aria-hidden="true">
      {Array.from({ length: totalTicks }).map((_, index) => {
        const isFilled = index < filledTicks;
        const t = index / (totalTicks - 1);
        const hue = 112 - t * 107;
        const fillColor = `hsl(${hue} 72% 46%)`;

        return (
          <span
            key={index}
            className="pain-score-orbit-tick"
            style={{
              transform: `translate(-50%, -50%) rotate(${index * (360 / totalTicks)}deg) translateY(calc(var(--orbit-radius) * -1))`,
              backgroundColor: isFilled ? fillColor : "#e4e8ee",
              boxShadow: isFilled ? `0 0 3px color-mix(in srgb, ${fillColor} 46%, #ffffff 54%)` : "none",
            }}
          />
        );
      })}
    </span>
  );
}

export function OneTimeQuestionnaireMock({
  sessionId,
  patientPhone,
  journeyMode = false,
  summaryMode = false,
}: {
  sessionId: string;
  patientPhone?: string;
  journeyMode?: boolean;
  summaryMode?: boolean;
}) {
  const [step, setStep] = useState<MockStep>("risk");
  const [selectedRiskIds, setSelectedRiskIds] = useState<string[]>([]);
  const [selectedReasonIds, setSelectedReasonIds] = useState<string[]>([]);
  const [frontIndex, setFrontIndex] = useState(0);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedSide, setSelectedSide] = useState<SideChoice | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<DurationChoice | null>(null);
  const [selectedOnset, setSelectedOnset] = useState<OnsetChoice | null>(null);
  const [selectedPainScore, setSelectedPainScore] = useState<number | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<PatternChoice | null>(null);
  const [selectedChangeOverall, setSelectedChangeOverall] = useState<ChangeOverallChoice | null>(null);
  const [selectedRadiating, setSelectedRadiating] = useState<RadiatingChoice | null>(null);
  const [selectedNumbness, setSelectedNumbness] = useState<NumbnessChoice | null>(null);
  const [selectedPainWorse, setSelectedPainWorse] = useState<PainWorseChoice[]>([]);
  const [selectedPainImproves, setSelectedPainImproves] = useState<PainImprovesChoice[]>([]);
  const [selectedTreatmentsTried, setSelectedTreatmentsTried] = useState<TreatmentTriedChoice[]>([]);
  const [selectedTreatmentHelped, setSelectedTreatmentHelped] = useState<TreatmentHelpedChoice | null>(null);
  const [legacyAnswers, setLegacyAnswers] = useState<Record<string, LegacyAnswerValue>>({});
  const [legacyQuestionIndex, setLegacyQuestionIndex] = useState(0);
  const [changeOverallFrontIndex, setChangeOverallFrontIndex] = useState(0);
  const [radiatingFrontIndex, setRadiatingFrontIndex] = useState(0);
  const [numbnessFrontIndex, setNumbnessFrontIndex] = useState(0);
  const [treatmentsFrontIndex, setTreatmentsFrontIndex] = useState(0);
  const [painWorseFrontIndex, setPainWorseFrontIndex] = useState(0);
  const [painImprovesFrontIndex, setPainImprovesFrontIndex] = useState(0);
  const [treatmentHelpedFrontIndex, setTreatmentHelpedFrontIndex] = useState(0);
  const [ndiPainFrontIndex, setNdiPainFrontIndex] = useState(0);
  const [ndiPersonalCareFrontIndex, setNdiPersonalCareFrontIndex] = useState(0);
  const [ndiLiftingFrontIndex, setNdiLiftingFrontIndex] = useState(0);
  const [ndiReadingFrontIndex, setNdiReadingFrontIndex] = useState(0);
  const [ndiHeadachesFrontIndex, setNdiHeadachesFrontIndex] = useState(0);
  const [ndiConcentrationFrontIndex, setNdiConcentrationFrontIndex] = useState(0);
  const [ndiWorkFrontIndex, setNdiWorkFrontIndex] = useState(0);
  const [ndiDrivingFrontIndex, setNdiDrivingFrontIndex] = useState(0);
  const [ndiSleepingFrontIndex, setNdiSleepingFrontIndex] = useState(0);
  const [ndiRecreationFrontIndex, setNdiRecreationFrontIndex] = useState(0);
  const [spineHealthFrontIndex, setSpineHealthFrontIndex] = useState(0);
  const [legacyDeckFrontIndexByQuestion, setLegacyDeckFrontIndexByQuestion] = useState<Record<string, number>>({});
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [finalSubmitError, setFinalSubmitError] = useState<string | null>(null);
  const [finalSubmitted, setFinalSubmitted] = useState(false);
  const [finalPromScore, setFinalPromScore] = useState<ReturnType<typeof computePromScore> | null>(null);
  const [painScoreFront, setPainScoreFront] = useState(5);
  const dragStartX = useRef<number | null>(null);
  const onsetDragStartX = useRef<number | null>(null);
  const changeOverallDragStartX = useRef<number | null>(null);
  const radiatingDragStartX = useRef<number | null>(null);
  const numbnessDragStartX = useRef<number | null>(null);
  const treatmentsDragStartX = useRef<number | null>(null);
  const painWorseDragStartX = useRef<number | null>(null);
  const painImprovesDragStartX = useRef<number | null>(null);
  const treatmentHelpedDragStartX = useRef<number | null>(null);
  const ndiPainDragStartX = useRef<number | null>(null);
  const ndiPersonalCareDragStartX = useRef<number | null>(null);
  const ndiLiftingDragStartX = useRef<number | null>(null);
  const ndiReadingDragStartX = useRef<number | null>(null);
  const ndiHeadachesDragStartX = useRef<number | null>(null);
  const ndiConcentrationDragStartX = useRef<number | null>(null);
  const ndiWorkDragStartX = useRef<number | null>(null);
  const ndiDrivingDragStartX = useRef<number | null>(null);
  const ndiSleepingDragStartX = useRef<number | null>(null);
  const ndiRecreationDragStartX = useRef<number | null>(null);
  const spineHealthDragStartX = useRef<number | null>(null);
  const legacyDeckDragStartX = useRef<number | null>(null);
  const painScoreDragStartX = useRef<number | null>(null);
  const painScoreSwipeHandled = useRef(false);
  const [onsetFrontIndex, setOnsetFrontIndex] = useState(0);
  const SWIPE_THRESHOLD = 56;

  const selectedSet = useMemo(() => new Set(selectedLabels), [selectedLabels]);

  const toggleLabel = (label: string) => {
    setSelectedLabels((current) => {
      if (current.includes(label)) {
        return current.filter((entry) => entry !== label);
      }
      return [...current, label];
    });
  };

  const toggleRiskOption = (id: string) => {
    setSelectedRiskIds((current) => {
      if (id === "none") {
        return current.includes("none") ? [] : ["none"];
      }

      const withoutNone = current.filter((entry) => entry !== "none");
      if (withoutNone.includes(id)) {
        return withoutNone.filter((entry) => entry !== id);
      }
      return [...withoutNone, id];
    });
  };

  const togglePainWorseOption = (id: PainWorseChoice) => {
    setSelectedPainWorse((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }
      return [...current, id];
    });
  };

  const togglePainImprovesOption = (id: PainImprovesChoice) => {
    setSelectedPainImproves((current) => {
      if (current.includes(id)) {
        return current.filter((entry) => entry !== id);
      }
      return [...current, id];
    });
  };

  const toggleTreatmentTriedOption = (id: TreatmentTriedChoice) => {
    setSelectedTreatmentsTried((current) => {
      if (id === "none-yet") {
        return current.includes("none-yet") ? [] : ["none-yet"];
      }

      const withoutNone = current.filter((entry) => entry !== "none-yet");
      if (withoutNone.includes(id)) {
        return withoutNone.filter((entry) => entry !== id);
      }
      return [...withoutNone, id];
    });
  };

  const goChangeOverallNext = () => setChangeOverallFrontIndex((current) => wrapIndex(current + 1, changeOverallOptions.length));
  const goChangeOverallPrev = () => setChangeOverallFrontIndex((current) => wrapIndex(current - 1, changeOverallOptions.length));

  const onChangeOverallPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    changeOverallDragStartX.current = event.clientX;
  };

  const onChangeOverallPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (changeOverallDragStartX.current === null) return;
    const delta = event.clientX - changeOverallDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goChangeOverallPrev();
    if (delta <= -SWIPE_THRESHOLD) goChangeOverallNext();
    changeOverallDragStartX.current = null;
  };

  const goRadiatingNext = () => setRadiatingFrontIndex((current) => wrapIndex(current + 1, radiatingOptions.length));
  const goRadiatingPrev = () => setRadiatingFrontIndex((current) => wrapIndex(current - 1, radiatingOptions.length));

  const onRadiatingPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    radiatingDragStartX.current = event.clientX;
  };

  const onRadiatingPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (radiatingDragStartX.current === null) return;
    const delta = event.clientX - radiatingDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goRadiatingPrev();
    if (delta <= -SWIPE_THRESHOLD) goRadiatingNext();
    radiatingDragStartX.current = null;
  };

  const goNumbnessNext = () => setNumbnessFrontIndex((current) => wrapIndex(current + 1, numbnessOptions.length));
  const goNumbnessPrev = () => setNumbnessFrontIndex((current) => wrapIndex(current - 1, numbnessOptions.length));

  const onNumbnessPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    numbnessDragStartX.current = event.clientX;
  };

  const onNumbnessPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (numbnessDragStartX.current === null) return;
    const delta = event.clientX - numbnessDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNumbnessPrev();
    if (delta <= -SWIPE_THRESHOLD) goNumbnessNext();
    numbnessDragStartX.current = null;
  };

  const goTreatmentsNext = () => setTreatmentsFrontIndex((current) => wrapIndex(current + 1, treatmentTriedOptions.length));
  const goTreatmentsPrev = () => setTreatmentsFrontIndex((current) => wrapIndex(current - 1, treatmentTriedOptions.length));

  const onTreatmentsPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    treatmentsDragStartX.current = event.clientX;
  };

  const onTreatmentsPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (treatmentsDragStartX.current === null) return;
    const delta = event.clientX - treatmentsDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goTreatmentsPrev();
    if (delta <= -SWIPE_THRESHOLD) goTreatmentsNext();
    treatmentsDragStartX.current = null;
  };

  const goPainWorseNext = () => setPainWorseFrontIndex((current) => wrapIndex(current + 1, painWorseOptions.length));
  const goPainWorsePrev = () => setPainWorseFrontIndex((current) => wrapIndex(current - 1, painWorseOptions.length));

  const onPainWorsePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    painWorseDragStartX.current = event.clientX;
  };

  const onPainWorsePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (painWorseDragStartX.current === null) return;
    const delta = event.clientX - painWorseDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goPainWorsePrev();
    if (delta <= -SWIPE_THRESHOLD) goPainWorseNext();
    painWorseDragStartX.current = null;
  };

  const goPainImprovesNext = () => setPainImprovesFrontIndex((current) => wrapIndex(current + 1, painImprovesOptions.length));
  const goPainImprovesPrev = () => setPainImprovesFrontIndex((current) => wrapIndex(current - 1, painImprovesOptions.length));

  const onPainImprovesPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    painImprovesDragStartX.current = event.clientX;
  };

  const onPainImprovesPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (painImprovesDragStartX.current === null) return;
    const delta = event.clientX - painImprovesDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goPainImprovesPrev();
    if (delta <= -SWIPE_THRESHOLD) goPainImprovesNext();
    painImprovesDragStartX.current = null;
  };

  const goTreatmentHelpedNext = () => setTreatmentHelpedFrontIndex((current) => wrapIndex(current + 1, treatmentHelpedOptions.length));
  const goTreatmentHelpedPrev = () => setTreatmentHelpedFrontIndex((current) => wrapIndex(current - 1, treatmentHelpedOptions.length));

  const onTreatmentHelpedPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    treatmentHelpedDragStartX.current = event.clientX;
  };

  const onTreatmentHelpedPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (treatmentHelpedDragStartX.current === null) return;
    const delta = event.clientX - treatmentHelpedDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goTreatmentHelpedPrev();
    if (delta <= -SWIPE_THRESHOLD) goTreatmentHelpedNext();
    treatmentHelpedDragStartX.current = null;
  };

  const goNdiPainNext = () => setNdiPainFrontIndex((current) => wrapIndex(current + 1, ndiPainIntensityCardOptions.length));
  const goNdiPainPrev = () => setNdiPainFrontIndex((current) => wrapIndex(current - 1, ndiPainIntensityCardOptions.length));

  const onNdiPainPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiPainDragStartX.current = event.clientX;
  };

  const onNdiPainPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiPainDragStartX.current === null) return;
    const delta = event.clientX - ndiPainDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiPainPrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiPainNext();
    ndiPainDragStartX.current = null;
  };

  const goNdiPersonalCareNext = () => setNdiPersonalCareFrontIndex((current) => wrapIndex(current + 1, ndiPersonalCareCardOptions.length));
  const goNdiPersonalCarePrev = () => setNdiPersonalCareFrontIndex((current) => wrapIndex(current - 1, ndiPersonalCareCardOptions.length));

  const onNdiPersonalCarePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiPersonalCareDragStartX.current = event.clientX;
  };

  const onNdiPersonalCarePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiPersonalCareDragStartX.current === null) return;
    const delta = event.clientX - ndiPersonalCareDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiPersonalCarePrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiPersonalCareNext();
    ndiPersonalCareDragStartX.current = null;
  };

  const goNdiLiftingNext = () => setNdiLiftingFrontIndex((current) => wrapIndex(current + 1, ndiLiftingCardOptions.length));
  const goNdiLiftingPrev = () => setNdiLiftingFrontIndex((current) => wrapIndex(current - 1, ndiLiftingCardOptions.length));

  const onNdiLiftingPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiLiftingDragStartX.current = event.clientX;
  };

  const onNdiLiftingPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiLiftingDragStartX.current === null) return;
    const delta = event.clientX - ndiLiftingDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiLiftingPrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiLiftingNext();
    ndiLiftingDragStartX.current = null;
  };

  const goNdiReadingNext = () => setNdiReadingFrontIndex((current) => wrapIndex(current + 1, ndiReadingCardOptions.length));
  const goNdiReadingPrev = () => setNdiReadingFrontIndex((current) => wrapIndex(current - 1, ndiReadingCardOptions.length));

  const onNdiReadingPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiReadingDragStartX.current = event.clientX;
  };

  const onNdiReadingPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiReadingDragStartX.current === null) return;
    const delta = event.clientX - ndiReadingDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiReadingPrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiReadingNext();
    ndiReadingDragStartX.current = null;
  };

  const goNdiHeadachesNext = () => setNdiHeadachesFrontIndex((current) => wrapIndex(current + 1, ndiHeadachesCardOptions.length));
  const goNdiHeadachesPrev = () => setNdiHeadachesFrontIndex((current) => wrapIndex(current - 1, ndiHeadachesCardOptions.length));

  const onNdiHeadachesPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiHeadachesDragStartX.current = event.clientX;
  };

  const onNdiHeadachesPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiHeadachesDragStartX.current === null) return;
    const delta = event.clientX - ndiHeadachesDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiHeadachesPrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiHeadachesNext();
    ndiHeadachesDragStartX.current = null;
  };

  const goNdiConcentrationNext = () => setNdiConcentrationFrontIndex((current) => wrapIndex(current + 1, ndiConcentrationCardOptions.length));
  const goNdiConcentrationPrev = () => setNdiConcentrationFrontIndex((current) => wrapIndex(current - 1, ndiConcentrationCardOptions.length));

  const onNdiConcentrationPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiConcentrationDragStartX.current = event.clientX;
  };

  const onNdiConcentrationPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiConcentrationDragStartX.current === null) return;
    const delta = event.clientX - ndiConcentrationDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiConcentrationPrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiConcentrationNext();
    ndiConcentrationDragStartX.current = null;
  };

  const goNdiWorkNext = () => setNdiWorkFrontIndex((current) => wrapIndex(current + 1, ndiWorkCardOptions.length));
  const goNdiWorkPrev = () => setNdiWorkFrontIndex((current) => wrapIndex(current - 1, ndiWorkCardOptions.length));

  const onNdiWorkPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiWorkDragStartX.current = event.clientX;
  };

  const onNdiWorkPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiWorkDragStartX.current === null) return;
    const delta = event.clientX - ndiWorkDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiWorkPrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiWorkNext();
    ndiWorkDragStartX.current = null;
  };

  const goNdiDrivingNext = () => setNdiDrivingFrontIndex((current) => wrapIndex(current + 1, ndiDrivingCardOptions.length));
  const goNdiDrivingPrev = () => setNdiDrivingFrontIndex((current) => wrapIndex(current - 1, ndiDrivingCardOptions.length));

  const onNdiDrivingPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiDrivingDragStartX.current = event.clientX;
  };

  const onNdiDrivingPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiDrivingDragStartX.current === null) return;
    const delta = event.clientX - ndiDrivingDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiDrivingPrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiDrivingNext();
    ndiDrivingDragStartX.current = null;
  };

  const goNdiSleepingNext = () => setNdiSleepingFrontIndex((current) => wrapIndex(current + 1, ndiSleepingCardOptions.length));
  const goNdiSleepingPrev = () => setNdiSleepingFrontIndex((current) => wrapIndex(current - 1, ndiSleepingCardOptions.length));

  const onNdiSleepingPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiSleepingDragStartX.current = event.clientX;
  };

  const onNdiSleepingPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiSleepingDragStartX.current === null) return;
    const delta = event.clientX - ndiSleepingDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiSleepingPrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiSleepingNext();
    ndiSleepingDragStartX.current = null;
  };

  const goNdiRecreationNext = () => setNdiRecreationFrontIndex((current) => wrapIndex(current + 1, ndiRecreationCardOptions.length));
  const goNdiRecreationPrev = () => setNdiRecreationFrontIndex((current) => wrapIndex(current - 1, ndiRecreationCardOptions.length));

  const onNdiRecreationPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    ndiRecreationDragStartX.current = event.clientX;
  };

  const onNdiRecreationPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (ndiRecreationDragStartX.current === null) return;
    const delta = event.clientX - ndiRecreationDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goNdiRecreationPrev();
    if (delta <= -SWIPE_THRESHOLD) goNdiRecreationNext();
    ndiRecreationDragStartX.current = null;
  };

  const goSpineHealthNext = () => setSpineHealthFrontIndex((current) => wrapIndex(current + 1, spineHealthCardOptions.length));
  const goSpineHealthPrev = () => setSpineHealthFrontIndex((current) => wrapIndex(current - 1, spineHealthCardOptions.length));

  const onSpineHealthPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    spineHealthDragStartX.current = event.clientX;
  };

  const onSpineHealthPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (spineHealthDragStartX.current === null) return;
    const delta = event.clientX - spineHealthDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goSpineHealthPrev();
    if (delta <= -SWIPE_THRESHOLD) goSpineHealthNext();
    spineHealthDragStartX.current = null;
  };

  const getStackCardStyle = (distance: number, absDistance: number, isFront: boolean): React.CSSProperties => ({
    transform: `translate(calc(-50% + ${distance * 92}px), calc(-50% + ${absDistance * 7}px)) translateZ(${172 - absDistance * 56}px) rotateY(${distance * -8}deg) scale(${isFront ? 1 : 0.88})`,
    zIndex: 110 - absDistance,
    opacity: absDistance > 2 ? 0.72 : 1,
  });

  const frontReason = reasonOptions[frontIndex];
  const goReasonNext = () => setFrontIndex((current) => wrapIndex(current + 1, reasonOptions.length));
  const goReasonPrev = () => setFrontIndex((current) => wrapIndex(current - 1, reasonOptions.length));

  const toggleFrontReason = () => {
    if (!frontReason) return;
    setSelectedReasonIds((current) => {
      if (current.includes(frontReason.id)) {
        return current.filter((entry) => entry !== frontReason.id);
      }
      return [...current, frontReason.id];
    });
  };

  const onReasonPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    dragStartX.current = event.clientX;
  };

  const onReasonPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (dragStartX.current === null) return;
    const delta = event.clientX - dragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goReasonPrev();
    if (delta <= -SWIPE_THRESHOLD) goReasonNext();
    dragStartX.current = null;
  };

  const goOnsetNext = () => setOnsetFrontIndex((current) => wrapIndex(current + 1, onsetOptions.length));
  const goOnsetPrev = () => setOnsetFrontIndex((current) => wrapIndex(current - 1, onsetOptions.length));

  const onOnsetPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    onsetDragStartX.current = event.clientX;
  };

  const onOnsetPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (onsetDragStartX.current === null) return;
    const delta = event.clientX - onsetDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goOnsetPrev();
    if (delta <= -SWIPE_THRESHOLD) goOnsetNext();
    onsetDragStartX.current = null;
  };

  const shiftPainScore = (delta: number) => {
    setPainScoreFront((current) => {
      const next = Math.max(0, Math.min(10, current + delta));
      setSelectedPainScore(next);
      return next;
    });
  };

  const onPainScorePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    painScoreDragStartX.current = event.clientX;
    painScoreSwipeHandled.current = false;
  };

  const onPainScorePointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (painScoreDragStartX.current === null || painScoreSwipeHandled.current) return;
    const dragDelta = event.clientX - painScoreDragStartX.current;
    if (dragDelta >= 30) {
      shiftPainScore(-1);
      painScoreSwipeHandled.current = true;
      return;
    }
    if (dragDelta <= -30) {
      shiftPainScore(1);
      painScoreSwipeHandled.current = true;
    }
  };

  const onPainScorePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (painScoreDragStartX.current === null) return;
    if (painScoreSwipeHandled.current) {
      painScoreDragStartX.current = null;
      return;
    }
    const dragDelta = event.clientX - painScoreDragStartX.current;
    if (dragDelta >= 36) shiftPainScore(-1);
    if (dragDelta <= -36) shiftPainScore(1);
    painScoreDragStartX.current = null;
  };

  const shouldAskSideQuestion = useMemo(() => {
    const hasMidline = selectedLabels.some((label) => midlineLabels.has(label));
    const hasLeft = selectedLabels.some((label) => leftLateralLabels.has(label));
    const hasRight = selectedLabels.some((label) => rightLateralLabels.has(label));
    return hasMidline && (hasLeft || hasRight);
  }, [selectedLabels]);

  const basePreConsultAnswers = useMemo(() => {
    const redFlags: Record<string, boolean> = {
      redFlagBladderBowel: false,
      redFlagRapidWeakness: false,
      redFlagFever: false,
      redFlagTrauma: false,
      redFlagCancer: false,
      redFlagWeightLoss: false,
      redFlagNone: false,
    };

    if (selectedRiskIds.includes("none")) {
      redFlags.redFlagNone = true;
    } else {
      for (const selectedId of selectedRiskIds) {
        const mappedKey = riskKeyByOptionId[selectedId];
        if (mappedKey) {
          redFlags[mappedKey] = true;
        }
      }
    }

    return {
      ...redFlags,
      q1PrimaryReason: selectedReasonIds.length > 0 ? reasonToQ1[selectedReasonIds[0]] : undefined,
      q2PainRegion: selectedLabels.map((label) => painRegionByLabel[label]).filter(Boolean),
      q3Side: selectedSide ?? undefined,
      q4Duration: selectedDuration ? durationToQ4[selectedDuration] : undefined,
      q5Onset: selectedOnset ? onsetToQ5[selectedOnset] : undefined,
      q6VasPain: selectedPainScore ?? undefined,
      q7PainPattern: selectedPattern ?? undefined,
      q8Trend: selectedChangeOverall ?? undefined,
      q9RadiatingPain: selectedRadiating ?? undefined,
      q10Numbness: selectedNumbness ?? undefined,
      q11Weakness: selectedNumbness === null ? undefined : selectedNumbness === "none" ? "none" : selectedNumbness === "occasional" ? "mild" : selectedNumbness === "frequent" ? "moderate" : "progressive",
      q12PainWorsens: selectedPainWorse.map((value) => painWorseToQ12[value]),
      q13PainImproves: selectedPainImproves.map((value) => painImprovesToQ13[value]),
      q14TreatmentTried: selectedTreatmentsTried.map((value) => treatmentsToQ14[value]),
      q15TreatmentHelped: selectedTreatmentHelped ?? undefined,
    } as Record<string, unknown>;
  }, [
    selectedRiskIds,
    selectedReasonIds,
    selectedLabels,
    selectedSide,
    selectedDuration,
    selectedOnset,
    selectedPainScore,
    selectedPattern,
    selectedChangeOverall,
    selectedRadiating,
    selectedNumbness,
    selectedPainWorse,
    selectedPainImproves,
    selectedTreatmentsTried,
    selectedTreatmentHelped,
  ]);

  const legacyQuestions = useMemo(() => {
    const followupSections = preConsultSections.filter(
      (section) => section.id === "prom-odi" || section.id === "prom-ndi" || section.id === "outcome-myelopathy",
    );
    const mergedAnswers = {
      ...basePreConsultAnswers,
      ...legacyAnswers,
    } as Record<string, unknown>;

    return followupSections.flatMap((section) =>
      section.questions.filter((question) => (question.showIf ? question.showIf(mergedAnswers) : true)),
    );
  }, [basePreConsultAnswers, legacyAnswers]);

  const legacyQuestion = legacyQuestions[legacyQuestionIndex];
  const activeLegacyDeckOptions = legacyQuestion ? legacyDeckCardOptionMap[legacyQuestion.id] : undefined;
  const activeLegacyDeckFrontIndex = legacyQuestion ? (legacyDeckFrontIndexByQuestion[legacyQuestion.id] ?? 0) : 0;

  const goLegacyDeckNext = () => {
    if (!legacyQuestion || !activeLegacyDeckOptions) return;
    setLegacyDeckFrontIndexByQuestion((current) => {
      const nextIndex = wrapIndex((current[legacyQuestion.id] ?? 0) + 1, activeLegacyDeckOptions.length);
      return { ...current, [legacyQuestion.id]: nextIndex };
    });
  };

  const goLegacyDeckPrev = () => {
    if (!legacyQuestion || !activeLegacyDeckOptions) return;
    setLegacyDeckFrontIndexByQuestion((current) => {
      const nextIndex = wrapIndex((current[legacyQuestion.id] ?? 0) - 1, activeLegacyDeckOptions.length);
      return { ...current, [legacyQuestion.id]: nextIndex };
    });
  };

  const onLegacyDeckPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    legacyDeckDragStartX.current = event.clientX;
  };

  const onLegacyDeckPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (legacyDeckDragStartX.current === null) return;
    const delta = event.clientX - legacyDeckDragStartX.current;
    if (delta >= SWIPE_THRESHOLD) goLegacyDeckPrev();
    if (delta <= -SWIPE_THRESHOLD) goLegacyDeckNext();
    legacyDeckDragStartX.current = null;
  };

  const isLegacyAnswered = (value: LegacyAnswerValue | undefined) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    if (typeof value === "number") {
      return true;
    }
    if (typeof value === "boolean") {
      return true;
    }
    return false;
  };

  const nextEnabled = (() => {
    if (step === "risk") return selectedRiskIds.length > 0;
    if (step === "reason") return selectedReasonIds.length > 0;
    if (step === "pain-map") return selectedLabels.length > 0;
    if (step === "side") return selectedSide !== null;
    if (step === "duration") return selectedDuration !== null;
    if (step === "onset") return selectedOnset !== null;
    if (step === "pain-score") return selectedPainScore !== null;
    if (step === "pattern") return selectedPattern !== null;
    if (step === "change-overall") return selectedChangeOverall !== null;
    if (step === "radiating") return selectedRadiating !== null;
    if (step === "numbness") return selectedNumbness !== null;
    if (step === "pain-worse-with") return true;
    if (step === "pain-improves-with") return true;
    if (step === "treatments-tried") return true;
    if (step === "treatment-helped") return selectedTreatmentHelped !== null;
    if (step === "legacy-followup") {
      if (!legacyQuestion) return false;
      if (!legacyQuestion.required) return true;
      return isLegacyAnswered(legacyAnswers[legacyQuestion.id]);
    }
    return false;
  })();

  const handleBack = () => {
    if (step === "reason") {
      setStep("risk");
      return;
    }

    if (step === "pain-map") {
      setStep("reason");
      return;
    }

    if (step === "side") {
      setStep("pain-map");
      return;
    }

    if (step === "duration") {
      setStep(shouldAskSideQuestion ? "side" : "pain-map");
      return;
    }

    if (step === "onset") {
      setStep("duration");
      return;
    }

    if (step === "pain-score") {
      setStep("onset");
      return;
    }

    if (step === "pattern") {
      setStep("pain-score");
      return;
    }

    if (step === "change-overall") {
      setStep("pattern");
      return;
    }

    if (step === "radiating") {
      setStep("change-overall");
      return;
    }

    if (step === "numbness") {
      setStep("radiating");
      return;
    }

    if (step === "pain-worse-with") {
      setStep("numbness");
      return;
    }

    if (step === "pain-improves-with") {
      setStep("pain-worse-with");
      return;
    }

    if (step === "treatments-tried") {
      setStep("pain-improves-with");
      return;
    }

    if (step === "treatment-helped") {
      setStep("treatments-tried");
      return;
    }

    if (step === "legacy-followup") {
      if (legacyQuestionIndex > 0) {
        setLegacyQuestionIndex((current) => current - 1);
        return;
      }
      setStep("treatment-helped");
    }
  };

  const handleNext = () => {
    if (isSubmittingFinal || finalSubmitted) {
      return;
    }

    const proceedTo = (advance: () => void) => {
      advance();
    };

    if (step === "risk" && selectedRiskIds.length > 0) {
      proceedTo(() => setStep("reason"));
      return;
    }

    if (step === "reason" && selectedReasonIds.length > 0) {
      proceedTo(() => setStep("pain-map"));
      return;
    }

    if (step === "pain-map" && selectedLabels.length > 0) {
      proceedTo(() => {
        if (shouldAskSideQuestion) {
          setStep("side");
        } else {
          setStep("duration");
        }
      });
      return;
    }

    if (step === "side" && selectedSide) {
      proceedTo(() => setStep("duration"));
      return;
    }

    if (step === "duration" && selectedDuration) {
      proceedTo(() => setStep("onset"));
      return;
    }

    if (step === "onset" && selectedOnset) {
      proceedTo(() => setStep("pain-score"));
      return;
    }

    if (step === "pain-score" && selectedPainScore !== null) {
      proceedTo(() => setStep("pattern"));
      return;
    }

    if (step === "pattern" && selectedPattern) {
      proceedTo(() => setStep("change-overall"));
      return;
    }

    if (step === "change-overall" && selectedChangeOverall) {
      proceedTo(() => setStep("radiating"));
      return;
    }

    if (step === "radiating" && selectedRadiating) {
      proceedTo(() => setStep("numbness"));
      return;
    }

    if (step === "numbness" && selectedNumbness) {
      proceedTo(() => setStep("pain-worse-with"));
      return;
    }

    if (step === "pain-worse-with") {
      proceedTo(() => setStep("pain-improves-with"));
      return;
    }

    if (step === "pain-improves-with") {
      proceedTo(() => setStep("treatments-tried"));
      return;
    }

    if (step === "treatments-tried") {
      proceedTo(() => setStep("treatment-helped"));
      return;
    }

    if (step === "treatment-helped" && selectedTreatmentHelped) {
      if (legacyQuestions.length > 0) {
        proceedTo(() => {
          setLegacyQuestionIndex(0);
          setStep("legacy-followup");
        });
      }
      return;
    }

    if (step === "legacy-followup" && legacyQuestion) {
      if (legacyQuestionIndex < legacyQuestions.length - 1) {
        proceedTo(() => {
          setLegacyQuestionIndex((current) => current + 1);
        });
      } else {
        if (isSubmittingFinal || finalSubmitted) {
          return;
        }

        setFinalSubmitError(null);
        setIsSubmittingFinal(true);

        autosaveAbortRef.current?.abort();

        void fetch("/api/patient-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            patientPhone: patientPhone?.replace(/\D/g, "") || undefined,
            answers: canonicalAnswers,
            sectionIndex: 0,
            questionIndex: Math.max(progressStep - 1, 0),
            submitted: true,
            updatedAt: new Date().toISOString(),
          }),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("submit-failed");
            }
            setFinalPromScore(resolvedPromScore);

            if (journeyMode) {
              if (typeof window !== "undefined") {
                window.localStorage.setItem(
                  `sei-patient-journey-summary:${sessionId}`,
                  JSON.stringify({
                    promScore: resolvedPromScore,
                    selectedRadiating,
                    selectedNumbness,
                    selectedChangeOverall,
                    selectedTreatmentHelped,
                    savedAt: new Date().toISOString(),
                  }),
                );

                const normalizedPhone = (patientPhone ?? "").replace(/\D/g, "");
                const uploadUrl = `/patient/upload/${encodeURIComponent(sessionId)}?journey=1${
                  normalizedPhone ? `&phone=${encodeURIComponent(normalizedPhone)}` : ""
                }`;
                window.location.href = uploadUrl;
              }
              return;
            }

            setFinalSubmitted(true);
          })
          .catch(() => {
            setFinalSubmitError("Could not finish right now. Please try again.");
          })
          .finally(() => {
            setIsSubmittingFinal(false);
          });
      }
      return;
    }
  };

  const baseProgressTotal = shouldAskSideQuestion ? 15 : 14;
  const progressStep = (() => {
    if (step === "risk") return 1;
    if (step === "reason") return 2;
    if (step === "pain-map") return 3;
    if (step === "side") return 4;
    if (step === "duration") return shouldAskSideQuestion ? 5 : 4;
    if (step === "onset") return shouldAskSideQuestion ? 6 : 5;
    if (step === "pain-score") return shouldAskSideQuestion ? 7 : 6;
    if (step === "pattern") return shouldAskSideQuestion ? 8 : 7;
    if (step === "change-overall") return shouldAskSideQuestion ? 9 : 8;
    if (step === "radiating") return shouldAskSideQuestion ? 10 : 9;
    if (step === "numbness") return shouldAskSideQuestion ? 11 : 10;
    if (step === "pain-worse-with") return shouldAskSideQuestion ? 12 : 11;
    if (step === "pain-improves-with") return shouldAskSideQuestion ? 13 : 12;
    if (step === "treatments-tried") return shouldAskSideQuestion ? 14 : 13;
    if (step === "treatment-helped") return shouldAskSideQuestion ? 15 : 14;
    if (step === "legacy-followup") return baseProgressTotal + legacyQuestionIndex + 1;
    return 1;
  })();
  const progressTotal = baseProgressTotal + legacyQuestions.length;
  const progressLabel = `${progressStep} of ${progressTotal}`;
  const progressWidthStyle = { width: `${Math.min(100, Math.round((progressStep / progressTotal) * 100))}%` };
  const riskPrimaryOptions = riskOptions.filter((option) => option.id !== "none");
  const riskNoneOption = riskOptions.find((option) => option.id === "none");
  const isFinalStep = step === "legacy-followup" && legacyQuestionIndex >= legacyQuestions.length - 1;
  const nextDisabled = !nextEnabled || isSubmittingFinal || finalSubmitted;
  const useClassicUi = false;
  const autosaveAbortRef = useRef<AbortController | null>(null);

  const canonicalAnswers = (() => {
    const merged = {
      ...basePreConsultAnswers,
      ...legacyAnswers,
    } as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(merged).filter(([, value]) => {
        if (value === undefined || value === null) {
          return false;
        }
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        if (typeof value === "string") {
          return value.trim().length > 0;
        }
        return true;
      }),
    ) as Record<string, LegacyAnswerValue>;
  })();

  useEffect(() => {
    if (!summaryMode || !sessionId) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(`sei-patient-journey-summary:${sessionId}`);
    if (!raw) {
      setFinalSubmitted(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        promScore?: ReturnType<typeof computePromScore>;
        selectedRadiating?: RadiatingChoice;
        selectedNumbness?: NumbnessChoice;
        selectedChangeOverall?: ChangeOverallChoice;
        selectedTreatmentHelped?: TreatmentHelpedChoice;
      };

      if (parsed.promScore) {
        setFinalPromScore(parsed.promScore);
      }
      if (parsed.selectedRadiating) {
        setSelectedRadiating(parsed.selectedRadiating);
      }
      if (parsed.selectedNumbness) {
        setSelectedNumbness(parsed.selectedNumbness);
      }
      if (parsed.selectedChangeOverall) {
        setSelectedChangeOverall(parsed.selectedChangeOverall);
      }
      if (parsed.selectedTreatmentHelped) {
        setSelectedTreatmentHelped(parsed.selectedTreatmentHelped);
      }
    } catch {
      // Ignore malformed local summary snapshots and still show final summary view.
    }

    setFinalSubmitted(true);
  }, [sessionId, summaryMode]);

  useEffect(() => {
    if (!sessionId || finalSubmitted || isSubmittingFinal) {
      return;
    }

    const timer = window.setTimeout(() => {
      autosaveAbortRef.current?.abort();
      const controller = new AbortController();
      autosaveAbortRef.current = controller;

      void fetch("/api/patient-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          patientPhone: patientPhone?.replace(/\D/g, "") || undefined,
          answers: canonicalAnswers,
          sectionIndex: 0,
          questionIndex: Math.max(progressStep - 1, 0),
          submitted: false,
          updatedAt: new Date().toISOString(),
        }),
        signal: controller.signal,
      }).catch(() => undefined);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canonicalAnswers, finalSubmitted, isSubmittingFinal, patientPhone, progressStep, sessionId]);

  const resolvedPromScore = useMemo(() => {
    const answerRecord = canonicalAnswers as Record<string, unknown>;
    const inferred = computePromScore(answerRecord);
    const ndi = computePromScore({ ...answerRecord, q1PrimaryReason: "neck-pain" });
    const odi = computePromScore({ ...answerRecord, q1PrimaryReason: "back-pain" });

    const candidates = [inferred, ndi, odi];
    candidates.sort((a, b) => {
      if (b.answeredItems !== a.answeredItems) {
        return b.answeredItems - a.answeredItems;
      }
      const aPercent = a.percent ?? -1;
      const bPercent = b.percent ?? -1;
      return bPercent - aPercent;
    });

    return candidates[0];
  }, [canonicalAnswers]);

  const promScore = finalPromScore ?? resolvedPromScore;
  const promPercent = promScore.percent === null ? null : Math.round(promScore.percent);

  const impactBand = (() => {
    if (promPercent === null) return { label: "Impact not available", tone: "#64748b", color: "#f59e0b", subtitle: "Please complete all required items to compute your impact score." };
    if (promPercent >= 67) return { label: "High impact", tone: "#dc2626", color: "#ef4444", subtitle: "Your symptoms are significantly affecting your daily function." };
    if (promPercent >= 34) return { label: "Moderate impact", tone: "#ea580c", color: "#f97316", subtitle: "Your symptoms are affecting your daily activities moderately." };
    return { label: "Mild impact", tone: "#ca8a04", color: "#f59e0b", subtitle: "Your symptoms are currently having a mild impact on daily life." };
  })();

  const impactedAreasText =
    selectedLabels.length === 0
      ? "general spinal areas"
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : selectedLabels.length === 2
          ? `${selectedLabels[0]} and ${selectedLabels[1]}`
          : `${selectedLabels.slice(0, -1).join(", ")}, and ${selectedLabels[selectedLabels.length - 1]}`;

  const movementTriggers = selectedPainWorse
    .map((id) => painWorseOptions.find((option) => option.id === id)?.label.toLowerCase())
    .filter(Boolean) as string[];
  const movementText =
    movementTriggers.length === 0
      ? "daily movements"
      : movementTriggers.length === 1
        ? movementTriggers[0]
        : movementTriggers.length === 2
          ? `${movementTriggers[0]} and ${movementTriggers[1]}`
          : `${movementTriggers.slice(0, 2).join(", ")}, and ${movementTriggers[2]}`;

  const summaryDateLabel = new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const painLocationText = selectedLabels.length
    ? `Pain mainly in ${impactedAreasText.toLowerCase()}.`
    : "Pain mainly in general spinal areas.";
  const activityText = `You are experiencing more limitation with ${movementText}.`;
  const radiatingText = selectedRadiating && selectedRadiating !== "none" ? `Radiating pain is ${selectedRadiating}.` : "No radiating pain reported.";
  const numbnessText = selectedNumbness && selectedNumbness !== "none" ? `Numbness or tingling is ${selectedNumbness}.` : "No numbness or tingling reported.";
  const trendText = selectedChangeOverall ? `Overall trend appears ${selectedChangeOverall.replace(/-/g, " ")}.` : "Overall trend information not available.";

  const summaryRows = [
    { key: "pain-location", title: "Pain location", text: painLocationText, icon: "🦴", badgeClass: "bg-[#ffe9e9] text-[#ef4444]" },
    { key: "activity", title: "Activity limitation", text: activityText, icon: "🚶", badgeClass: "bg-[#fff1df] text-[#f59e0b]" },
    { key: "radiating", title: "Radiating pain", text: radiatingText, icon: "🖐", badgeClass: "bg-[#fff7df] text-[#f59e0b]" },
    { key: "numbness", title: "Numbness or tingling", text: numbnessText, icon: "≈", badgeClass: "bg-[#fff6dd] text-[#d97706]" },
    { key: "trend", title: "Overall trend", text: trendText, icon: "↗", badgeClass: "bg-[#eaf1ff] text-[#2563eb]" },
  ] as const;

  if (finalSubmitted) {
    return (
      <main className="pain-screen min-h-[100svh] bg-[#f4f8ff] px-3 py-3 text-[#1f456e] sm:px-5 sm:py-4 lg:px-8 lg:py-5">
        <section className="mx-auto w-full max-w-[980px] rounded-[2rem] border border-[#dde7f6] bg-[#f8fbff] p-3 shadow-[0_24px_80px_rgba(24,64,112,0.12)] sm:p-4 lg:p-5">
          <header className="mb-3 text-center">
            <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2 sm:grid-cols-[60px_minmax(0,1fr)_60px]">
              <button type="button" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-full border border-[#e2eaf7] bg-white text-xl text-[#20406a] shadow-sm sm:h-12 sm:w-12">
                ‹
              </button>
              <div>
                <h1 className="headline text-xl font-semibold leading-tight text-[#162c4d] sm:text-2xl">Assessment Summary</h1>
                <p className="mt-1 text-xs text-[#6b7f9d] sm:text-sm">{summaryDateLabel}</p>
              </div>
              <button type="button" aria-label="Share" className="grid h-11 w-11 place-items-center rounded-full border border-[#e2eaf7] bg-white text-lg text-[#20406a] shadow-sm sm:h-12 sm:w-12">
                ⤴
              </button>
            </div>
          </header>

          <article className="rounded-[1.7rem] border border-[#ffd8d8] bg-white px-4 py-4 shadow-[0_12px_34px_rgba(236,91,91,0.1)] sm:px-5 sm:py-5">
            <div className="grid grid-cols-[minmax(0,0.95fr)_1px_minmax(0,1.05fr)] items-stretch gap-3 sm:gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#1b3360] sm:text-xl">Overall Score</h2>
                <p className="mt-3 text-3xl font-semibold leading-none text-[#ef3f3f] sm:text-5xl">{promPercent ?? "-"}</p>
                <p className="mt-1 text-xl font-semibold leading-none text-[#6c7f9b] sm:text-3xl">/100</p>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#ffe7e7] px-3 py-1.5 text-base font-semibold text-[#ef3f3f] sm:px-4 sm:py-2 sm:text-xl">
                  <span aria-hidden="true">↗</span>
                  {impactBand.label}
                </span>
              </div>

              <div className="w-px bg-[#e8eef8]" aria-hidden="true" />

              <div className="overflow-hidden rounded-xl bg-white">
                <div className="flex items-center gap-3 border-b border-[#e8eef8] px-1 py-3 sm:py-4">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ecf2ff] text-xl">📋</span>
                  <div>
                    <p className="text-xs text-[#5f7390] sm:text-sm">Instrument</p>
                    <p className="text-lg font-semibold text-[#1c345c] sm:text-xl">{promScore.instrument}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-b border-[#e8eef8] px-1 py-3 sm:py-4">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fff3df] text-xl">⚠</span>
                  <div>
                    <p className="text-xs text-[#5f7390] sm:text-sm">Severity</p>
                    <p className="text-lg font-semibold leading-tight text-[#ef3f3f] sm:text-xl">{promScore.severity}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 px-1 py-3 sm:py-4">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e6f8ea] text-xl">🎯</span>
                  <div>
                    <p className="text-xs text-[#5f7390] sm:text-sm">Score</p>
                    <p className="text-lg font-semibold text-[#2f9c47] sm:text-xl">{promScore.totalScore} / {promScore.maxScore || promScore.expectedItems * 5}</p>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="mt-4 rounded-[1.7rem] border border-[#dee7f7] bg-white px-4 py-4 shadow-[0_14px_34px_rgba(37,84,142,0.08)] sm:px-5 sm:py-5">
            <h2 className="text-xl font-semibold text-[#1a345d] sm:text-2xl">Summary</h2>

            <div className="mt-3 divide-y divide-[#e8eef8]">
              {summaryRows.map((row) => (
                <div key={row.key} className="flex items-start gap-3 py-3">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg ${row.badgeClass}`}>{row.icon}</span>
                  <div>
                    <p className="text-lg font-semibold leading-tight text-[#1f365d] sm:text-xl">{row.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#304c72] sm:text-sm sm:leading-6">{row.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="pain-screen min-h-[100svh] px-3 py-3 pb-24 text-[#1f456e] sm:px-5 sm:py-5 sm:pb-28 lg:px-8 lg:py-6 lg:pb-32">
      <div className="mx-auto w-full max-w-[1240px]">
        <section
          className={`relative flex min-h-[calc(100svh-11rem)] flex-col overflow-hidden rounded-[2rem] border border-[#d5e5f7] bg-white px-3 py-3 shadow-[0_28px_90px_rgba(22,63,108,0.16)] sm:min-h-[calc(100svh-12rem)] sm:px-6 sm:py-5 lg:min-h-[calc(100svh-13rem)] lg:px-8 lg:py-6 ${progressStep >= 7 ? "pb-2 sm:pb-3 lg:pb-3" : ""}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_90%,rgba(171,228,182,0.18),transparent_36%),radial-gradient(circle_at_88%_4%,rgba(137,196,255,0.2),transparent_32%)]" />

          <header className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <button type="button" aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full border border-[#d3e2f3] bg-white text-xl text-[#2f577e] shadow-sm">
                ‹
              </button>

              <div className="min-w-0 flex-1 px-3 sm:px-8">
                <p className="text-center text-base font-semibold text-[#173e67] sm:text-lg">{progressLabel}</p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2edf7]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#9de84a,#66c56f)] shadow-[0_6px_12px_rgba(99,182,92,0.38)]" style={progressWidthStyle} />
                </div>
              </div>

              <div className="h-10 w-10" aria-hidden="true" />
            </div>
          </header>

          {step === "risk" ? (
            <div className="relative z-10 mt-6">
              <div className="mx-auto w-full max-w-[980px]">
                <h1 className="headline text-center text-3xl font-semibold text-[#0f2642] sm:text-4xl">Safety first</h1>
                <h2 className="mt-1.5 text-center text-2xl font-semibold text-[#2661a1] sm:text-3xl">First, a quick safety check</h2>
                <p className="mx-auto mt-2 max-w-[52ch] text-center text-base leading-7 text-[#2b4c6e] sm:text-lg">
                  A few rare but important signs. Tap anything you have noticed recently, or choose None of these.
                </p>

                <div className="mx-auto mt-6 grid max-w-[980px] grid-cols-3 gap-2.5 sm:gap-3">
                  {riskPrimaryOptions.map((option) => {
                    const active = selectedRiskIds.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleRiskOption(option.id)}
                        className={`risk-card ${active ? "risk-card-active" : ""}`}
                        aria-pressed={active}
                      >
                        <span className="risk-image-wrap" aria-hidden="true">
                          <Image
                            src={option.imageSrc}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 1024px) 45vw, 300px"
                          />
                        </span>

                        <span className="risk-label">{option.label}</span>
                        <span className={`risk-dot ${active ? "risk-dot-active" : ""}`} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>

                {riskNoneOption ? (
                  <button
                    type="button"
                    onClick={() => toggleRiskOption(riskNoneOption.id)}
                    className={`risk-none-card ${selectedRiskIds.includes("none") ? "risk-none-card-active" : ""}`}
                    aria-pressed={selectedRiskIds.includes("none")}
                  >
                    <span className="flex items-center gap-4 sm:gap-6">
                      <span className="risk-none-image-wrap" aria-hidden="true">
                        <Image
                          src={riskNoneOption.imageSrc}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 24vw, 190px"
                        />
                      </span>
                      <span className="risk-none-label">None of these</span>
                    </span>

                    <span className={`risk-none-check ${selectedRiskIds.includes("none") ? "risk-none-check-active" : ""}`} aria-hidden="true">
                      ✓
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : step === "reason" ? (
            <div className="relative z-10 mt-6">
              <div className="mx-auto w-full max-w-[920px] text-center">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">Primary reason for this consultation</h1>
              </div>

              <div className="mx-auto mt-4 flex min-h-[62vh] w-full max-w-[920px] flex-col rounded-[1.4rem] border border-[#d8e7f4] bg-[linear-gradient(180deg,#fafdff,#eef6ff)] px-3 py-4 sm:px-4 sm:py-5">
                <div
                  className="reason-space"
                  onPointerDown={onReasonPointerDown}
                  onPointerUp={onReasonPointerUp}
                  onPointerCancel={() => {
                    dragStartX.current = null;
                  }}
                >
                  {reasonOptions.map((option, index) => {
                    const distance = circularDistance(index, frontIndex, reasonOptions.length);
                    const absDistance = Math.abs(distance);

                    if (absDistance > 3) return null;

                    const isFront = distance === 0;
                    const isSelected = selectedReasonIds.includes(option.id);

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          if (isFront) {
                            toggleFrontReason();
                            return;
                          }
                          setFrontIndex(index);
                        }}
                        className={`reason-card ${isFront ? "reason-card-front" : ""} ${isSelected ? "reason-card-selected" : ""}`}
                        style={{
                          transform: `translate(calc(-50% + ${distance * 52}px), calc(-50% + ${absDistance * 9}px)) translateZ(${168 - absDistance * 62}px) rotateY(${distance * -9}deg) scale(${isFront ? 1 : 0.94})`,
                          zIndex: 100 - absDistance,
                          opacity: absDistance > 2 ? 0.62 : 1,
                        }}
                      >
                        <span className="reason-card-check" aria-hidden="true">{isSelected ? "✓" : ""}</span>
                        <span className="reason-icon-orb" aria-hidden="true">
                          <ReasonIcon kind={option.icon} />
                        </span>
                        <span className="reason-card-title">{option.label}</span>
                        <span className="reason-card-helper">{option.helper}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 text-center text-sm text-[#3d638a] sm:text-base">
                  Swipe left or right, then tap the front card to select multiple reasons.
                </p>
              </div>
            </div>
          ) : step === "pain-map" ? (
            <div className="relative z-10 mt-5">
            <div className="mx-auto w-full max-w-[660px] text-center">
              <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">Where does it hurt?</h1>
              <p className="mx-auto mt-2 max-w-[32ch] text-base leading-7 text-[#2b4c6e] sm:text-lg">
                Tap all painful areas on the body map.
              </p>
            </div>

            <div className="mx-auto mt-6 w-full max-w-[700px]">
              <div className="relative min-h-[590px] rounded-[2rem] sm:min-h-[670px]">
                <div className="body-stage">
                  <Image
                    src={bodyImage}
                    alt="3D body pain map"
                    fill
                    className="object-contain scale-[1.08] sm:scale-[1.1]"
                    sizes="(max-width: 1024px) 86vw, 650px"
                  />
                  {hotspots.map((spot) => {
                    const active = selectedSet.has(spot.label);
                    const calloutLayout = calloutLayoutById[spot.id] ?? { position: "top", dx: 0, dy: 0 };
                    return (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => toggleLabel(spot.label)}
                        aria-label={spot.label}
                        className={`hotspot ${active ? "hotspot-active" : ""}`}
                        style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                      >
                        <span className="hotspot-core" />
                        {active ? (
                          <span
                            className={`hotspot-callout hotspot-callout-${calloutLayout.position}`}
                            style={{
                              ["--callout-offset-x" as string]: `${calloutLayout.dx}px`,
                              ["--callout-offset-y" as string]: `${calloutLayout.dy}px`,
                            }}
                          >
                            {spot.label}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            </div>
          ) : step === "side" ? (
            <div className="relative z-10 mt-6">
              <div className="mx-auto w-full max-w-[900px]">
                <h1 className="headline text-center text-3xl font-semibold text-[#0f2642] sm:text-4xl">Which side is most affected?</h1>
                <p className="mx-auto mt-2 max-w-[40ch] text-center text-base leading-7 text-[#2b4c6e] sm:text-lg">
                  Choose the option that best matches your symptoms.
                </p>

                <div className="mx-auto mt-6 grid max-w-[960px] grid-cols-2 gap-3 sm:gap-4">
                  {sideOptions.map((option) => {
                    const active = selectedSide === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedSide(option.id)}
                        className={`side-tile ${active ? "side-tile-active" : ""}`}
                        aria-pressed={active}
                      >
                        <span className="side-art" aria-hidden="true">
                          <Image
                            src={option.imageSrc}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 45vw, 260px"
                          />
                        </span>

                        <span className="side-info">
                          <span className="side-title">{option.label}</span>
                          <span className="side-helper">{option.helper}</span>
                        </span>

                        <span className={`side-icon-chip ${active ? "side-icon-chip-active" : ""}`} aria-hidden="true">
                          <SideOptionIcon kind={option.icon} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : step === "duration" ? (
            <div className="relative z-10 mt-6">
              <div className="mx-auto w-full max-w-[1080px]">
                <div>
                  <p className="text-base font-semibold text-[#1f7a36] sm:text-lg">Your story</p>
                  <h1 className="headline mt-1 text-3xl font-semibold text-[#0f2642] sm:text-4xl">How long have you had this problem?</h1>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-5">
                  {durationOptions.map((option) => {
                    const active = selectedDuration === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedDuration(option.id)}
                        className={`duration-card ${active ? "duration-card-active" : ""}`}
                        aria-pressed={active}
                      >
                        {option.badge ? <span className="duration-badge">{option.badge}</span> : null}

                        <span className="duration-check" aria-hidden="true">
                          {active ? "✓" : ""}
                        </span>

                        <span className="duration-art" aria-hidden="true">
                          <Image
                            src={option.imageSrc}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 46vw, 420px"
                          />
                        </span>

                        <span className="duration-title">{option.label}</span>
                        <span className="duration-helper">{option.helper}</span>
                        <span className="duration-underline" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : step === "onset" ? (
            <div className="relative z-10 mt-6">
              <div className="mx-auto w-full max-w-[980px] text-center">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">How did this problem start?</h1>
              </div>

              <div className="mx-auto mt-4 flex min-h-[62vh] w-full max-w-[960px] flex-col rounded-[1.4rem] border border-[#d8e7f4] bg-[linear-gradient(180deg,#fafdff,#eef6ff)] px-3 py-4 sm:px-4 sm:py-5">
                <div
                  className="onset-space"
                  onPointerDown={onOnsetPointerDown}
                  onPointerUp={onOnsetPointerUp}
                  onPointerCancel={() => {
                    onsetDragStartX.current = null;
                  }}
                >
                  {onsetOptions.map((option, index) => {
                    const distance = circularDistance(index, onsetFrontIndex, onsetOptions.length);
                    const absDistance = Math.abs(distance);

                    if (absDistance > 3) return null;

                    const isFront = distance === 0;
                    const active = selectedOnset === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          if (isFront) {
                            setSelectedOnset(option.id);
                            return;
                          }
                          setOnsetFrontIndex(index);
                        }}
                        className={`onset-card ${isFront ? "onset-card-front" : ""} ${active ? "onset-card-selected" : ""}`}
                        style={{
                          transform: `translate(calc(-50% + ${distance * 50}px), calc(-50% + ${absDistance * 8}px)) translateZ(${160 - absDistance * 56}px) rotateY(${distance * -8}deg) rotateZ(${distance * 1.5}deg) scale(${isFront ? 1 : 0.93})`,
                          zIndex: 90 - absDistance,
                          opacity: absDistance > 2 ? 0.64 : 1,
                        }}
                        aria-pressed={active}
                      >
                        <span className="onset-card-check" aria-hidden="true">{active ? "✓" : ""}</span>
                        <span className="onset-art" aria-hidden="true">
                          <Image
                            src={option.imageSrc}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 72vw, 250px"
                          />
                        </span>
                        <span className="onset-card-title">{option.label}</span>
                        <span className="onset-card-helper">{option.helper}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 text-center text-sm text-[#3d638a] sm:text-base">Swipe to browse. Tap the front card to confirm one option.</p>
              </div>
            </div>
          ) : step === "pain-score" ? (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1080px] flex-1 flex-col">
                <div>
                  <p className="text-base font-semibold text-[#1f7a36] sm:text-lg">Your plan</p>
                  <h1 className="headline mt-1 text-3xl font-semibold text-[#0f2642] sm:text-4xl">How strong is the pain right now?</h1>
                </div>

                <div className="pain-worse-stack-shell mt-5 flex-1">
                  <div
                    className="pain-worse-space"
                    role="radiogroup"
                    aria-label="Pain score from 0 to 10"
                    onPointerDown={onPainScorePointerDown}
                    onPointerMove={onPainScorePointerMove}
                    onPointerUp={onPainScorePointerUp}
                    onPointerCancel={() => {
                      painScoreDragStartX.current = null;
                      painScoreSwipeHandled.current = false;
                    }}
                  >
                    {painScoreOptions.map((score, index) => {
                      const distance = circularDistance(index, painScoreFront, painScoreOptions.length);
                      const absDistance = Math.abs(distance);
                      if (absDistance > 5) return null;

                      const isFront = distance === 0;
                      const active = selectedPainScore === score;

                      return (
                        <button
                          key={score}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={`Pain score ${score}: ${painScoreWords[score]}`}
                          className={`pain-worse-card pain-worse-card-info ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                          onClick={() => {
                            if (painScoreSwipeHandled.current) {
                              painScoreSwipeHandled.current = false;
                              return;
                            }

                            if (isFront) {
                              setSelectedPainScore(score);
                              return;
                            }

                            setPainScoreFront(score);
                          }}
                          style={getStackCardStyle(distance, Math.min(absDistance, 3), isFront)}
                        >
                          <span className={`swipe-option-title ${active ? "swipe-option-title-active" : ""}`}>{score}/10</span>
                          <span className="swipe-option-helper">{painScoreWords[score]}</span>
                          <span className="pain-score-face" aria-hidden="true">
                            <PainFaceIcon score={score} />
                            {isFront ? <PainOrbitTicks score={score} /> : null}
                          </span>
                          <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                            {active ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="pain-worse-hint">Swipe left or right, then tap the front card to choose your pain score.</p>
                  {selectedPainScore !== null ? (
                    <p className="pain-score-selected">Selected: <strong>{selectedPainScore}</strong></p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : step === "pattern" ? (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1080px] flex-1 flex-col">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">Which best describes your pain pattern?</h1>

                <div className="pattern-shell mt-5 flex-1">
                  <div className="pattern-list" role="radiogroup" aria-label="Pain pattern options">
                    {patternOptions.map((option) => {
                      const active = selectedPattern === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={option.label}
                          className={`pattern-row ${active ? "pattern-row-active" : ""}`}
                          onClick={() => setSelectedPattern(option.id)}
                        >
                          <span className="pattern-icon" aria-hidden="true">
                            <Image src={option.imageSrc} alt="" fill className="object-cover" sizes="84px" />
                          </span>
                          <span className="pattern-label">{option.label}</span>
                          <span className={`pattern-check ${active ? "pattern-check-active" : ""}`} aria-hidden="true">
                            {active ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : step === "change-overall" ? (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="change-overall-stage mx-auto flex h-full min-h-0 w-full max-w-[1120px] flex-1 flex-col">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">How is your condition changing overall?</h1>

                <div className="pain-worse-stack-shell mt-5 flex-1">
                  <div
                    className="pain-worse-space"
                    role="radiogroup"
                    aria-label="Condition change overall options"
                    onPointerDown={onChangeOverallPointerDown}
                    onPointerUp={onChangeOverallPointerUp}
                    onPointerCancel={() => {
                      changeOverallDragStartX.current = null;
                    }}
                  >
                    {changeOverallOptions.map((option) => {
                      const index = changeOverallOptions.findIndex((entry) => entry.id === option.id);
                      const distance = circularDistance(index, changeOverallFrontIndex, changeOverallOptions.length);
                      const absDistance = Math.abs(distance);
                      if (absDistance > 3) return null;

                      const isFront = distance === 0;
                      const active = selectedChangeOverall === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={option.label}
                          className={`pain-worse-card pain-worse-card-info ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                          onClick={() => {
                            if (isFront) {
                              setSelectedChangeOverall(option.id);
                              return;
                            }
                            setChangeOverallFrontIndex(index);
                          }}
                          style={getStackCardStyle(distance, absDistance, isFront)}
                        >
                          <span className={`swipe-option-title ${active ? "swipe-option-title-active" : ""}`}>{option.label}</span>
                          <span className="swipe-option-art swipe-option-art-portrait" aria-hidden="true">
                            <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 72vw, 240px" />
                          </span>
                          <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                            {active ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                </div>
              </div>
            </div>
          ) : step === "radiating" ? (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-1 flex-col">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">Do you have radiating pain into your arm or leg?</h1>

                <div className="pain-worse-stack-shell mt-5 flex-1">
                  <div
                    className="pain-worse-space"
                    role="radiogroup"
                    aria-label="Radiating pain frequency options"
                    onPointerDown={onRadiatingPointerDown}
                    onPointerUp={onRadiatingPointerUp}
                    onPointerCancel={() => {
                      radiatingDragStartX.current = null;
                    }}
                  >
                  {radiatingOptions.map((option) => {
                    const index = radiatingOptions.findIndex((entry) => entry.id === option.id);
                    const distance = circularDistance(index, radiatingFrontIndex, radiatingOptions.length);
                    const absDistance = Math.abs(distance);
                    if (absDistance > 3) return null;

                    const isFront = distance === 0;
                    const active = selectedRadiating === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={option.title}
                        className={`pain-worse-card pain-worse-card-info treatment-helped-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                        onClick={() => {
                          if (isFront) {
                            setSelectedRadiating(option.id);
                            return;
                          }
                          setRadiatingFrontIndex(index);
                        }}
                        style={getStackCardStyle(distance, absDistance, isFront)}
                      >
                        <span className={`swipe-option-title ${active ? "swipe-option-title-active" : ""}`}>{option.title}</span>
                        <span className="swipe-option-helper">{option.helper}</span>
                        <span className="swipe-option-art" aria-hidden="true">
                          <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 72vw, 240px" />
                        </span>
                        <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                          {active ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                  </div>
                  <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                </div>
              </div>
            </div>
          ) : step === "numbness" ? (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1500px] flex-1 flex-col">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">Numbness or tingling in arm, hand, leg, or foot?</h1>

                <div className="pain-worse-stack-shell mt-5 flex-1">
                  <div
                    className="pain-worse-space"
                    role="radiogroup"
                    aria-label="Numbness or tingling frequency options"
                    onPointerDown={onNumbnessPointerDown}
                    onPointerUp={onNumbnessPointerUp}
                    onPointerCancel={() => {
                      numbnessDragStartX.current = null;
                    }}
                  >
                  {numbnessOptions.map((option) => {
                    const index = numbnessOptions.findIndex((entry) => entry.id === option.id);
                    const distance = circularDistance(index, numbnessFrontIndex, numbnessOptions.length);
                    const absDistance = Math.abs(distance);
                    if (absDistance > 3) return null;

                    const isFront = distance === 0;
                    const active = selectedNumbness === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={option.title}
                        className={`pain-worse-card pain-worse-card-info ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                        onClick={() => {
                          if (isFront) {
                            setSelectedNumbness(option.id);
                            return;
                          }
                          setNumbnessFrontIndex(index);
                        }}
                        style={getStackCardStyle(distance, absDistance, isFront)}
                      >
                        <span className={`swipe-option-title ${active ? "swipe-option-title-active" : ""}`}>{option.title}</span>
                        <span className="swipe-option-helper">{option.helper}</span>
                        <span className="swipe-option-art" aria-hidden="true">
                          <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 72vw, 240px" />
                        </span>
                        <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                          {active ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })}
                  </div>
                  <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                </div>
              </div>
            </div>
          ) : step === "pain-worse-with" ? (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-1 flex-col">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">Pain worsens with (select all that apply)</h1>

                <div className="pain-worse-stack-shell mt-5 flex-1">
                  <div
                    className="pain-worse-space"
                    role="group"
                    aria-label="Pain worsens with options"
                    onPointerDown={onPainWorsePointerDown}
                    onPointerUp={onPainWorsePointerUp}
                    onPointerCancel={() => {
                      painWorseDragStartX.current = null;
                    }}
                  >
                    {painWorseOptions.map((option) => {
                      const index = painWorseOptions.findIndex((entry) => entry.id === option.id);
                      const distance = circularDistance(index, painWorseFrontIndex, painWorseOptions.length);
                      const absDistance = Math.abs(distance);
                      if (absDistance > 3) return null;

                      const isFront = distance === 0;
                      const active = selectedPainWorse.includes(option.id);

                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={active}
                          className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                          onClick={() => {
                            if (isFront) {
                              togglePainWorseOption(option.id);
                              return;
                            }
                            setPainWorseFrontIndex(index);
                          }}
                          style={getStackCardStyle(distance, absDistance, isFront)}
                        >
                          <span className="pain-worse-art" aria-hidden="true">
                            <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                          </span>
                          <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                            {active ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="pain-worse-hint">Swipe left or right, then tap the front card to select all that apply.</p>
                </div>
              </div>
            </div>
          ) : step === "pain-improves-with" ? (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-1 flex-col">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">Pain improves with (select all that apply)</h1>

                <div className="pain-worse-stack-shell mt-5 flex-1">
                  <div
                    className="pain-worse-space"
                    role="group"
                    aria-label="Pain improves with options"
                    onPointerDown={onPainImprovesPointerDown}
                    onPointerUp={onPainImprovesPointerUp}
                    onPointerCancel={() => {
                      painImprovesDragStartX.current = null;
                    }}
                  >
                    {painImprovesOptions.map((option) => {
                      const index = painImprovesOptions.findIndex((entry) => entry.id === option.id);
                      const distance = circularDistance(index, painImprovesFrontIndex, painImprovesOptions.length);
                      const absDistance = Math.abs(distance);
                      if (absDistance > 3) return null;

                      const isFront = distance === 0;
                      const active = selectedPainImproves.includes(option.id);

                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={active}
                          className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                          onClick={() => {
                            if (isFront) {
                              togglePainImprovesOption(option.id);
                              return;
                            }
                            setPainImprovesFrontIndex(index);
                          }}
                          style={getStackCardStyle(distance, absDistance, isFront)}
                        >
                          <span className="pain-worse-art" aria-hidden="true">
                            <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                          </span>
                          <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                            {active ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="pain-worse-hint">Swipe left or right, then tap the front card to select all that apply.</p>
                </div>
              </div>
            </div>
          ) : step === "treatment-helped" ? (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-1 flex-col">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">Has treatment helped?</h1>

                <div className="pain-worse-stack-shell mt-5 flex-1">
                  <div
                    className="pain-worse-space"
                    role="radiogroup"
                    aria-label="Has treatment helped options"
                    onPointerDown={onTreatmentHelpedPointerDown}
                    onPointerUp={onTreatmentHelpedPointerUp}
                    onPointerCancel={() => {
                      treatmentHelpedDragStartX.current = null;
                    }}
                  >
                  {treatmentHelpedOptions.map((option) => {
                    const index = treatmentHelpedOptions.findIndex((entry) => entry.id === option.id);
                    const distance = circularDistance(index, treatmentHelpedFrontIndex, treatmentHelpedOptions.length);
                    const absDistance = Math.abs(distance);
                    if (absDistance > 3) return null;

                    const isFront = distance === 0;
                    const active = selectedTreatmentHelped === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-pressed={active}
                        className={`pain-worse-card pain-worse-card-info ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                        onClick={() => {
                          if (isFront) {
                            setSelectedTreatmentHelped(option.id);
                            return;
                          }
                          setTreatmentHelpedFrontIndex(index);
                        }}
                        style={getStackCardStyle(distance, absDistance, isFront)}
                      >
                        <span className="swipe-option-art swipe-option-art-portrait" aria-hidden="true">
                          <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 300px" />
                        </span>
                        <span className={`swipe-option-title ${active ? "swipe-option-title-active" : ""}`}>{option.label}</span>
                        <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                          {active ? "✓" : ""}
                        </span>
                        <span className="sr-only">{option.label}</span>
                      </button>
                    );
                  })}
                  </div>
                  <p className="pain-worse-hint">Swipe left or right, then tap the front card to choose one option.</p>
                </div>
              </div>
            </div>
          ) : step === "treatments-tried" ? (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[1180px] flex-1 flex-col">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">Treatments tried so far (select all that apply)</h1>

                <div className="pain-worse-stack-shell mt-5 flex-1">
                  <div
                    className="pain-worse-space"
                    role="group"
                    aria-label="Treatments tried so far options"
                    onPointerDown={onTreatmentsPointerDown}
                    onPointerUp={onTreatmentsPointerUp}
                    onPointerCancel={() => {
                      treatmentsDragStartX.current = null;
                    }}
                  >
                    {treatmentTriedOptions.map((option) => {
                      const index = treatmentTriedOptions.findIndex((entry) => entry.id === option.id);
                      const distance = circularDistance(index, treatmentsFrontIndex, treatmentTriedOptions.length);
                      const absDistance = Math.abs(distance);
                      if (absDistance > 3) return null;

                      const isFront = distance === 0;
                      const active = selectedTreatmentsTried.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={active}
                          className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                          onClick={() => {
                            if (isFront) {
                              toggleTreatmentTriedOption(option.id);
                              return;
                            }
                            setTreatmentsFrontIndex(index);
                          }}
                          style={getStackCardStyle(distance, absDistance, isFront)}
                        >
                          <span className="pain-worse-art" aria-hidden="true">
                            <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                          </span>
                          <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                            {active ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="pain-worse-hint">Swipe left or right, then tap the front card to select all that apply.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative z-10 mt-6 flex h-full min-h-0 flex-1 flex-col">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[940px] flex-1 flex-col">
                <h1 className="headline text-3xl font-semibold text-[#0f2642] sm:text-4xl">
                  {legacyQuestion?.label ?? "Follow-up"}
                </h1>
                {legacyQuestion?.helpText ? (
                  <p className="mt-2 text-base leading-7 text-[#2b4c6e] sm:text-lg">{legacyQuestion.helpText}</p>
                ) : null}

                {legacyQuestion?.id === "ndiPainIntensity" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI pain intensity options"
                      onPointerDown={onNdiPainPointerDown}
                      onPointerUp={onNdiPainPointerUp}
                      onPointerCancel={() => {
                        ndiPainDragStartX.current = null;
                      }}
                    >
                      {ndiPainIntensityCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiPainFrontIndex, ndiPainIntensityCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiPainFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "ndiPersonalCare" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI personal care options"
                      onPointerDown={onNdiPersonalCarePointerDown}
                      onPointerUp={onNdiPersonalCarePointerUp}
                      onPointerCancel={() => {
                        ndiPersonalCareDragStartX.current = null;
                      }}
                    >
                      {ndiPersonalCareCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiPersonalCareFrontIndex, ndiPersonalCareCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiPersonalCareFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "ndiLifting" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI lifting options"
                      onPointerDown={onNdiLiftingPointerDown}
                      onPointerUp={onNdiLiftingPointerUp}
                      onPointerCancel={() => {
                        ndiLiftingDragStartX.current = null;
                      }}
                    >
                      {ndiLiftingCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiLiftingFrontIndex, ndiLiftingCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiLiftingFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "ndiReading" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI reading options"
                      onPointerDown={onNdiReadingPointerDown}
                      onPointerUp={onNdiReadingPointerUp}
                      onPointerCancel={() => {
                        ndiReadingDragStartX.current = null;
                      }}
                    >
                      {ndiReadingCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiReadingFrontIndex, ndiReadingCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiReadingFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "ndiHeadaches" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI headaches options"
                      onPointerDown={onNdiHeadachesPointerDown}
                      onPointerUp={onNdiHeadachesPointerUp}
                      onPointerCancel={() => {
                        ndiHeadachesDragStartX.current = null;
                      }}
                    >
                      {ndiHeadachesCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiHeadachesFrontIndex, ndiHeadachesCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiHeadachesFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "ndiConcentration" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI concentration options"
                      onPointerDown={onNdiConcentrationPointerDown}
                      onPointerUp={onNdiConcentrationPointerUp}
                      onPointerCancel={() => {
                        ndiConcentrationDragStartX.current = null;
                      }}
                    >
                      {ndiConcentrationCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiConcentrationFrontIndex, ndiConcentrationCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiConcentrationFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "ndiWork" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI work options"
                      onPointerDown={onNdiWorkPointerDown}
                      onPointerUp={onNdiWorkPointerUp}
                      onPointerCancel={() => {
                        ndiWorkDragStartX.current = null;
                      }}
                    >
                      {ndiWorkCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiWorkFrontIndex, ndiWorkCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiWorkFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "ndiDriving" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI driving options"
                      onPointerDown={onNdiDrivingPointerDown}
                      onPointerUp={onNdiDrivingPointerUp}
                      onPointerCancel={() => {
                        ndiDrivingDragStartX.current = null;
                      }}
                    >
                      {ndiDrivingCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiDrivingFrontIndex, ndiDrivingCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiDrivingFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "ndiSleeping" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI sleeping options"
                      onPointerDown={onNdiSleepingPointerDown}
                      onPointerUp={onNdiSleepingPointerUp}
                      onPointerCancel={() => {
                        ndiSleepingDragStartX.current = null;
                      }}
                    >
                      {ndiSleepingCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiSleepingFrontIndex, ndiSleepingCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiSleepingFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "ndiRecreation" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="NDI recreation options"
                      onPointerDown={onNdiRecreationPointerDown}
                      onPointerUp={onNdiRecreationPointerUp}
                      onPointerCancel={() => {
                        ndiRecreationDragStartX.current = null;
                      }}
                    >
                      {ndiRecreationCardOptions.map((option, index) => {
                        const distance = circularDistance(index, ndiRecreationFrontIndex, ndiRecreationCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = legacyAnswers[legacyQuestion.id] === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setNdiRecreationFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.id === "spineHealthAnchor" ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label="Overall spine health options"
                      onPointerDown={onSpineHealthPointerDown}
                      onPointerUp={onSpineHealthPointerUp}
                      onPointerCancel={() => {
                        spineHealthDragStartX.current = null;
                      }}
                    >
                      {spineHealthCardOptions.map((option, index) => {
                        const distance = circularDistance(index, spineHealthFrontIndex, spineHealthCardOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = Number(legacyAnswers[legacyQuestion.id]) === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }
                              setSpineHealthFrontIndex(index);
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : activeLegacyDeckOptions ? (
                  <div className="pain-worse-stack-shell mt-5 flex-1">
                    <div
                      className="pain-worse-space"
                      role="radiogroup"
                      aria-label={`${legacyQuestion?.label ?? "Legacy"} options`}
                      onPointerDown={onLegacyDeckPointerDown}
                      onPointerUp={onLegacyDeckPointerUp}
                      onPointerCancel={() => {
                        legacyDeckDragStartX.current = null;
                      }}
                    >
                      {activeLegacyDeckOptions.map((option, index) => {
                        const distance = circularDistance(index, activeLegacyDeckFrontIndex, activeLegacyDeckOptions.length);
                        const absDistance = Math.abs(distance);
                        if (absDistance > 3) return null;

                        const isFront = distance === 0;
                        const active = String(legacyAnswers[legacyQuestion?.id ?? ""] ?? "") === option.value;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={option.label}
                            className={`pain-worse-card ${isFront ? "pain-worse-card-front" : ""} ${active ? "pain-worse-card-active" : ""}`}
                            onClick={() => {
                              if (!legacyQuestion) return;
                              if (isFront) {
                                setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                                return;
                              }

                              setLegacyDeckFrontIndexByQuestion((current) => ({
                                ...current,
                                [legacyQuestion.id]: index,
                              }));
                            }}
                            style={getStackCardStyle(distance, absDistance, isFront)}
                          >
                            <span className="pain-worse-art" aria-hidden="true">
                              <Image src={option.imageSrc} alt="" fill className="object-contain" sizes="(max-width: 640px) 74vw, 360px" />
                            </span>
                            <span className={`pain-worse-check-chip ${active ? "pain-worse-check-chip-active" : ""}`} aria-hidden="true">
                              {active ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="pain-worse-hint">Swipe left or right, then tap the front card to select one option.</p>
                  </div>
                ) : legacyQuestion?.type === "range" ? (
                  <div className="mt-5 rounded-2xl border border-[#d5e3f3] bg-white px-4 py-4 shadow-sm">
                    <div className="mb-2 text-sm font-semibold text-[#1f456e]">
                      Selected: {typeof legacyAnswers[legacyQuestion.id] === "number" ? Number(legacyAnswers[legacyQuestion.id]) : legacyQuestion.min ?? 0}
                    </div>
                    <input
                      className="w-full accent-[#2f7ce7]"
                      type="range"
                      min={legacyQuestion.min ?? 0}
                      max={legacyQuestion.max ?? 10}
                      step={legacyQuestion.step ?? 1}
                      value={typeof legacyAnswers[legacyQuestion.id] === "number" ? Number(legacyAnswers[legacyQuestion.id]) : legacyQuestion.min ?? 0}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: nextValue }));
                      }}
                    />
                  </div>
                ) : (
                  <div className="mt-5 grid gap-3">
                    {(legacyQuestion?.options ?? []).map((option) => {
                      const active = legacyAnswers[legacyQuestion?.id ?? ""] === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            if (!legacyQuestion) return;
                            setLegacyAnswers((current) => ({ ...current, [legacyQuestion.id]: option.value }));
                          }}
                          className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                            active
                              ? "border-[#205fb3] bg-[#eaf3ff] text-[#134886]"
                              : "border-[#d2dbe6] bg-white text-[#1f456e] hover:border-[#a8bfdc]"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#d7e6f5] bg-white/95 px-3 py-3 backdrop-blur sm:px-5 sm:py-3.5 lg:px-8 lg:py-4">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-3">
          <button type="button" onClick={handleBack} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#8ec89c] bg-white px-6 py-2 text-lg font-semibold text-[#2e7a4f] shadow-sm sm:text-xl">
            ← Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-6 py-2 text-lg font-semibold shadow-sm sm:text-xl ${
              useClassicUi
                ? nextEnabled
                  ? "border border-[#205fb3] bg-white text-[#205fb3]"
                  : "border border-[#d2d7de] bg-white text-[#9aa7b5]"
                : nextEnabled
                  ? "bg-[linear-gradient(90deg,#9be54d,#74cf57)] text-white"
                  : "bg-[#d2d7de] text-white"
            }`}
            disabled={nextDisabled}
          >
            {isFinalStep
              ? (isSubmittingFinal ? "Finishing..." : finalSubmitted ? "Submitted ✓" : "Finish ✓")
              : "Next →"}
          </button>
        </div>
        {finalSubmitError ? <p className="mt-2 text-center text-sm font-medium text-[#b42318]">{finalSubmitError}</p> : null}
      </div>

      {isSubmittingFinal ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-[rgba(21,32,43,0.48)] p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-5 text-center shadow-[0_24px_70px_rgba(21,32,43,0.28)] sm:p-6">
            <div className="mx-auto relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-4 border-[#c8def7]" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#165fc0] border-r-[#165fc0]" />
            </div>
            <h3 className="headline mt-4 text-xl font-semibold text-[#173e67]">Generating your score card</h3>
            <p className="mt-2 text-sm leading-6 text-[#4f6c88]">
              Please wait while we submit your answers and prepare the final score card.
            </p>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .pain-screen {
          background:
            radial-gradient(circle at 8% 90%, rgba(154, 214, 173, 0.2), transparent 28%),
            radial-gradient(circle at 84% 10%, rgba(142, 186, 235, 0.2), transparent 28%),
            linear-gradient(180deg, #f8fcff 0%, #eef6ff 100%);
        }

        .body-stage {
          position: relative;
          height: 610px;
          width: min(100%, 660px);
          margin: 0 auto;
          filter: drop-shadow(0 22px 45px rgba(34, 95, 122, 0.18));
        }

        .body-stage::before {
          content: "";
          position: absolute;
          left: -2px;
          top: 0;
          bottom: 0;
          width: 28px;
          background: linear-gradient(90deg, rgba(248, 252, 255, 0.98), rgba(248, 252, 255, 0));
          pointer-events: none;
          z-index: 1;
        }

        .hotspot {
          position: absolute;
          translate: -50% -50%;
          width: 46px;
          height: 46px;
          border-radius: 999px;
          border: 1px solid rgba(181, 255, 88, 0.92);
          background: rgba(212, 255, 171, 0.16);
          display: grid;
          place-items: center;
          box-shadow: 0 0 0 4px rgba(181, 255, 88, 0.08);
          transition: transform 220ms ease, box-shadow 220ms ease;
        }

        .hotspot:hover {
          transform: scale(1.07);
          box-shadow: 0 0 0 8px rgba(181, 255, 88, 0.12);
        }

        .hotspot-core {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: radial-gradient(circle, #f6ff9b 0%, #b8ff4f 58%, #8bd740 100%);
          box-shadow: 0 0 16px rgba(181, 255, 88, 0.95);
        }

        .hotspot-active {
          border-color: #ef3f3f;
          box-shadow: 0 0 0 7px rgba(239, 63, 63, 0.2), 0 0 24px rgba(239, 63, 63, 0.45);
        }

        .hotspot-active .hotspot-core {
          background: radial-gradient(circle, #ffd5d5 0%, #ff6b6b 56%, #e33333 100%);
          box-shadow: 0 0 16px rgba(239, 63, 63, 0.9);
        }

        .hotspot-callout {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 10px);
          transform: translate(calc(-50% + var(--callout-offset-x, 0px)), var(--callout-offset-y, 0px));
          white-space: nowrap;
          border-radius: 999px;
          border: 1px solid #ffd4d4;
          background: #ffffff;
          color: #a93131;
          font-size: 0.82rem;
          line-height: 1;
          font-weight: 700;
          padding: 0.42rem 0.62rem;
          box-shadow: 0 12px 24px rgba(169, 49, 49, 0.2);
          z-index: 2;
        }

        .hotspot-callout::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 100%;
          transform: translateX(-50%);
          border-width: 7px 6px 0 6px;
          border-style: solid;
          border-color: #ffffff transparent transparent transparent;
          filter: drop-shadow(0 1px 0 #ffd4d4);
        }

        .hotspot-callout-left {
          left: auto;
          right: 100%;
          bottom: 50%;
          transform: translate(calc(-8px + var(--callout-offset-x, 0px)), calc(50% + var(--callout-offset-y, 0px)));
        }

        .hotspot-callout-left::after {
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-width: 6px 0 6px 7px;
          border-color: transparent transparent transparent #ffffff;
        }

        .hotspot-callout-right {
          left: 100%;
          bottom: 50%;
          transform: translate(calc(8px + var(--callout-offset-x, 0px)), calc(50% + var(--callout-offset-y, 0px)));
        }

        .hotspot-callout-right::after {
          left: 0;
          top: 50%;
          transform: translate(-100%, -50%);
          border-width: 6px 7px 6px 0;
          border-color: transparent #ffffff transparent transparent;
        }

        .hotspot-callout-top {
          left: 50%;
          bottom: calc(100% + 10px);
          transform: translate(calc(-50% + var(--callout-offset-x, 0px)), var(--callout-offset-y, 0px));
        }

        .hotspot-callout-top::after {
          left: 50%;
          top: 100%;
          transform: translateX(-50%);
          border-width: 7px 6px 0 6px;
          border-color: #ffffff transparent transparent transparent;
        }

        .hotspot-callout-bottom {
          left: 50%;
          top: calc(100% + 10px);
          bottom: auto;
          transform: translate(calc(-50% + var(--callout-offset-x, 0px)), var(--callout-offset-y, 0px));
        }

        .hotspot-callout-bottom::after {
          left: 50%;
          top: auto;
          bottom: 100%;
          transform: translateX(-50%);
          border-width: 0 6px 7px 6px;
          border-color: transparent transparent #ffffff transparent;
        }

        .risk-card {
          position: relative;
          overflow: hidden;
          min-height: 206px;
          border-radius: 1.2rem;
          border: 1.5px solid #d5e3f0;
          background: linear-gradient(180deg, #ffffff 0%, #f8fcff 100%);
          display: grid;
          align-content: start;
          gap: 0.65rem;
          padding: 0.65rem 0.65rem 0.85rem;
          text-align: left;
          box-shadow: 0 10px 24px rgba(31, 84, 131, 0.08);
          transition: border-color 170ms ease, box-shadow 170ms ease, transform 170ms ease;
        }

        .risk-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(31, 84, 131, 0.12);
        }

        .risk-card-active {
          border: 2.5px solid #2a68c9;
          box-shadow: 0 12px 30px rgba(42, 104, 201, 0.2);
        }

        .risk-image-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 0.9rem;
          overflow: hidden;
          background: #eef6ff;
        }

        .risk-label {
          color: #17395f;
          font-size: 1.02rem;
          line-height: 1.35;
          font-weight: 600;
          min-height: 2.7em;
          padding: 0 0.15rem;
        }

        .risk-dot {
          width: 36px;
          height: 5px;
          border-radius: 999px;
          background: #cad6e2;
          justify-self: center;
        }

        .risk-dot-active {
          background: #5bbf67;
        }

        .risk-none-card {
          margin: 1rem auto 0;
          width: 100%;
          max-width: 980px;
          border-radius: 1.35rem;
          border: 1.5px solid #d5e3f0;
          background: linear-gradient(180deg, #ffffff 0%, #f8fcff 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
          padding: 0.7rem 0.85rem;
          box-shadow: 0 10px 24px rgba(31, 84, 131, 0.08);
          transition: border-color 170ms ease, box-shadow 170ms ease;
        }

        .risk-none-card-active {
          border: 2.5px solid #2a68c9;
          box-shadow: 0 12px 30px rgba(42, 104, 201, 0.2);
        }

        .risk-none-image-wrap {
          position: relative;
          width: 78px;
          height: 78px;
          border-radius: 0.95rem;
          overflow: hidden;
          border: 1px solid #d5e3f0;
          background: #eef6ff;
          flex: 0 0 auto;
        }

        .risk-none-label {
          font-size: 1.1rem;
          line-height: 1.25;
          font-weight: 600;
          color: #17395f;
        }

        .risk-none-check {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border-radius: 999px;
          border: 1.5px solid #bfd1e2;
          color: transparent;
          background: #ffffff;
          font-size: 1.25rem;
          font-weight: 700;
          flex: 0 0 auto;
        }

        .risk-none-check-active {
          border-color: #2a68c9;
          color: #2a68c9;
          background: #f2f8ff;
        }

        .reason-space {
          position: relative;
          flex: 1;
          min-height: 286px;
          perspective: 1200px;
          perspective-origin: center center;
          overflow: hidden;
          border-radius: 1.25rem;
          transform-style: preserve-3d;
          touch-action: pan-y;
          overscroll-behavior: contain;
        }

        .reason-card {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(60vw, 214px);
          max-width: 214px;
          aspect-ratio: 3 / 4;
          border-radius: 1.45rem;
          border: 1px solid #c7dcf0;
          background: linear-gradient(180deg, #ffffff 0%, #f6fbff 100%);
          box-shadow: 0 16px 42px rgba(27, 73, 122, 0.2);
          padding: 0.76rem 0.7rem 0.78rem;
          text-align: center;
          transform-style: preserve-3d;
          transition: transform 360ms cubic-bezier(0.22, 0.74, 0.22, 1), opacity 260ms ease, border-color 260ms ease;
        }

        .reason-card-front {
          border-color: #8ab8e8;
        }

        .reason-card-selected {
          border-color: #5ba7ff;
          box-shadow: 0 0 0 2px rgba(91, 167, 255, 0.35), 0 20px 46px rgba(24, 78, 135, 0.26);
        }

        .reason-card-check {
          position: absolute;
          right: 0.62rem;
          top: 0.62rem;
          display: grid;
          place-items: center;
          width: 1.95rem;
          height: 1.95rem;
          border-radius: 999px;
          border: 1px solid #bfd7ec;
          color: #2667a3;
          font-size: 1rem;
          background: #ffffff;
        }

        .reason-icon-orb {
          margin: 0.82rem auto 0.5rem;
          display: grid;
          place-items: center;
          width: 78px;
          height: 78px;
          border-radius: 999px;
          background: radial-gradient(circle at 34% 30%, #e2f2ff 0%, #b8dcff 60%, #8ac1f6 100%);
          color: #1e5f9a;
          box-shadow: inset 0 0 0 1px rgba(73, 133, 192, 0.22), 0 12px 24px rgba(30, 95, 154, 0.22);
        }

        .reason-icon-orb :global(svg) {
          width: 2rem;
          height: 2rem;
        }

        .reason-card-title {
          display: block;
          margin-top: 0.28rem;
          color: #123d66;
          font-size: 1.02rem;
          font-weight: 700;
          line-height: 1.24;
        }

        .reason-card-helper {
          display: block;
          margin-top: 0.28rem;
          color: #52789d;
          font-size: 0.78rem;
          line-height: 1.34;
          font-weight: 500;
        }

        .onset-space {
          position: relative;
          flex: 1;
          min-height: 292px;
          perspective: 1260px;
          perspective-origin: center center;
          overflow: hidden;
          border-radius: 1.2rem;
          transform-style: preserve-3d;
          touch-action: pan-y;
          overscroll-behavior: contain;
        }

        .onset-card {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(56vw, 212px);
          max-width: 212px;
          aspect-ratio: 3 / 4;
          border-radius: 1.4rem;
          border: 1px solid #c7dcf0;
          background: linear-gradient(180deg, #ffffff 0%, #f6fbff 100%);
          box-shadow: 0 16px 42px rgba(27, 73, 122, 0.2);
          padding: 0.68rem 0.62rem 0.72rem;
          text-align: center;
          transform-style: preserve-3d;
          transition: transform 360ms cubic-bezier(0.22, 0.74, 0.22, 1), opacity 260ms ease, border-color 260ms ease;
        }

        .onset-card-front {
          border-color: #8ab8e8;
        }

        .onset-card-selected {
          border-color: #45b35f;
          box-shadow: 0 0 0 2px rgba(95, 205, 119, 0.3), 0 20px 44px rgba(24, 117, 63, 0.2);
        }

        .onset-card-check {
          position: absolute;
          right: 0.62rem;
          top: 0.62rem;
          display: grid;
          place-items: center;
          width: 1.95rem;
          height: 1.95rem;
          border-radius: 999px;
          border: 1px solid #bfd7ec;
          color: #2a7f45;
          font-size: 1rem;
          background: #ffffff;
        }

        .onset-art {
          position: relative;
          display: block;
          width: min(100%, 188px);
          aspect-ratio: 16 / 13;
          margin: 0.25rem auto 0.52rem;
          border-radius: 1.05rem;
          overflow: hidden;
        }

        .onset-card-title {
          display: block;
          margin-top: 0.26rem;
          color: #123d66;
          font-size: 0.98rem;
          font-weight: 700;
          line-height: 1.24;
        }

        .onset-card-helper {
          display: block;
          margin-top: 0.26rem;
          color: #52789d;
          font-size: 0.74rem;
          line-height: 1.34;
          font-weight: 500;
        }

        .pain-score-shell {
          border-radius: 1.5rem;
          border: 1px solid #d8e7f4;
          background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
          box-shadow: 0 14px 32px rgba(26, 84, 136, 0.08);
          padding: 1rem 0.9rem 0.9rem;
          min-height: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .pain-score-track {
          position: relative;
          flex: 1;
          min-height: clamp(210px, 32vh, 280px);
          overflow: hidden;
          padding: 0.25rem 0.2rem 0.6rem;
          touch-action: pan-y;
          user-select: none;
          overscroll-behavior: contain;
        }

        .pain-score-card {
          position: absolute;
          left: 50%;
          top: 20px;
          margin-left: -34px;
          width: 68px;
          min-height: 170px;
          border-radius: 1rem;
          border: 1.5px solid #d8e3ee;
          background: #ffffff;
          display: grid;
          justify-items: center;
          align-content: start;
          gap: 0.25rem;
          padding: 0.72rem 0.35rem 0.62rem;
          box-shadow: 0 10px 24px rgba(31, 84, 131, 0.07);
          transition: transform 220ms ease, border-color 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
          color: var(--pain-tone);
        }

        .pain-score-card:hover {
          transform: translateY(-1px);
          border-color: #a9c6e5;
        }

        .pain-score-card-active {
          margin-left: -86px;
          width: 172px;
          min-height: 266px;
          border: 2.5px solid color-mix(in srgb, var(--pain-tone) 52%, #ffffff 48%);
          box-shadow: 0 30px 46px rgba(35, 102, 62, 0.24);
        }

        .pain-score-number {
          font-size: 2.05rem;
          line-height: 1;
          font-weight: 700;
          color: #203146;
        }

        .pain-score-card-active .pain-score-number {
          font-size: 4.5rem;
          margin-top: 0.25rem;
          color: color-mix(in srgb, var(--pain-tone) 78%, #123640 22%);
        }

        .pain-score-word {
          margin-top: 0.24rem;
          font-size: 0.6rem;
          line-height: 1.15;
          text-align: center;
          color: #426482;
          font-weight: 600;
          max-width: 54px;
        }

        .pain-score-word-active {
          display: none;
        }

        .pain-score-state {
          margin-top: 0.2rem;
          font-size: 1.55rem;
          line-height: 1.1;
          font-weight: 600;
          text-align: center;
          color: color-mix(in srgb, var(--pain-tone) 80%, #1d3e52 20%);
        }

        .pain-score-face {
          margin-top: 0.4rem;
          display: grid;
          place-items: center;
          width: 100%;
          position: relative;
        }

        .pain-score-card-active .pain-score-face {
          margin-top: 0.55rem;
        }

        .pain-score-face :global(svg) {
          width: 2rem;
          height: 2rem;
        }

        .pain-score-card-active .pain-score-face :global(svg) {
          width: 3.35rem;
          height: 3.35rem;
        }

        .pain-score-orbit {
          position: absolute;
          left: 50%;
          top: 50%;
          --orbit-radius: 42px;
          width: 88px;
          height: 88px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          pointer-events: none;
        }

        .pain-score-orbit-tick {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #e4e8ee;
        }

        .pain-score-axis {
          margin: 0.42rem auto 0;
          width: min(100%, 940px);
          border-radius: 999px;
          border: 1px solid #e0e9f4;
          background: #ffffff;
          padding: 0.56rem 0.8rem;
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          font-size: 0.95rem;
          color: #2f4663;
          font-weight: 600;
        }

        .pain-score-selected {
          margin-top: 0.62rem;
          text-align: center;
          color: #2d4d72;
          font-size: 0.92rem;
        }

        .pattern-shell {
          border-radius: 1.5rem;
          border: 1px solid #d8e7f4;
          background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
          box-shadow: 0 14px 32px rgba(26, 84, 136, 0.08);
          padding: 0.95rem 0.85rem;
          min-height: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .pattern-list {
          display: grid;
          gap: 0.8rem;
          align-content: start;
          flex: 1;
        }

        .pattern-row {
          min-height: 76px;
          border-radius: 1.5rem;
          border: 1.5px solid #cfd9e5;
          background: #ffffff;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 0.9rem;
          padding: 0.8rem 0.95rem;
          text-align: left;
          transition: border-color 170ms ease, box-shadow 170ms ease, transform 170ms ease;
        }

        .pattern-row:hover {
          border-color: #aac0d8;
          transform: translateY(-1px);
        }

        .pattern-row-active {
          border-color: #5aa06d;
          box-shadow: 0 14px 30px rgba(34, 108, 62, 0.14);
          background: linear-gradient(180deg, #ffffff 0%, #f4fbf6 100%);
        }

        .pattern-icon {
          position: relative;
          overflow: hidden;
          width: 42px;
          height: 42px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: #e9f4ed;
          color: #2f7a4e;
        }

        .pattern-label {
          color: #17395f;
          font-size: 1.08rem;
          line-height: 1.3;
          font-weight: 600;
        }

        .pattern-check {
          width: 50px;
          height: 50px;
          border-radius: 999px;
          border: 2px solid #c5d2df;
          display: grid;
          place-items: center;
          color: transparent;
          background: #ffffff;
          font-size: 1.15rem;
          font-weight: 700;
          transition: border-color 170ms ease, color 170ms ease, background-color 170ms ease;
        }

        .pattern-check-active {
          border-color: #2f8a52;
          color: #ffffff;
          background: #2f8a52;
        }

        .change-overall-shell {
          border-radius: 1.5rem;
          border: 1px solid #d8e7f4;
          background: linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
          box-shadow: 0 14px 32px rgba(26, 84, 136, 0.08);
          padding: 1rem 0.9rem;
          min-height: 0;
          height: 100%;
        }

        .change-overall-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.88rem;
          align-items: start;
        }

        .change-overall-tile {
          border-radius: 1.45rem;
          border: 1.5px solid #d5deea;
          background: rgba(255, 255, 255, 0.48);
          backdrop-filter: blur(1px);
          padding: 0.64rem 0.58rem 0.62rem;
          display: grid;
          justify-items: center;
          gap: 0.44rem;
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease, background-color 180ms ease;
        }

        .change-overall-tile:hover {
          transform: translateY(-1px);
          border-color: #abc2db;
        }

        .change-overall-tile-active {
          border-color: #6ea6d7;
          box-shadow: 0 14px 30px rgba(32, 84, 136, 0.14);
          background: rgba(248, 252, 255, 0.9);
        }

        .change-overall-art {
          position: relative;
          width: min(100%, 210px);
          aspect-ratio: 3 / 4;
          max-height: min(31vh, 258px);
          border-radius: 1.12rem;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.06);
        }

        .change-overall-label {
          color: #17395f;
          text-align: center;
          font-size: clamp(0.88rem, 1.2vw, 1rem);
          line-height: 1.26;
          font-weight: 700;
          min-height: 2.52em;
          max-width: 14ch;
          text-wrap: balance;
        }

        .change-overall-stage {
          min-height: clamp(360px, 54vh, 520px);
        }

        .radiating-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
        }

        .radiating-card {
          border-radius: 1.45rem;
          border: 1.5px solid #d7e3f0;
          background: #ffffff;
          box-shadow: 0 16px 40px rgba(28, 80, 129, 0.1);
          display: grid;
          justify-items: center;
          align-content: start;
          gap: 0.4rem;
          padding: 1rem 0.9rem 0.86rem;
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }

        .radiating-card:hover {
          transform: translateY(-1px);
          border-color: #a8c4e4;
        }

        .radiating-card-active {
          border-color: #3d84ec;
          box-shadow: 0 18px 44px rgba(48, 125, 224, 0.2);
        }

        .radiating-title {
          color: #1a3558;
          text-align: center;
          font-size: clamp(1.02rem, 1.2vw, 1.2rem);
          line-height: 1.2;
          font-weight: 700;
          min-height: 1.3em;
        }

        .radiating-title-active {
          color: #2f7ce7;
        }

        .radiating-helper {
          color: #5b7391;
          text-align: center;
          font-size: clamp(0.95rem, 1vw, 1rem);
          line-height: 1.42;
          min-height: 4.25em;
          max-width: 18ch;
          text-wrap: pretty;
        }

        .radiating-art {
          position: relative;
          width: min(100%, 260px);
          aspect-ratio: 2 / 3;
          border-radius: 1rem;
          overflow: hidden;
          margin-top: 0.2rem;
          background: radial-gradient(circle at 50% 42%, rgba(233, 241, 253, 0.95) 0%, rgba(248, 252, 255, 0.45) 80%);
        }

        .radiating-check {
          margin-top: 0.18rem;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 2px solid #3986f0;
          color: transparent;
          background: #ffffff;
          display: grid;
          place-items: center;
          font-size: 1.55rem;
          font-weight: 700;
          line-height: 1;
        }

        .radiating-check-active {
          background: #3986f0;
          color: #ffffff;
        }

        .pain-worse-stack-shell {
          border-radius: 1.5rem;
          border: 1px solid #d9e6f4;
          background: linear-gradient(180deg, #fbfdff 0%, #f2f7fc 100%);
          padding: 0.7rem 0.7rem;
          box-shadow: 0 14px 30px rgba(26, 84, 136, 0.07);
          height: 100%;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .pain-worse-space {
          position: relative;
          min-height: clamp(300px, 50vh, 560px);
          flex: 1;
          perspective: 1280px;
          perspective-origin: center center;
          overflow: hidden;
          border-radius: 1.2rem;
          padding: 0.2rem clamp(18px, 3.1vw, 52px);
          transform-style: preserve-3d;
          touch-action: pan-y;
          overscroll-behavior: contain;
        }

        .pain-worse-card {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(44vw, 228px);
          max-width: 228px;
          aspect-ratio: 5 / 6;
          border-radius: 1.26rem;
          border: 1.5px solid #d4e3f3;
          background: #ffffff;
          box-shadow: 0 12px 24px rgba(26, 84, 136, 0.14);
          overflow: hidden;
          transition: transform 360ms cubic-bezier(0.22, 0.74, 0.22, 1), opacity 260ms ease, border-color 220ms ease, box-shadow 220ms ease;
        }

        .pain-worse-card-front {
          border-color: #8db6e2;
          box-shadow: 0 14px 30px rgba(30, 92, 162, 0.18);
        }

        .pain-worse-card-active {
          border-color: #205fb3;
          box-shadow: 0 0 0 3px rgba(36, 104, 194, 0.72), 0 22px 42px rgba(29, 86, 158, 0.3);
        }

        .pain-worse-card-info {
          display: grid;
          justify-items: center;
          align-content: start;
          gap: 0.3rem;
          padding: 0.66rem 0.58rem 0.58rem;
        }

        .swipe-option-title {
          color: #1a3558;
          text-align: center;
          font-size: clamp(1.02rem, 1.2vw, 1.16rem);
          line-height: 1.2;
          font-weight: 700;
          min-height: 1.25em;
        }

        .swipe-option-title-active {
          color: #2f7ce7;
        }

        .swipe-option-helper {
          color: #5b7391;
          text-align: center;
          font-size: clamp(0.92rem, 1vw, 1rem);
          line-height: 1.36;
          min-height: 3.9em;
          max-width: 18ch;
          text-wrap: pretty;
        }

        .swipe-option-art {
          position: relative;
          width: min(100%, 220px);
          aspect-ratio: 4 / 3;
          border-radius: 1rem;
          overflow: hidden;
          margin-top: 0.1rem;
          background: radial-gradient(circle at 50% 42%, rgba(233, 241, 253, 0.95) 0%, rgba(248, 252, 255, 0.45) 80%);
        }

        .swipe-option-art :global(img),
        .swipe-option-art-portrait :global(img),
        .onset-art :global(img),
        .duration-art :global(img) {
          object-fit: contain !important;
          object-position: center center !important;
        }

        .swipe-option-art-portrait {
          width: min(100%, 204px);
          aspect-ratio: 3 / 4;
        }

        .treatment-helped-card {
          gap: 0.12rem;
          padding-top: 0.54rem;
          padding-bottom: 0.42rem;
        }

        .treatment-helped-helper {
          min-height: 0;
          line-height: 1.24;
        }

        .treatment-helped-card .swipe-option-art {
          margin-top: 0;
        }

        .pain-worse-art {
          position: absolute;
          inset: 0.4rem;
          border-radius: 0.9rem;
          overflow: hidden;
          background: radial-gradient(circle at 50% 42%, rgba(233, 241, 253, 0.95) 0%, rgba(248, 252, 255, 0.45) 80%);
        }

        .pain-worse-art :global(img) {
          object-fit: contain !important;
          object-position: center center !important;
        }

        .pain-worse-art::after {
          content: "";
          position: absolute;
          right: 0.52rem;
          top: 0.52rem;
          width: 38px;
          height: 38px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 0 0 1px rgba(212, 227, 243, 0.9);
          pointer-events: none;
        }

        .pain-worse-check-chip {
          display: none;
          position: absolute;
          right: 0.62rem;
          top: 0.62rem;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 2px solid #b9cae0;
          display: grid;
          place-items: center;
          color: transparent;
          background: #ffffff;
          font-size: 1.08rem;
          font-weight: 700;
          line-height: 1;
        }

        .pain-worse-check-chip-active {
          border-color: #2972d4;
          color: #ffffff;
          background: #2972d4;
        }

        .pain-worse-hint {
          margin-top: 0.6rem;
          text-align: center;
          color: #3f6489;
          font-size: 0.96rem;
          line-height: 1.36;
        }

        .treatments-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .treatments-card {
          position: relative;
          min-height: 0;
          aspect-ratio: 428 / 385;
          border-radius: 1.25rem;
          border: 1.4px solid #d7e4f3;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 14px 32px rgba(26, 84, 136, 0.09);
          transition: border-color 170ms ease, box-shadow 170ms ease, transform 170ms ease;
        }

        .treatments-card:hover {
          transform: translateY(-1px);
          border-color: #afc8e3;
        }

        .treatments-card-active {
          border-color: #2972d4;
          box-shadow: 0 0 0 2px rgba(41, 114, 212, 0.75), 0 14px 34px rgba(41, 114, 212, 0.18);
        }

        .treatments-art {
          position: absolute;
          inset: 0;
        }

        .treatments-check-chip {
          position: absolute;
          right: 0.76rem;
          top: 0.76rem;
          width: 38px;
          height: 38px;
          border-radius: 999px;
          border: 2px solid #b9cae0;
          display: grid;
          place-items: center;
          color: transparent;
          background: #ffffff;
          font-size: 1.24rem;
          font-weight: 700;
          line-height: 1;
        }

        .treatments-check-chip-active {
          border-color: #2972d4;
          background: #2972d4;
          color: #ffffff;
        }

        .side-tile {
          position: relative;
          overflow: hidden;
          min-height: 176px;
          border-radius: 1.5rem;
          border: 1.5px solid #cfd9e5;
          background: #f8fbff;
          color: #13345a;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: flex-end;
          padding: 0.9rem;
          text-align: left;
          transition: border-color 170ms ease, box-shadow 170ms ease, background-color 170ms ease;
        }

        .side-tile:hover {
          border-color: #8cb0d3;
        }

        .side-tile-active {
          border: 3px solid #2a68c9;
          background: #bfd4f2;
          color: #1d5fbe;
          box-shadow: 0 12px 24px rgba(38, 101, 200, 0.16);
        }

        .side-art {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: linear-gradient(180deg, rgba(24, 58, 96, 0.05), rgba(24, 58, 96, 0.1));
        }

        .side-art::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.64) 54%, rgba(255, 255, 255, 0.9) 100%);
          z-index: 1;
        }

        .side-info {
          position: relative;
          z-index: 2;
          display: grid;
          gap: 0.2rem;
        }

        .side-title {
          font-size: 1.35rem;
          font-weight: 700;
          color: #17395f;
        }

        .side-helper {
          font-size: 0.85rem;
          color: #486b90;
        }

        .side-icon-chip {
          position: absolute;
          right: 0.75rem;
          top: 0.75rem;
          z-index: 2;
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 2px solid #b8c6d5;
          display: grid;
          place-items: center;
          color: #577da6;
          background: rgba(255, 255, 255, 0.95);
          flex: 0 0 auto;
        }

        .side-icon-chip-active {
          border-color: #2a68c9;
          background: #2a68c9;
          color: #ffffff;
        }

        .duration-card {
          position: relative;
          overflow: hidden;
          min-height: 266px;
          border-radius: 1.7rem;
          border: 1.5px solid #d7e3ef;
          background: #ffffff;
          display: grid;
          justify-items: center;
          align-content: start;
          gap: 0.2rem;
          padding: 0.95rem 1rem 0.85rem;
          text-align: center;
          box-shadow: 0 14px 32px rgba(26, 84, 136, 0.08);
          transition: border-color 170ms ease, box-shadow 170ms ease, transform 170ms ease;
        }

        .duration-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 34px rgba(26, 84, 136, 0.12);
        }

        .duration-card-active {
          border: 3px solid #43c03e;
          box-shadow: 0 0 0 2px rgba(102, 214, 93, 0.24), 0 16px 42px rgba(102, 214, 93, 0.36);
        }

        .duration-badge {
          position: absolute;
          left: 0.8rem;
          top: 0.8rem;
          z-index: 3;
          border-radius: 999px;
          background: #dff7d9;
          color: #2b9a43;
          font-size: 0.74rem;
          font-weight: 700;
          padding: 0.3rem 0.62rem;
        }

        .duration-check {
          position: absolute;
          right: 0.85rem;
          top: 0.85rem;
          z-index: 3;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 2px solid #bfd0df;
          color: transparent;
          background: #ffffff;
          display: grid;
          place-items: center;
          font-size: 1rem;
          line-height: 1;
          font-weight: 700;
        }

        .duration-card-active .duration-check {
          border-color: #1f8d35;
          background: #1f8d35;
          color: #ffffff;
        }

        .duration-art {
          position: relative;
          width: min(100%, 232px);
          aspect-ratio: 16 / 11;
          margin-top: 0.15rem;
          border-radius: 1.1rem;
          overflow: hidden;
        }

        .duration-title {
          margin-top: 0.65rem;
          color: #13233d;
          font-size: 1.35rem;
          line-height: 1.14;
          font-weight: 700;
        }

        .duration-helper {
          color: #2a4262;
          font-size: 0.95rem;
          line-height: 1.2;
          font-weight: 500;
        }

        .duration-underline {
          margin-top: 0.45rem;
          width: 44px;
          height: 5px;
          border-radius: 999px;
          background: #c6d2de;
        }

        .duration-card-active .duration-underline {
          background: #a8df9f;
        }

        @media (max-width: 1024px) {
          .body-stage {
            height: 560px;
            width: min(100%, 610px);
          }

          .change-overall-art {
            width: min(100%, 190px);
            max-height: min(30vh, 226px);
          }

          .change-overall-label {
            max-width: 12ch;
          }

          .change-overall-stage {
            min-height: clamp(330px, 53vh, 470px);
          }

          .radiating-grid {
            gap: 0.82rem;
          }

          .radiating-card {
            padding: 0.84rem 0.7rem 0.72rem;
          }

          .radiating-helper {
            min-height: 4.75em;
            font-size: 0.89rem;
          }

          .radiating-art {
            width: min(100%, 220px);
          }

          .pain-worse-space {
            min-height: clamp(286px, 48vh, 520px);
            padding-inline: clamp(12px, 2.2vw, 24px);
          }

          .pain-worse-card {
            width: min(46vw, 212px);
            max-width: 212px;
          }

          .swipe-option-title {
            font-size: 0.98rem;
          }

          .swipe-option-helper {
            font-size: 0.86rem;
            min-height: 4.4em;
          }

          .swipe-option-art {
            width: min(100%, 204px);
          }

          .pain-worse-hint {
            font-size: 0.9rem;
          }

          .treatments-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.8rem;
          }

          .treatments-check-chip {
            width: 34px;
            height: 34px;
            font-size: 1.08rem;
          }
        }

        @media (max-width: 640px) {
          .body-stage {
            height: 500px;
            width: min(100%, 430px);
          }

          .hotspot {
            width: 36px;
            height: 36px;
          }

          .hotspot-core {
            width: 18px;
            height: 18px;
          }

          .hotspot-callout {
            font-size: 0.72rem;
            padding: 0.36rem 0.5rem;
          }

          .risk-card {
            min-height: 126px;
            border-radius: 0.82rem;
            padding: 0.38rem 0.38rem 0.48rem;
            gap: 0.3rem;
          }

          .risk-label {
            font-size: 0.72rem;
            line-height: 1.2;
            min-height: 2.4em;
            padding: 0 0.05rem;
          }

          .risk-dot {
            width: 24px;
            height: 4px;
          }

          .risk-none-card {
            margin-top: 0.85rem;
            border-radius: 1rem;
            padding: 0.55rem 0.6rem;
          }

          .risk-none-image-wrap {
            width: 60px;
            height: 60px;
            border-radius: 0.75rem;
          }

          .risk-none-label {
            font-size: 0.95rem;
          }

          .risk-none-check {
            width: 38px;
            height: 38px;
            font-size: 1rem;
          }

          .side-tile {
            min-height: 132px;
            border-radius: 1.1rem;
            padding: 0.62rem;
          }

          .side-title {
            font-size: 1rem;
          }

          .side-helper {
            font-size: 0.72rem;
          }

          .side-icon-chip {
            width: 34px;
            height: 34px;
          }

          .reason-space {
            min-height: 248px;
          }

          .reason-card {
            width: min(64vw, 194px);
            aspect-ratio: 3 / 4;
            border-radius: 1.15rem;
            padding: 0.58rem 0.54rem 0.65rem;
          }

          .reason-icon-orb {
            width: 60px;
            height: 60px;
            margin-top: 0.62rem;
            margin-bottom: 0.32rem;
          }

          .reason-icon-orb :global(svg) {
            width: 1.15rem;
            height: 1.15rem;
          }

          .reason-card-title {
            font-size: 0.86rem;
          }

          .reason-card-helper {
            font-size: 0.68rem;
          }

          .onset-space {
            min-height: 254px;
          }

          .onset-card {
            width: min(64vw, 190px);
            aspect-ratio: 3 / 4;
            border-radius: 1.15rem;
            padding: 0.52rem 0.48rem 0.58rem;
          }

          .onset-art {
            width: min(100%, 164px);
            border-radius: 0.86rem;
            margin-top: 0.2rem;
            margin-bottom: 0.4rem;
          }

          .onset-card-title {
            font-size: 0.84rem;
          }

          .onset-card-helper {
            font-size: 0.66rem;
          }

          .pain-score-shell {
            border-radius: 1.1rem;
            padding: 0.66rem 0.45rem 0.62rem;
          }

          .pain-score-track {
            min-height: 238px;
            padding-bottom: 0.45rem;
          }

          .pain-score-card {
            margin-left: -28px;
            width: 56px;
            min-height: 132px;
            border-radius: 0.82rem;
            padding: 0.5rem 0.22rem 0.45rem;
          }

          .pain-score-card-active {
            margin-left: -70px;
            width: 140px;
            min-height: 202px;
          }

          .pain-score-number {
            font-size: 1.5rem;
          }

          .pain-score-card-active .pain-score-number {
            font-size: 3.45rem;
          }

          .pain-score-word {
            font-size: 0.5rem;
            max-width: 46px;
          }

          .pain-score-state {
            font-size: 1.1rem;
          }

          .pain-score-face {
            margin-top: 0.28rem;
          }

          .pain-score-card-active .pain-score-face {
            margin-top: 0.42rem;
          }

          .pain-score-face :global(svg) {
            width: 1.35rem;
            height: 1.35rem;
          }

          .pain-score-card-active .pain-score-face :global(svg) {
            width: 2.7rem;
            height: 2.7rem;
          }

          .pain-score-orbit {
            --orbit-radius: 32px;
            width: 68px;
            height: 68px;
          }

          .pain-score-orbit-tick {
            width: 5px;
            height: 5px;
          }

          .pain-score-axis {
            padding: 0.46rem 0.6rem;
            font-size: 0.75rem;
          }

          .pain-score-selected {
            font-size: 0.8rem;
          }

          .pattern-shell {
            border-radius: 1.1rem;
            padding: 0.55rem 0.5rem;
          }

          .pattern-list {
            gap: 0.52rem;
          }

          .pattern-row {
            min-height: 62px;
            border-radius: 1rem;
            gap: 0.62rem;
            padding: 0.58rem 0.62rem;
          }

          .pattern-icon {
            width: 34px;
            height: 34px;
          }

          .pattern-icon :global(svg) {
            width: 1rem;
            height: 1rem;
          }

          .pattern-label {
            font-size: 0.82rem;
          }

          .pattern-check {
            width: 36px;
            height: 36px;
            font-size: 0.92rem;
          }

          .change-overall-shell {
            border-radius: 1.1rem;
            padding: 0.6rem 0.5rem;
          }

          .change-overall-grid {
            gap: 0.58rem;
          }

          .change-overall-tile {
            border-radius: 1rem;
            padding: 0.48rem 0.42rem 0.5rem;
            gap: 0.36rem;
          }

          .change-overall-art {
            width: min(100%, 148px);
            max-height: min(24vh, 182px);
            border-radius: 0.86rem;
          }

          .change-overall-label {
            font-size: 0.8rem;
            line-height: 1.24;
            min-height: 2.48em;
            max-width: 12ch;
          }

          .change-overall-stage {
            min-height: clamp(300px, 48vh, 400px);
          }

          .radiating-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.6rem;
          }

          .radiating-card {
            border-radius: 1rem;
            padding: 0.62rem 0.5rem 0.56rem;
            gap: 0.3rem;
          }

          .radiating-title {
            font-size: 0.92rem;
          }

          .radiating-helper {
            font-size: 0.74rem;
            min-height: 4.9em;
            max-width: 16ch;
          }

          .radiating-art {
            width: min(100%, 160px);
            border-radius: 0.86rem;
            margin-top: 0.1rem;
          }

          .radiating-check {
            width: 32px;
            height: 32px;
            font-size: 1.2rem;
            border-width: 1.8px;
          }

          .pain-worse-stack-shell {
            border-radius: 1.1rem;
            padding: 0.55rem;
          }

          .pain-worse-space {
            min-height: clamp(244px, 42vh, 420px);
            padding-inline: 10px;
          }

          .pain-worse-card {
            width: min(54vw, 188px);
            max-width: 188px;
            border-radius: 1rem;
          }

          .pain-worse-card-info {
            gap: 0.28rem;
            padding: 0.58rem 0.5rem 0.5rem;
          }

          .swipe-option-title {
            font-size: 0.88rem;
            line-height: 1.18;
          }

          .swipe-option-helper {
            font-size: 0.72rem;
            min-height: 4.6em;
            max-width: 16ch;
          }

          .swipe-option-art {
            width: min(100%, 156px);
            border-radius: 0.82rem;
          }

          .swipe-option-art-portrait {
            width: min(100%, 146px);
          }

          .pain-worse-check-chip {
            right: 0.55rem;
            top: 0.55rem;
            width: 30px;
            height: 30px;
            font-size: 1rem;
          }

          .pain-worse-hint {
            font-size: 0.78rem;
            margin-top: 0.46rem;
          }

          .treatments-grid {
            grid-template-columns: 1fr;
            gap: 0.62rem;
          }

          .treatments-card {
            border-radius: 0.95rem;
          }

          .treatments-check-chip {
            right: 0.56rem;
            top: 0.56rem;
            width: 30px;
            height: 30px;
            font-size: 1.05rem;
            border-width: 1.6px;
          }

          .duration-card {
            min-height: 222px;
            border-radius: 1.2rem;
            padding: 0.7rem 0.7rem 0.62rem;
          }

          .duration-check {
            width: 30px;
            height: 30px;
            font-size: 1rem;
            right: 0.6rem;
            top: 0.6rem;
          }

          .duration-badge {
            left: 0.55rem;
            top: 0.55rem;
            font-size: 0.65rem;
            padding: 0.26rem 0.5rem;
          }

          .duration-art {
            width: min(100%, 190px);
            border-radius: 0.9rem;
          }

          .duration-title {
            margin-top: 0.45rem;
            font-size: 1.15rem;
          }

          .duration-helper {
            font-size: 0.94rem;
          }

          .duration-underline {
            width: 36px;
            height: 4px;
          }

        }
      `}</style>
    </main>
  );
}
