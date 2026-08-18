import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeCarePlan, type CarePlan } from "@/lib/care-plan";
import { getCarePlan, listCarePlansByPhone, saveCarePlan } from "@/lib/care-plan-db";

const factSchema = z.object({ label: z.string(), value: z.string() });

const carePlanSchema = z.object({
  doctorAssessment: z.string().default(""),
  whatIShouldDoNow: z.array(z.string()).default([]),
  whatIShouldNotWorryAbout: z.array(z.string()).default([]),
  warningSigns: z.array(z.string()).default([]),
  nextAction: z.string().default(""),
  responsiblePerson: z.string().default(""),
  whenItShouldHappen: z.string().default(""),
  reviewedBy: z.string().default(""),
});

const requestSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("generate"),
    consultSessionId: z.string().min(1),
    context: z.object({
      doctorName: z.string().default(""),
      patient: z.object({
        name: z.string().default(""),
        age: z.string().default(""),
        sex: z.string().default(""),
        promSummary: z.string().default(""),
        facts: z.array(factSchema).default([]),
      }),
      doctor: z.object({
        facts: z.array(factSchema).default([]),
      }),
    }),
  }),
  z.object({
    mode: z.literal("save"),
    consultSessionId: z.string().min(1),
    plan: carePlanSchema,
  }),
]);

type GenerateContext = Extract<z.infer<typeof requestSchema>, { mode: "generate" }>["context"];

function findFact(facts: Array<{ label: string; value: string }>, ...labelFragments: string[]) {
  for (const fragment of labelFragments) {
    const match = facts.find((fact) => fact.label.toLowerCase().includes(fragment.toLowerCase()));
    if (match?.value?.trim()) {
      return match.value.trim();
    }
  }

  return "";
}

function buildFallbackCarePlan(context: GenerateContext): CarePlan {
  const doctorFacts = context.doctor.facts;

  return {
    doctorAssessment:
      findFact(doctorFacts, "diagnosis", "impression", "primary problem", "assessment") ||
      findFact(context.patient.facts, "main concern", "summary"),
    whatIShouldDoNow: [
      findFact(doctorFacts, "treatment plan", "advice", "management"),
      findFact(doctorFacts, "physiotherapy", "exercise"),
      findFact(doctorFacts, "investigation", "imaging"),
    ].filter((item) => item.length > 0),
    whatIShouldNotWorryAbout: [],
    warningSigns: [],
    nextAction: findFact(doctorFacts, "follow-up", "next review", "care pathway"),
    responsiblePerson: context.doctorName ? `${context.doctorName} and clinic care coordinator` : "Clinic care coordinator",
    whenItShouldHappen: findFact(doctorFacts, "follow-up interval", "review in", "follow-up"),
    reviewedBy: context.doctorName,
  };
}

const systemPrompt = [
  "You write a patient-facing care plan after a doctor consultation.",
  "Use ONLY the facts provided. Never invent diagnosis, medication, dosage, or timelines that are not present.",
  "Write in simple, reassuring language at a 6th-grade reading level. Use second person ('you').",
  "Leave a field empty (empty string or empty array) when the input does not support it.",
  "Return ONLY minified JSON with exactly these keys:",
  '{"doctorAssessment":string,"whatIShouldDoNow":string[],"whatIShouldNotWorryAbout":string[],"warningSigns":string[],"nextAction":string,"responsiblePerson":string,"whenItShouldHappen":string}',
  "doctorAssessment: 1-2 sentences on what the doctor concluded.",
  "whatIShouldDoNow: up to 5 short action bullets from the documented plan.",
  "whatIShouldNotWorryAbout: up to 3 reassurance bullets supported by documented findings.",
  "warningSigns: up to 5 red-flag symptoms that need urgent medical attention.",
  "nextAction: the next appointment or action. responsiblePerson: who owns it. whenItShouldHappen: when it should happen.",
].join("\n");

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const outputText = (payload as { output_text?: unknown }).output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of output) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      const text = (block as { text?: unknown })?.text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text.trim());
      }
    }
  }

  return chunks.join("\n").trim();
}

async function generateCarePlan(context: GenerateContext): Promise<CarePlan> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";

  if (!apiKey) {
    return buildFallbackCarePlan(context);
  }

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_output_tokens: 700,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(context, null, 2) }] },
      ],
    }),
  });

  if (!response.ok) {
    return buildFallbackCarePlan(context);
  }

  const text = extractOutputText(await response.json().catch(() => null));
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");

  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return buildFallbackCarePlan(context);
  }

  try {
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
    const plan = normalizeCarePlan({ ...parsed, reviewedBy: context.doctorName });
    return plan ?? buildFallbackCarePlan(context);
  } catch {
    return buildFallbackCarePlan(context);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const consultSessionId = searchParams.get("consultSessionId");
  const patientPhone = searchParams.get("patientPhone");

  try {
    if (consultSessionId) {
      const record = await getCarePlan(consultSessionId);
      return NextResponse.json({ ok: true, record });
    }

    if (patientPhone) {
      const records = await listCarePlansByPhone(patientPhone);
      return NextResponse.json({ ok: true, records });
    }

    return NextResponse.json({ ok: false, message: "consultSessionId or patientPhone is required" }, { status: 400 });
  } catch (error) {
    console.error("Could not load care plan", error);
    return NextResponse.json({ ok: false, message: "Could not load care plan" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.mode === "save") {
      const plan = normalizeCarePlan({ ...parsed.data.plan });
      if (!plan) {
        return NextResponse.json({ ok: false, message: "Care plan is empty" }, { status: 400 });
      }

      const result = await saveCarePlan({
        consultSessionId: parsed.data.consultSessionId,
        plan,
        editedByDoctor: true,
      });

      return NextResponse.json(result, { status: result.ok ? 200 : 404 });
    }

    const existing = await getCarePlan(parsed.data.consultSessionId);
    if (existing) {
      return NextResponse.json({ ok: true, record: existing, reused: true });
    }

    const generated = await generateCarePlan(parsed.data.context);
    const result = await saveCarePlan({
      consultSessionId: parsed.data.consultSessionId,
      plan: { ...generated, reviewedBy: generated.reviewedBy || parsed.data.context.doctorName },
      editedByDoctor: false,
      generatedAt: new Date().toISOString(),
    });

    // Care plan is surfaced only when it was persisted for the visit.
    return NextResponse.json(result, { status: result.ok ? 201 : 404 });
  } catch (error) {
    console.error("Could not save care plan", error);
    return NextResponse.json({ ok: false, message: "Could not save care plan" }, { status: 500 });
  }
}
