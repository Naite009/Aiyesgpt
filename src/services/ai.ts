import { supabase } from "@/lib/supabase";

const VERIFY_URL =
  import.meta.env.VITE_VERIFY_STEP_FUNCTION_URL ||
  import.meta.env.VITE_SUPABASE_EDGE_VERIFY_URL ||
  "";

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
  if (!r.ok) throw new Error(`verify_step failed: ${r.status}`);
  return r.json();
}

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
  if (!r.ok) throw new Error(`verify_step failed: ${r.status}`);
  return r.json();
}

async function buildAuthHeaders(): Promise<Headers> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return headers;
}
