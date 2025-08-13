export const config = { runtime: "edge" };

const ORIGIN = "*";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function isDataUrlImage(s: unknown): s is string {
  return typeof s === "string" && s.startsWith("data:image/");
}

function pickBestFrame(frames: string[]): string | null {
  const valid = frames.filter((f) => isDataUrlImage(f) && f.length > 1200);
  if (!valid.length) return null;
  return valid.sort((a, b) => b.length - a.length)[0]; // longest payload ≈ richest frame
}

async function callGeminiAnalyze(
  model: string,
  apiKey: string,
  imageDataUrl: string,
  step: string,
  signal: AbortSignal
) {
  const payload = {
    contents: [
      {
        parts: [
          {
            text:
              `You are verifying whether a single photo shows the user completing this step: "${step}".\n` +
              `Return **only** strict JSON like: {"confidence": 0.0-1.0, "feedback": "short helpful text"}`
          },
          {
            inline_data: {
              mime_type: imageDataUrl.includes("image/png") ? "image/png" : "image/jpeg",
              data: imageDataUrl.split(",")[1] ?? "",
            },
          },
        ],
      },
    ],
  };

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    }
  );

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return { ok: false as const, status: r.status, body: text };
  }
  const data = await r.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") ??
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "";

  let confidence = 0;
  let feedback = text || "No feedback.";
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.confidence === "number") {
      confidence = Math.max(0, Math.min(1, parsed.confidence));
    }
    if (typeof parsed.feedback === "string") {
      feedback = parsed.feedback;
    }
  } catch {
    // fall back to raw text as feedback
  }
  return { ok: true as const, status: 200, confidence, feedback };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const env = (globalThis as any).process?.env ?? {};
  const model = (env.GEMINI_MODEL as string) ?? "gemini-1.5-flash-8b";
  const key = (env.GEMINI_API_KEY as string) ?? "";

  // Health check
  if (body?.ping === true) {
    return json({ ok: true, model });
  }

  // Mock verify (for UI fallback/testing)
  if (body?.mockVerify === true) {
    const c = typeof body.mockConfidence === "number" ? body.mockConfidence : 0.9;
    const f = body.mockFeedback ?? "Mock verification OK.";
    return json({ confidence: c, feedback: f });
  }

  // Real verification path
  const step = (body?.instruction_step ?? "").toString().trim();
  let image: string | null = null;
  if (isDataUrlImage(body?.image)) image = body.image;
  else if (Array.isArray(body?.frames)) image = pickBestFrame(body.frames);

  if (!image || !step) return json({ error: "image and instruction_step required" }, 400);
  if (!key) return json({ error: "Missing GEMINI_API_KEY" }, 500);

  // Timeout keeps UI snappy
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const r = await callGeminiAnalyze(model, key, image, step, controller.signal);
    clearTimeout(timeout);
    if (!r.ok) return json({ error: "Gemini error", detail: r.body }, 502);
    return json({ confidence: r.confidence, feedback: r.feedback });
  } catch (e: any) {
    clearTimeout(timeout);
    if (e?.name === "AbortError") return json({ error: "timeout" }, 500);
    return json({ error: "server-failure", detail: String(e?.message ?? e) }, 500);
  }
}
