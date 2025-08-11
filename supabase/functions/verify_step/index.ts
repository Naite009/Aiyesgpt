// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
// … rest of the file unchanged …


export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const authHeader = req.headers.get("authorization") || "";
    // If you enabled "Verify JWT with legacy secret", we can trust req.headers in supabase functions env.
    // Optionally: validate JWT here if you want stricter checks.

    const body = await req.json().catch(() => ({}));
    if (body.ping) return json({ ok: true });

    const step: string = body.instruction_step || "";
    const image: string | null = typeof body.image === "string" ? body.image : null;
    const frames: string[] | null = Array.isArray(body.frames) ? body.frames : null;

    if (!step) return json({ error: "Missing instruction_step" }, 400);
    if (!image && (!frames || frames.length === 0)) {
      return json({ error: "Provide image or frames[]" }, 400);
    }

    // Build contents for Gemini
    const parts: any[] = [{ text: `Verify whether the user is performing this step: "${step}". 
Return JSON with fields: confidence (0..1) and feedback (1–2 short sentences).` }];

    if (frames && frames.length) {
      for (const f of frames) {
        const { mime, b64 } = splitDataUrl(f);
        parts.push({ inline_data: { mime_type: mime, data: b64 } });
      }
    } else if (image) {
      const { mime, b64 } = splitDataUrl(image);
      parts.push({ inline_data: { mime_type: mime, data: b64 } });
    }

    const gem = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }] }),
      }
    );

    if (!gem.ok) {
      const text = await gem.text();
      console.error("[verify_step] Gemini error", gem.status, text);
      return json({ error: "Gemini error", status: gem.status, detail: text }, 500);
    }

    const out = await gem.json();
    // Try to parse a JSON answer from the model; fall back if needed
    const raw = extractText(out);
    const parsed = safeParseJson(raw);
    const confidence = clamp01(parsed?.confidence ?? parsed?.score ?? 0.5);
    const feedback = (parsed?.feedback as string) || "Checked.";

    return json({ confidence, feedback });
  } catch (e) {
    console.error("[verify_step] exception", e);
    return json({ error: "Unhandled error" }, 500);
  }
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function splitDataUrl(dataUrl: string) {
  if (!dataUrl.startsWith("data:")) throw new Error("Expected data URL");
  const [meta, b64] = dataUrl.split(",", 2);
  const mime = meta.slice(5, meta.indexOf(";"));
  return { mime, b64 };
}

// Extract text from Gemini response
function extractText(resp: any): string {
  try {
    const c = resp.candidates?.[0];
    const parts = c?.content?.parts || [];
    const texts = parts.map((p: any) => p.text).filter(Boolean);
    return texts.join("\n");
  } catch { return ""; }
}

function safeParseJson(s: string | undefined) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
