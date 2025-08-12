import { supabase } from "@/lib/supabase";

/** ========= VERIFY ENDPOINT ========= **/
const VERIFY_URL =
  import.meta.env.VITE_VERIFY_STEP_FUNCTION_URL ||
  import.meta.env.VITE_SUPABASE_EDGE_VERIFY_URL ||
  "";

/** Build auth headers for RLS-protected functions */
async function buildAuthHeaders(): Promise<Headers> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return headers;
}

/** Single-image verify */
export async function verifyStepImage({
  imageBase64,
  stepText,
}: {
  imageBase64: string;
  stepText: string;
}) {
  const headers = await buildAuthHeaders();
  const r = await fetch(VERIFY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ image: imageBase64, instruction_step: stepText }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`verify_step failed: ${r.status}${t ? ` – ${t}` : ""}`);
  }
  return r.json();
}

/** Multi-frame (burst) verify */
export async function verifyStepBurst({
  frames,
  stepText,
}: {
  frames: string[];
  stepText: string;
}) {
  const headers = await buildAuthHeaders();
  const r = await fetch(VERIFY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ frames, instruction_step: stepText }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`verify_step failed: ${r.status}${t ? ` – ${t}` : ""}`);
  }
  return r.json();
}

/** Exported helper some pages import */
export function parseStepsFromMarkdown(md: string): string[] {
  const lines = md.split(/\r?\n/).map((l) => l.trim());
  const steps: string[] = [];
  for (const l of lines) {
    if (/^[-*]\s+/.test(l)) steps.push(l.replace(/^[-*]\s+/, ""));
    else if (/^\d+\.\s+/.test(l)) steps.push(l.replace(/^\d+\.\s+/, ""));
  }
  return steps.length ? steps : [md].filter(Boolean);
}
