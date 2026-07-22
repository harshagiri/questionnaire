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
      "You are a strict summarizer for doctors.",
      "Use only explicit provided input values.",
      "Do NOT infer, diagnose, recommend, prioritize, or add missing-data analysis.",
      "Do NOT add any content not present in input.",
      "Keep summary concise and easy to scan.",
      "Return plain text in this exact format:",
      "Patient snapshot: <one sentence>",
      "Key reported details:",
      "- <bullet>",
      "- <bullet>",
      "- <bullet>",
      "Optional additional context:",
      "- <bullet>",
      "Maximum 110 words total.",
    ].join("\n");
  }

  return [
    "You are a strict summarizer for doctors.",
    "Use only explicit provided input values.",
    "Do NOT infer, diagnose, recommend, prioritize, or add new information.",
    "Summarize what doctor entered in concise plain language.",
    "Return plain text in this exact format:",
    "Doctor submission snapshot: <one sentence>",
    "Key documented findings/actions:",
    "- <bullet>",
    "- <bullet>",
    "- <bullet>",
    "Optional additional context:",
    "- <bullet>",
    "Maximum 120 words total.",
  ].join("\n");
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
  const maxWords = body.summaryType === "patient-preconsult" ? 110 : 120;
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
