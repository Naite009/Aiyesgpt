// src/services/ai.ts
const VERIFY_URL = (import.meta.env.VITE_VERIFY_STEP_FUNCTION_URL as string | undefined)?.trim();

type VerifyResponse = {
  confidence?: number;
  feedback?: string;
  error?: string;
  detail?: string;
  [k: string]: any;
};

function assertUrl(): string {
  if (!VERIFY_URL) {
    throw new Error(
      "[ai.verify] Missing VITE_VERIFY_STEP_FUNCTION_URL. Set it in Vercel → Project → Environment Variables."
    );
  }
  return VERIFY_URL;
}

async function postJSON(
  body: unknown,
  timeoutMs = 12000
): Promise<{ obj: VerifyResponse; status: number }> {
  const url = assertUrl();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const status = r.status;

    let obj: VerifyResponse;
    try {
      obj = (await r.json()) as VerifyResponse;
    } catch {
      const text = await r.text().catch(() => "");
      obj = { error: text || "non-json-response" };
    }
    return { obj, status };
  } finally {
    clearTimeout(t);
  }
}

export async function verifySingle(imageDataUrl: string, step: string) {
  if (!imageDataUrl?.startsWith("data:image/")) {
    throw new Error("[ai.verify] image missing/invalid data URL");
  }
  if (!step?.trim()) {
    throw new Error("[ai.verify] instruction_step is required");
  }
  const { obj, status } = await postJSON({ image: imageDataUrl, instruction_step: step });
  return { ...obj, status };
}

export async function verifyBurst(frames: string[], step: string) {
  const valid = Array.isArray(frames)
    ? frames.filter((f) => typeof f === "string" && f.startsWith("data:image/"))
    : [];
  if (!valid.length) {
    throw new Error("[ai.verifyBurst] frames[] is empty or invalid");
  }
  if (!step?.trim()) {
    throw new Error("[ai.verifyBurst] instruction_step is required");
  }
  const { obj, status } = await postJSON({ frames: valid, instruction_step: step });
  return { ...obj, status };
}

export async function verifyPing() {
  const { obj, status } = await postJSON({ ping: true });
  return { ...obj, status };
}
