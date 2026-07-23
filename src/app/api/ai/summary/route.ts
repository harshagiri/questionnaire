import { NextResponse } from "next/server";
import { z } from "zod";

const answerValueSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

const summaryRequestSchema = z.object({
  summaryType: z.enum(["patient-preconsult", "doctor-postconsult"]),
  patient: z.object({
    consultSessionId: z.string().min(1),
    name: z.string().optional(),
    phone: z.string().optional(),
    age: z.string().optional(),
    sex: z.string().optional(),
    region: z.string().optional(),
    language: z.string().optional(),
    bmi: z.string().optional(),
    painScore: z.string().optional(),
    consultationType: z.string().optional(),
    promSummary: z.string().optional(),
    prom: z
      .object({
        instrument: z.enum(["ODI", "NDI"]).optional(),
        percent: z.number().optional(),
        severity: z.string().optional(),
        source: z.enum(["patient-auto", "doctor-entered"]).optional(),
      })
      .optional(),
    questionnaireAnswers: z.record(z.string(), answerValueSchema).default({}),
    facts: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  }),
  doctor: z
    .object({
      answers: z.record(z.string(), answerValueSchema).default({}),
      facts: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
      completionPercent: z.number().optional(),
    })
    .optional(),
});

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  return { apiKey, model, baseUrl };
}

function buildSystemPrompt(summaryType: "patient-preconsult" | "doctor-postconsult") {
  if (summaryType === "patient-preconsult") {
    return [
      "You are a strict clinical briefing assistant for doctors.",
      "Use only explicit provided input values.",
      "Do NOT invent facts, diagnosis, or treatment details.",
      "PROM score and PROM pathway hint must be used to frame next-step triage guidance.",
      "Do NOT provide medication prescriptions.",
      "Return plain text in this exact format:",
      "Patient snapshot: <one sentence>",
      "PROM and risk signal:",
      "- <bullet>",
      "- <bullet>",
      "Pathway recommendation:",
      "- <bullet with pathway + rationale>",
      "Doctor form influence:",
      "- patientRiskCategory: <low|moderate|high>",
      "- aiSuggestedPathway: <education|conservative|specialist-evaluation|priority-review>",
      "- overallRiskCategory: <routine|needs-follow-up|urgent>",
      "Optional context:",
      "- <bullet>",
      "Maximum 140 words total.",
    ].join("\n");
  }

  return [
    "You are a strict clinical summarizer for doctors.",
    "Use only explicit provided input values.",
    "Use PROM score and pathway hint to assess alignment with doctor's selected pathway fields.",
    "Do NOT invent facts.",
    "Return plain text in this exact format:",
    "Doctor submission snapshot: <one sentence>",
    "Pathway alignment check:",
    "- <bullet>",
    "- <bullet>",
    "Key documented findings/actions:",
    "- <bullet>",
    "- <bullet>",
    "Doctor form focus updates:",
    "- <bullet referencing carePathway / overallRiskCategory / summaryValidation>",
    "Optional context:",
    "- <bullet>",
    "Maximum 150 words total.",
  ].join("\n");
}

function parsePercent(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function derivePromPathwayHint(patient: z.infer<typeof summaryRequestSchema>["patient"]) {
  const percent = parsePercent(patient.prom?.percent);
  const answers = patient.questionnaireAnswers ?? {};
  const redFlagKeys = [
    "redFlagBladderBowel",
    "redFlagRapidWeakness",
    "redFlagFever",
    "redFlagTrauma",
    "redFlagCancer",
    "redFlagWeightLoss",
  ];
  const hasUrgentRedFlag = redFlagKeys.some((key) => answers[key] === true);

  if (hasUrgentRedFlag) {
    return {
      hasUrgentRedFlag: true,
      promPercent: percent,
      patientRiskCategory: "high",
      aiSuggestedPathway: "priority-review",
      overallRiskCategory: "urgent",
      suggestedCarePathway: "pathway-5",
      rationale: "Urgent red-flag positive responses are present.",
    } as const;
  }

  if (percent === null) {
    return {
      hasUrgentRedFlag: false,
      promPercent: null,
      patientRiskCategory: "moderate",
      aiSuggestedPathway: "specialist-evaluation",
      overallRiskCategory: "needs-follow-up",
      suggestedCarePathway: "pathway-3",
      rationale: "PROM is unavailable, so use conservative specialist follow-up until scored.",
    } as const;
  }

  if (percent >= 61) {
    return {
      hasUrgentRedFlag: false,
      promPercent: percent,
      patientRiskCategory: "high",
      aiSuggestedPathway: "priority-review",
      overallRiskCategory: "urgent",
      suggestedCarePathway: "pathway-4",
      rationale: "PROM disability is high.",
    } as const;
  }

  if (percent >= 41) {
    return {
      hasUrgentRedFlag: false,
      promPercent: percent,
      patientRiskCategory: "high",
      aiSuggestedPathway: "specialist-evaluation",
      overallRiskCategory: "needs-follow-up",
      suggestedCarePathway: "pathway-3",
      rationale: "PROM disability is moderate-to-severe.",
    } as const;
  }

  if (percent >= 21) {
    return {
      hasUrgentRedFlag: false,
      promPercent: percent,
      patientRiskCategory: "moderate",
      aiSuggestedPathway: "conservative",
      overallRiskCategory: "needs-follow-up",
      suggestedCarePathway: "pathway-2",
      rationale: "PROM disability is moderate.",
    } as const;
  }

  return {
    hasUrgentRedFlag: false,
    promPercent: percent,
    patientRiskCategory: "low",
    aiSuggestedPathway: "education",
    overallRiskCategory: "routine",
    suggestedCarePathway: "pathway-1",
    rationale: "PROM disability is minimal.",
  } as const;
}

function clampWords(input: string, maxWords: number) {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return input.trim();
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}

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
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }

      const text = (block as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        chunks.push(text.trim());
      }
    }
  }

  return chunks.join("\n\n").trim();
}

export async function POST(request: Request) {
  const parsed = summaryRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid AI summary request", errors: parsed.error.flatten() }, { status: 400 });
  }

  const { apiKey, model, baseUrl } = getOpenAiConfig();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "OPENAI_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const body = parsed.data;
  if (body.summaryType === "doctor-postconsult" && !body.doctor) {
    return NextResponse.json({ ok: false, message: "Doctor answers are required for post-consult summary" }, { status: 400 });
  }

  const promPathwayHint = derivePromPathwayHint(body.patient);

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_output_tokens: 260,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: buildSystemPrompt(body.summaryType) }],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                {
                  summaryType: body.summaryType,
                  patient: body.patient,
                  promPathwayHint,
                  doctor: body.doctor,
                },
                null,
                2,
              ),
            },
          ],
        },
      ],
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: "OpenAI summary request failed",
        details: process.env.NODE_ENV === "development" ? raw : undefined,
      },
      { status: 502 },
    );
  }

  const payload = JSON.parse(raw) as unknown;
  const maxWords = body.summaryType === "patient-preconsult" ? 140 : 150;
  const summary = clampWords(extractOutputText(payload), maxWords);
  if (!summary) {
    return NextResponse.json({ ok: false, message: "AI summary is empty" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    summary,
    model,
  });
}
