# Patient Questionnaire Section Audit

Date: 2026-07-08

## Source of truth (PDF)
File: docs/Emailing SEI PQ v3 FINAL 2.pdf

Expected hierarchy from PDF:
1. Pre-screen: Urgent Red Flag Pre-Screen (unscored)
2. Part 1 - Patient Profile
3. Part 2 - Your Current Problem
4. Part 3 - Symptom and Function Assessment
5. Part 3 / Section 1 - Symptom Severity
6. Part 3 / Section 2 - Neurological Symptoms
7. Part 3 / Section 3 - Functional Disability
8. Part 3 / Section 4 - Previous Treatment Journey
9. Part 3 / Section 5 - Your Concerns and Goals

PDF stated question count: 40 (plus pre-screen block)

## Database state (after schema apply + seed)
Database: PostgreSQL on localhost:5432 (container questionnaire-postgres-1)

Questionnaire seeded:
- slug: sei-pq-v3-final
- title: SEI-PQ v3.0 Final
- question rows: 41 (40 numbered questions + 1 pre-screen question)
- distinct part/section labels: 12

Stored DB part/section labels:
1. Pre-screen / Urgent Red Flag Pre-Screen
2. Part 1 - Patient Profile / Basic Patient Details
3. Part 1 - Patient Profile / Medical History
4. Part 1 - Patient Profile / Previous Medical Reports Available
5. Part 1 - Patient Profile / Understanding of Your Diagnosis
6. Part 2 - Your Current Problem / Current Problem
7. Part 2 - Your Current Problem / Pain Behaviour and Triggers
8. Part 3 - Symptom and Function Assessment / Section 1 Symptom Severity
9. Part 3 - Symptom and Function Assessment / Section 2 Neurological Symptoms
10. Part 3 - Symptom and Function Assessment / Section 3 Functional Disability
11. Part 3 - Symptom and Function Assessment / Section 4 Previous Treatment Journey
12. Part 3 - Symptom and Function Assessment / Section 5 Your Concerns and Goals

## App state (current UI data)
File: src/lib/workflow-data.ts

Current app patient sections:
1. red-flags / Urgent red flag pre-screen
2. patient-profile / Basic patient details
3. background / Medical background & BMI
4. diagnosis-understanding / Understanding of diagnosis
5. symptoms / Symptoms and pain context
6. function-impact / Function, risk and review

## Mismatch summary
1. DB now follows the PDF hierarchy (Part/Section based).
2. App still uses a condensed 6-section model and does not expose the PDF Part 3 sub-sections (Section 1-5) as separate sections.
3. App question wording and grouping are customized; DB records are PDF-aligned labels.
4. To fully match, app rendering should be refactored to consume DB sections (or mirror the same section taxonomy in workflow-data.ts).
