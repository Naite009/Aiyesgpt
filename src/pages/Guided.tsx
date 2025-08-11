import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { parseStepsFromMarkdown } from "@/services/ai"; // if you had this util here; otherwise implement a simple parser below
import { verifyStepImage, verifyStepBurst } from "@/services/ai";

type Instruction = { id: string; title: string; content: string };
type LessonMin = { id: string; title: string; video_url: string | null; video_path: string | null; created_at: string };

export default function Guided() {
  const { id } = useParams<{ id: string }>();
  const { notify } = useToast();

  const [ins, setIns] = useState<Instruction | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  // lesson watch
  const [lesson, setLesson] = useState<LessonMin | null>(null);
  const [lessonUrl, setLessonUrl] = useState<string | null>(null);
  const [showLesson, setShowLesson] = useState(false);

  // camera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Load instruction + steps
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("instructions")
        .select("id,title,content")
        .eq("id", id)
        .single();
      if (!active) return;
      if (error || !data) {
        notify({ tone: "error", title: "Not found", message: "Instruction not found." });
        return;
      }
      const insRow = data as Instruction;
      setIns(insRow);
      const parsed = parseStepsFromMarkdown
        ? parseStepsFromMarkdown(insRow.content) || []
        : simpleParseSteps(insRow.content);
      setSteps(parsed);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load latest lesson linked
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("id,title,video_url,video_path,created_at")
        .eq("instruction_id", id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!active) return;
      if (!error && data && data.length) setLesson(data[0] as LessonMin);
    })();
    return () => { active = false; };
  }, [id]);

  // Sign lesson video if private
  useEffect(() => {
    (async () => {
      if (!lesson) return setLessonUrl(null);
      if (lesson.video_path) {
        const { data } = await supabase.storage.from("lessons").createSignedUrl(lesson.video_path, 3600);
        setLessonUrl(data?.signedUrl ?? null);
      } else {
        setLessonUrl(lesson.video_url);
      }
    })();
  }, [lesson]);

  // Camera setup
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!mounted) return;
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(() => {});
        }
      } catch (e) {
        console.warn("camera error", e);
      }
    })();
    return () => {
      mounted = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = steps[idx] ?? "";
  const canPrev = idx > 0;
  const canNext = idx < steps.length - 1;

  async function captureFrameBase64(mime = "image/jpeg", quality = 0.92) {
    if (!videoRef.current) throw new Error("No camera");
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    ctx.drawImage(video, 0, 0, w, h);
    return canvas.toDataURL(mime, quality);
  }

  async function captureBurst(n = 10, gapMs = 120) {
    const frames: string[] = [];
    for (let k = 0; k < n; k++) {
      const img = await captureFrameBase64();
      frames.push(img);
      if (k < n - 1) await new Promise((r) => setTimeout(r, gapMs));
    }
    return frames;
  }

  async function verifySingle() {
    try {
      setBusy(true);
      const img = await captureFrameBase64();
      const r = await verifyStepImage({ imageBase64: img, stepText: step });
      notify({
        tone: r.confidence >= 0.75 ? "success" : r.confidence >= 0.5 ? "info" : "error",
        title: `Confidence ${(r.confidence * 100).toFixed(0)}%`,
        message: r.feedback || "Checked.",
      });
      if (r.confidence >= 0.85 && canNext) setIdx((x) => x + 1);
    } catch (e: any) {
      notify({ tone: "error", title: "Verify failed", message: e?.message ?? "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  async function verifyBurstClick() {
    try {
      setBusy(true);
      const frames = await captureBurst(10, 120);
      const r = await verifyStepBurst({ frames, stepText: step });
      notify({
        tone: r.confidence >= 0.75 ? "success" : r.confidence >= 0.5 ? "info" : "error",
        title: `Confidence ${(r.confidence * 100).toFixed(0)}%`,
        message: r.feedback || "Checked.",
      });
      if (r.confidence >= 0.85 && canNext) setIdx((x) => x + 1);
    } catch (e: any) {
      notify({ tone: "error", title: "Verify failed", message: e?.message ?? "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  function speakStep() {
    try {
      if (!("speechSynthesis" in window)) return notify({ tone: "error", message: "TTS not supported in this browser" });
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(step || "No step selected");
      u.rate = 1; u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch {}
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{ins?.title ?? "Guided Mode"}</h1>
        {lessonUrl && (
          <button className="btn btn-outline" onClick={() => setShowLesson(true)}>
            Watch Lesson
          </button>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="card p-4 text-white/70">No steps found in this instruction.</div>
      ) : (
        <>
          <div className="card p-4 grid gap-3">
            <div className="text-sm text-white/60">Step {idx + 1} of {steps.length}</div>
            <div className="text-lg">{step}</div>

            <div className="flex flex-wrap gap-2">
              <button className="btn btn-outline" disabled={!canPrev} onClick={() => setIdx((x) => x - 1)}>‹ Prev</button>
              <button className="btn btn-outline" disabled={!canNext} onClick={() => setIdx((x) => x + 1)}>Next ›</button>
              <button className="btn btn-outline" onClick={speakStep}>Speak step</button>
              <button className="btn btn-primary" onClick={verifySingle} disabled={busy}>
                {busy ? "Verifying…" : "Verify (single)"}
              </button>
              <button className="btn btn-outline" onClick={verifyBurstClick} disabled={busy}>
                Verify (burst)
              </button>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-sm text-white/70">Camera</div>
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black aspect-video" />
          </div>
        </>
      )}

      {/* Watch Lesson modal */}
      {showLesson && (
        <div className="modal-backdrop" onClick={() => setShowLesson(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-white/70">{lesson?.title ?? "Lesson"}</div>
              <button className="btn btn-outline" onClick={() => setShowLesson(false)}>Close</button>
            </div>
            {lessonUrl ? (
              <video src={lessonUrl} controls autoPlay className="w-full rounded-lg bg-black aspect-video" />
            ) : (
              <div className="p-6 text-white/70">No lesson video available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Fallback tiny parser if you don't have parseStepsFromMarkdown implemented:
function simpleParseSteps(md: string): string[] {
  const lines = md.split(/\r?\n/).map((l) => l.trim());
  const steps: string[] = [];
  for (const l of lines) {
    if (/^[-*]\s+/.test(l)) steps.push(l.replace(/^[-*]\s+/, ""));
    else if (/^\d+\.\s+/.test(l)) steps.push(l.replace(/^\d+\.\s+/, ""));
  }
  return steps.length ? steps : [md];
}
