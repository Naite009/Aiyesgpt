// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  try {
    const { image, instruction_step, user_action } = await req.json();
    if (!image || !instruction_step) return json({ error: "image and instruction_step required" }, 400);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "Missing GEMINI_API_KEY" }, 500);

    const geminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `You are verifying whether the user performed this step correctly: "${instruction_step}". Provide a confidence [0..1] and brief feedback.` },
            { inline_data: { mime_type: "image/jpeg", data: image.split(",")[1] } }
          ]
        }]
      })
    });

    if (!geminiRes.ok) {
      const t = await geminiRes.text();
      return json({ error: "Gemini error", detail: t }, 500);
    }
    const payload = await geminiRes.json();

    const feedback = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No feedback";
    const confidence = /([0-1](?:\.\d+)?)/.exec(feedback)?.[1];
    const conf = Math.max(0, Math.min(1, Number(confidence) || 0.6));

    return json({ confidence: conf, feedback });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
