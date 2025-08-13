// src/pages/Guided.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { verifySingle, verifyBurst, verifyPing } from "@/services/ai";
import { supabase } from "@/lib/supabase";

type Instruction = {
  id: string;
  title: string;
  content?: string | null;
};

function useInstruction(id?: string) {
  const [data, setData] = useState<Instruction | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!id) return;
      setLoading(true);
      setErr(null);
      const { data: row, error } = await supabase
        .from("instructions")
        .select("*")
        .eq("id", id)
        .single();
      if (!alive) return;
      if (error) setErr(error.message || String(error));
      setData(row ?? null);
      setLoading(false);
    }
    run();
    return () => {
      alive = false;
    };
  }, [id]);

  return { data, loading, err };
}

function dataUrlFromVideo(video: HTMLVideoElement): string | null {
  const canvas = document.createElement("canvas");
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function Guided() {
  const { id } = useParams<{ id: string }>();
  const { data: instruction, loading: loadingInstruction, err: instructionErr } = useInstruction(id);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [busy, setBusy] = useState(false);
  const [lastStatus, setLastStatus] = useState<number | null>(null);
  const [result, setResult] = useState<{
    confidence?: number;
    feedback?: string;
    raw?: any;
  } | null>(null);

  const [showDebug, setShowDebug] = useState(false);
  const [envUrl, setEnvUrl] = useState<string | null>(null);
  const [signedEmail, setSignedEmail] = useState<string | null>(null);

  const stepText = useMemo(() => {
    const raw = instruction?.content ?? "";
    const lines = raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines[0] ?? instruction?.title ?? "Follow the instruction";
  }, [instruction]);

  useEffect(() => {
    setEnvUrl((import.meta.env.VITE_VERIFY_STEP_FUNCTION_URL as string | undefined) ?? null);
    supabase.auth.getSession().then(({ data }) => {
      setSignedEmail(data.session?.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    let alive = true;
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (!alive) return;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.error("[guided] camera failed", e);
      }
    }
    start();
    return () => {
      alive = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doPing() {
    try {
      setBusy(true);
      const r = await verifyPing();
      setLastStatus(r.status ?? null);
      setResult({
        raw: r,
        confidence: typeof r.confidence === "number" ? r.confidence : undefined,
        feedback: r.feedback,
      });
    } catch (e: any) {
      setResult({ raw: { error: String(e?.message ?? e) } });
    } finally {
      setBusy(false);
    }
  }

  async function doVerifySingle() {
    const vid = videoRef.current;
    const img = vid ? dataUrlFromVideo(vid) : null;
    if (!img) {
      setResult({
        raw: { error: "no-frame" },
        feedback: "Could not capture a frame from camera.",
      });
      return;
    }
    try {
      setBusy(true);
      const r = await verifySingle(img, stepText);
      setLastStatus(r.status ?? null);
      setResult({
        raw: r,
        confidence:
          typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : undefined,
        feedback: r.feedback,
      });
    } catch (e: any) {
      setResult({ raw: { error: String(e?.message ?? e) } });
    } finally {
      setBusy(false);
    }
  }

  async function doVerifyBurst() {
    const vid = videoRef.current;
    if (!vid) {
      setResult({
        raw: { error: "no-video" },
        feedback: "Camera not ready.",
      });
      return;
    }
    const frames: string[] = [];
    for (let i = 0; i < 6; i++) {
      const f = dataUrlFromVideo(vid);
      if (f) frames.push(f);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!frames.length) {
      setResult({
        raw: { error: "no-frames" },
        feedback: "Could not capture frames.",
      });
      return;
    }
    try {
      setBusy(true);
      const r = await verifyBurst(frames, stepText);
      setLastStatus(r.status ?? null);
      setResult({
        raw: r,
        confidence:
          typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : undefined,
        feedback: r.feedback,
      });
    } catch (e: any) {
      setResult({ raw: { error: String(e?.message ?? e) } });
    } finally {
      setBusy(false);
    }
  }

  const confidencePct =
    typeof result?.confidence === "number"
      ? Math.round(Math.max(0, Math.min(1, result.confidence)) * 100)
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Guided Mode</h1>

      {loadingInstruction ? (
        <p>Loading instruction…</p>
      ) : instructionErr ? (
        <p className="text-red-600">Failed to load instruction: {instructionErr}</p>
      ) : instruction ? (
        <div className="space-y-2">
          <div className="text-lg font-medium">{instruction.title}</div>
          {stepText && <div className="text-sm opacity-80">Current step: {stepText}</div>}
        </div>
      ) : (
        <p className="text-red-600">Instruction not found.</p>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full rounded-xl bg-black aspect-video object-cover"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              onClick={doVerifySingle}
              disabled={busy}
            >
              {busy ? "Verifying…" : "Verify (single)"}
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
              onClick={doVerifyBurst}
              disabled={busy}
            >
              {busy ? "Verifying…" : "Verify (burst)"}
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-slate-700 text-white disabled:opacity-50"
              onClick={() => setShowDebug((v) => !v)}
              disabled={busy}
            >
              {showDebug ? "Hide debug" : "Show debug"}
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-slate-500 text-white disabled:opacity-50"
              onClick={doPing}
              disabled={busy}
            >
              Ping API
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-xl border">
            <div className="text-sm font-semibold mb-2">Result</div>
            {confidencePct !== null ? (
              <div className="text-lg">Confidence: {confidencePct}%</div>
            ) : (
              <div className="text-lg">No result yet. Try Verify.</div>
            )}
            {result?.feedback && (
              <div className="mt-2 text-sm opacity-80">{result.feedback}</div>
            )}
            {result?.raw?.error && (
              <div className="mt-2 text-sm text-red-600">
                Error: {String(result.raw.error)}
              </div>
            )}
          </div>

          {showDebug && (
            <div className="p-4 rounded-xl border">
              <div className="text-sm font-semibold mb-2">Debug</div>
              <div className="text-xs space-y-1">
                <div>Signed in: {signedEmail ? "yes" : "no"}</div>
                <div>Email: {signedEmail ?? "—"}</div>
                <div>Function URL present: {envUrl ? "yes" : "no"}</div>
                <div>Function URL: {envUrl ?? "—"}</div>
                <div>Last HTTP status: {lastStatus ?? 0}</div>
                <div className="mt-2">Raw JSON:</div>
                <pre className="bg-slate-900 text-slate-100 p-2 rounded overflow-auto max-h-64">
                  {JSON.stringify(result?.raw ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
