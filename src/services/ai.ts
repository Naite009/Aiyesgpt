import { supabase } from "@/lib/supabase";

export async function verifyStepImage(opts: { imageBase64: string; stepText: string; userAction?: string }) {
  const url = import.meta.env.VITE_VERIFY_STEP_FUNCTION_URL || "/functions/v1/verify_step";

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("You must sign in to verify steps.");
  }

  const accessToken = session.access_token;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`, // ✅ send user JWT
      "apikey": anon,
    },
    body: JSON.stringify({
      image: opts.imageBase64,
      instruction_step: opts.stepText,
      user_action: opts.userAction
    }),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    console.error("[verify_step] status", res.status, text);
    throw new Error(`verify_step failed: ${res.status}`);
  }
  try {
    return JSON.parse(text) as { confidence: number; feedback: string };
  } catch {
    console.error("[verify_step] bad JSON:", text);
    throw new Error("verify_step returned invalid JSON");
  }
}

export function parseStepsFromMarkdown(md: string): string[] {
  return md
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /^[-*]|^\d+\./.test(l))
    .map((l) => l.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, ""));
}
