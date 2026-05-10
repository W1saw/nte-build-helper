// Минимальный клиент Gemini API через fetch.
// Документация: https://ai.google.dev/api/generate-content

const ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiSchema = Record<string, unknown>;

export type GeminiVisionRequest = {
  model: "gemini-2.5-flash" | "gemini-2.5-pro";
  systemPrompt: string;
  userPrompt: string;
  imageBase64: string;
  imageMimeType: string;
  responseSchema: GeminiSchema;
};

export class GeminiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
  }
}

export async function generateStructuredFromImage<T>(
  req: GeminiVisionRequest,
): Promise<T> {
  return callGemini<T>({
    model: req.model,
    systemPrompt: req.systemPrompt,
    userParts: [
      { text: req.userPrompt },
      { inlineData: { mimeType: req.imageMimeType, data: req.imageBase64 } },
    ],
    responseSchema: req.responseSchema,
    temperature: 0.1,
  });
}

export type GeminiTextRequest = {
  model: "gemini-2.5-flash" | "gemini-2.5-pro";
  systemPrompt: string;
  userPrompt: string;
  responseSchema: GeminiSchema;
  temperature?: number;
};

export async function generateStructuredText<T>(req: GeminiTextRequest): Promise<T> {
  return callGemini<T>({
    model: req.model,
    systemPrompt: req.systemPrompt,
    userParts: [{ text: req.userPrompt }],
    responseSchema: req.responseSchema,
    temperature: req.temperature ?? 0.4,
  });
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

async function callGemini<T>(opts: {
  model: string;
  systemPrompt: string;
  userParts: Part[];
  responseSchema: GeminiSchema;
  temperature: number;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not set", 500, "");

  const url = `${ENDPOINT_BASE}/${opts.model}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    contents: [{ role: "user", parts: opts.userParts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
      temperature: opts.temperature,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new GeminiError(`Gemini API ${response.status}`, response.status, text);
  }

  let parsed: { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiError("Invalid JSON response from Gemini", 500, text);
  }

  const jsonText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) {
    throw new GeminiError("No content in Gemini response", 500, text);
  }

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new GeminiError("Gemini returned text but not valid JSON", 500, jsonText);
  }
}
