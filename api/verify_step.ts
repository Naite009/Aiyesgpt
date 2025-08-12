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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  if (body?.ping === true) return json({ ok: true, model: "edge-stub" });

  if (body?.mockVerify === true) {
    const c = typeof body.mockConfidence === "number" ? body.mockConfidence : 0.9;
    const f = body.mockFeedback ?? "Mock verification OK.";
    return json({ confidence: c, feedback: f });
  }

  return json({ ok: true, note: "Real Gemini call not yet wired" });
}
