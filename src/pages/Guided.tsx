import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Instruction = {
  id: string;
  title: string;
  content?: string;
  category?: string | null;
  tags?: string[] | null;
  is_public?: boolean | null;
  created_by?: string | null;
  created_at?: string;
};

function dataURLFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  quality = 0.6
): string {
  // Downscale to max 640x480 to keep payloads small & fast
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;
  const maxW = 640;
  const maxH = 480;
  let w = vw, h = vh;
  const scale = Math.min(maxW / w, maxH / h, 1);
  w = Math.max(1, Math.floor(w * scale));
  h = Math.max(1, Math.floor(h * scale));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function Guided() {
  const { id } = useParams<{ id: string }>();
  const [instruction, setInstruction] = useState<Instruction | null>(null);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ confidence: number; feedback: string } | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auth status
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setIsAuthed(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsAuthed(!!session);
    });
    return () => {
      sub.subscription.unsubscribe();
      mounted = false;
    };
  }, []);

  // Load instruction
  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      const { data, error } = await supabase
        .from("instructions")
        .select("*")
        .eq("id", id)
        .single();
      if (!active) return;
      if (error) setErrorMsg(error.message);
      else setInstruction(data as Instruction);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Start camera preview
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e: any) {
        setErrorMsg(e?.message ?? "Camera permission denied.");
      }
    })();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function getAuthHeader(): Promise<Record<string, string>> {
    // For Edge Function with "Verify JWT" on
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Please sign in to verify steps.");
    return { Authorization: `Bearer ${token}` };
  }

  async function callVerify(payload: any) {
    const headers = await getAuthHeader();
    const url =
      import.meta.env.VITE_VERIFY_STEP_FUNCTION_URL ||
      import.meta.env.VITE_SUPABASE_EDGE_VERIFY_URL ||
      "";
    if (!url) throw new Error("Verify function URL not configured.");

    const r = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    if (!r.ok) {
      throw new Error(`verify_step failed: ${r.status} – ${text}`);
    }
    return JSON.parse(text);
  }

  async function verifySingle() {
    if (!instruction) return;
    const video = videoRef.current;
    if (!video) {
      setErrorMsg("Camera not ready.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setResult(null);
    try {
      const canvas = (canvasRef.current ||= document.createElement("canvas"));
      const image = dataURLFromVideoFrame(video, canvas, 0.7);

      const data = await callVerify({
        image,
        instruction_step: instruction.title || "current step",
      });
      setResult({
        confidence: Number(data.confidence || 0),
        feedback: String(data.feedback || ""),
      });
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Verify failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyBurst() {
    if (!instruction) return;
    const video = videoRef.current;
    if (!video) {
      setErrorMsg("Camera not ready.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const canvas = (canvasRef.current ||= document.createElement("canvas"));
      // capture 4 frames over ~600ms
      const frames: string[] = [];
      const captureOnce = () => frames.push(dataURLFromVideoFrame(video, canvas, 0.6));

      captureOnce();
      await new Promise((r) => setTimeout(r, 200));
      captureOnce();
      await new Promise((r) => setTimeout(r, 200));
      captureOnce();
      await new Promise((r) => setTimeout(r, 200));
      captureOnce();

      // choose the "best" frame by data size (proxy for detail)
      const valid = frames.filter(
        (f) => typeof f === "string" && f.startsWith("data:image/") && f.length > 1200
      );
      if (!valid.length) throw new Error("No valid frames captured. Try again in better lighting.");
      const best = valid.sort((a, b) => b.length - a.length)[0];

      const data = await callVerify({
        image: best, // send single best frame to match API
        instruction_step: instruction.title || "current step",
      });
      setResult({
        confidence: Number(data.confidence || 0),
        feedback: String(data.feedback || ""),
      });
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Burst verify failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-white">
      <h1 className="text-xl font-semibold">Guided Mode</h1>
      {instruction ? (
        <div className="text-white/80">
          Following: <span className="font-medium">{instruction.title}</span>
        </div>
      ) : (
        <div className="text-white/60">Loading instruction…</div>
      )}

      {!isAuthed && (
        <div className="text-amber-300">Please sign in to use AI verification.</div>
      )}

      <div className="grid md:grid-cols-[1fr,1fr] gap-4">
        <div>
          <div className="aspect-video bg-black/50 rounded-xl overflow-hidden border border-white/10">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || !isAuthed} onClick={verifySingle}>
              {busy ? "Verifying…" : "Verify (single)"}
            </button>
            <button className="btn btn-outline" disabled={busy || !isAuthed} onClick={verifyBurst}>
              {busy ? "Verifying…" : "Verify (burst)"}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card p-4">
            <h2 className="font-medium mb-2">Result</h2>
            {!result && !errorMsg && (
              <div className="text-white/60">No result yet. Try Verify.</div>
            )}
            {result && (
              <div className="space-y-1">
                <div>
                  Confidence:{" "}
                  <span className="font-mono">
                    {(result.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="text-white/80">{result.feedback}</div>
              </div>
            )}
            {errorMsg && (
              <div className="text-rose-300 whitespace-pre-wrap break-words">
                {errorMsg}
              </div>
            )}
          </div>
          <div className="text-xs text-white/40">
            Tip: ensure good lighting and keep steady during burst capture.
          </div>
        </div>
      </div>
    </div>
  );
}
