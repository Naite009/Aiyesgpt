/// <reference path="../_types/deno.d.ts" />
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * CONFIG
 */
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-1.5-flash";
const REQUIRE_JWT = true; // keep true in production

/**
 * CORS
 * If you want to restrict, set ORIGIN to "https://aiyesgpt.vercel.app"
 */
const ORIGIN = "*";
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
  "Content-Type": "application/json",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function isDataUrlImage(s: unknown): s is string {
  return typeof s === "string" && s.startsWith("data:image/");
}

function pickBestFrame(frames: string[]): string | null {
  const valid = frames.filter((f) => isDataUrlImage(f) && f.length > 1200);
  if (!valid.length) return null;
  return valid.sort((a, b) => b.length - a.length)[0];
}

async function callGeminiAnalyze(imageDataUrl: string, step: string, signal: AbortSignal) {
  const payload = {
    contents: [
      {
        parts: [
          {
            text:
              `User claims they performed this step: "${step}".\n` +
              `Return JSON: {"confidence": number in [0,1], "feedback": string}.`,
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false as const, status: res.status, body: errText };
  }
  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") ??
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "";

  let confidence = 0;
  let feedback = text || "No feedback.";
  try {
    const maybe = JSON.parse(text);
    if (typeof maybe.confidence === "number") {
      confidence = Math.max(0, Math.min(1, maybe.confidence));
    }
    if (typeof maybe.feedback === "string") {
      feedback = maybe.feedback;
    }
  } catch {
    // keep raw text as feedback
  }
  return { ok: true as const, status: 200, confidence, feedback };
}

export default async (req: Request) => {
  // 1) CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // 2) Parse JSON early so we can allow unauthenticated ping
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // 3) Unauthenticated ping path for quick health checks & debugging
  if (body?.ping === true) {
    return json({ ok: true, model: GEMINI_MODEL });
  }

  // 4) JWT (only for real verification calls)
  if (REQUIRE_JWT) {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Missing bearer token" }, 401);
    }
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // 5) Accept { image } or { frames }
  const step = (body.instruction_step ?? "").toString().trim();
  let image: string | null = null;
  if (isDataUrlImage(body.image)) image = body.image;
  else if (Array.isArray(body.frames)) image = pickBestFrame(body.frames);

  if (!image || !step) {
    return json({ error: "image and instruction_step required" }, 400);
  }

  if (!GEMINI_API_KEY) {
    return json({ error: "Gemini key missing" }, 500);
  }

  // 6) Retry + timeout (handles 429/503)
  const maxAttempts = 3;
  const baseDelay = 350;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 10_000); // 10s per attempt

    try {
      const r = await callGeminiAnalyze(image, step, ctrl.signal);
      clearTimeout(to);

      if (r.ok) {
        return json({ confidence: r.confidence, feedback: r.feedback });
      }

      if (r.status === 429 || r.status === 503) {
        const backoff = baseDelay * attempt;
        await new Promise((res) => setTimeout(res, backoff));
        continue;
      }

      return json({ error: "Gemini error", detail: r.body }, 502);
    } catch (e: any) {
      clearTimeout(to);
      if (e?.name === "AbortError") {
        if (attempt < maxAttempts) {
          const backoff = baseDelay * attempt;
          await new Promise((res) => setTimeout(res, backoff));
          continue;
        }
        return json({ error: "timeout" }, 500);
      }
      return json({ error: "edge-failure", detail: String(e?.message ?? e) }, 500);
    }
  }

  return json({ error: "unavailable" }, 503);
};
