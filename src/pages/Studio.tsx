import { useEffect, useMemo, useRef, useState } from "react";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useToast } from "@/components/ToastProvider";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export default function Studio() {
  const cap = useScreenCapture();
  const { notify } = useToast();

  const [mode, setMode] = useState<"screen" | "camera">("screen");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Attach blob to video preview when it changes
  useEffect(() => {
    if (!videoRef.current) return;
    if (!cap.blob) {
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
      return;
    }
    const url = URL.createObjectURL(cap.blob);
    videoRef.current.src = url;
    videoRef.current.onloadeddata = () => {
      videoRef.current?.play().catch(() => {});
    };
    return () => URL.revokeObjectURL(url);
  }, [cap.blob]);

  const durationSec = useMemo(async () => {
    if (!cap.blob) return 0;
    try {
      const tmpVideo = document.createElement("video");
      tmpVideo.src = URL.createObjectURL(cap.blob);
      await tmpVideo.play().catch(() => {});
      const dur = tmpVideo.duration;
      URL.revokeObjectURL(tmpVideo.src);
      return Number.isFinite(dur) ? Math.round(dur) : 0;
    } catch {
      return 0;
    }
  }, [cap.blob]) as unknown as number; // acceptable approximation (we recompute on save too)

  async function extractThumbnail(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(blob);
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      v.onloadeddata = async () => {
        try {
          v.currentTime = Math.min(0.25, (v.duration || 1) * 0.05);
        } catch {}
      };
      v.onseeked = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = Math.round((v.videoHeight / v.videoWidth) * 640) || 360;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); return reject(new Error("no canvas")); }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => {
          URL.revokeObjectURL(url);
          if (!b) return reject(new Error("thumb blob failed"));
          resolve(b);
        }, "image/png", 0.9);
      };
      v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("video load error")); };
    });
  }

  async function getAccurateDuration(blob: Blob): Promise<number> {
    return new Promise((resolve) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(blob);
      v.src = url;
      v.onloadedmetadata = () => {
        const d = v.duration;
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(d) ? Math.round(d) : 0);
      };
      v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    });
  }

  async function onSave() {
    try {
      if (!cap.blob) {
        notify({ tone: "error", message: "Record something first." });
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        notify({ tone: "error", message: "Please sign in first." });
        return;
      }
      if (!title.trim()) {
        notify({ tone: "error", message: "Please enter a title." });
        return;
      }

      setSaving(true);

      // Ensure bucket exists: create a bucket named "lessons" in Supabase Storage (once)
      const fileId = uuidv4();
      const videoPath = `${user.id}/${fileId}.webm`;
      const thumbPath = `${user.id}/${fileId}.png`;

      // Upload video
      const { error: upErr } = await supabase
        .storage
        .from("lessons")
        .upload(videoPath, cap.blob, { contentType: cap.blob.type || "video/webm", upsert: false });

      if (upErr) throw upErr;

      // Thumbnail
      const thumb = await extractThumbnail(cap.blob);
      const { error: thErr } = await supabase
        .storage
        .from("lessons")
        .upload(thumbPath, thumb, { contentType: "image/png", upsert: false });

      if (thErr) throw thErr;

      // Public URLs (make the bucket public, or switch to signed URLs)
      const { data: vpub } = supabase.storage.from("lessons").getPublicUrl(videoPath);
      const { data: tpub } = supabase.storage.from("lessons").getPublicUrl(thumbPath);
      const video_url = vpub.publicUrl;
      const thumbnail_url = tpub.publicUrl;

      // Duration
      const duration = await getAccurateDuration(cap.blob);

      // Insert row
      const { error: dbErr } = await supabase.from("lessons").insert({
        title: title.trim(),
        description: description.trim() || null,
        duration,
        video_url,
        thumbnail_url,
        created_by: user.id,
        instruction_id: null,
      });
      if (dbErr) throw dbErr;

      notify({ tone: "success", title: "Saved", message: "Lesson uploaded." });
      cap.reset();
      setTitle("");
      setDescription("");
    } catch (e: any) {
      console.error("[studio] save error", e);
      notify({ tone: "error", title: "Save failed", message: e.message ?? "Unknown error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Lesson Studio</h1>

      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className={`btn ${mode === "screen" ? "btn-primary" : "btn-outline"}`}>
            <input
              type="radio"
              className="hidden"
              checked={mode === "screen"}
              onChange={() => setMode("screen")}
            />
            Screen
          </label>
          <label className={`btn ${mode === "camera" ? "btn-primary" : "btn-outline"}`}>
            <input
              type="radio"
              className="hidden"
              checked={mode === "camera"}
              onChange={() => setMode("camera")}
            />
            Camera
          </label>

          {!cap.recording ? (
            <button className="btn btn-primary" onClick={() => cap.start(mode)}>
              Start recording
            </button>
          ) : (
            <button className="btn btn-outline" onClick={cap.stop}>
              Stop & preview
            </button>
          )}

          {cap.blob && (
            <button className="btn btn-outline" onClick={cap.reset}>
              Discard
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm text-white/70">Lesson title *</span>
            <input
              className="input"
              placeholder="e.g., Paste API key into .env"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-white/70">Description</span>
            <input
              className="input"
              placeholder="What this lesson covers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-2">
          <div className="text-sm text-white/70">Preview</div>
          <video ref={videoRef} controls className="w-full rounded-xl bg-black aspect-video" />
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={onSave} disabled={saving || !cap.blob}>
            {saving ? "Saving…" : "Save lesson"}
          </button>
          {cap.blob && (
            <a
              className="btn btn-outline"
              href={URL.createObjectURL(cap.blob)}
              download={`${(title || "lesson").replace(/\s+/g, "_")}.webm`}
            >
              Download
            </a>
          )}
        </div>
      </div>

      <div className="text-sm text-white/60">
        Tip: choose <b>Screen</b> to record code walkthroughs (e.g., highlight <code>PUT_API_KEY_HERE</code>,
        paste your key, save). Later we can attach this lesson to an instruction and auto-generate a
        “practical” test that nudges learners with TTS.
      </div>
    </div>
  );
}
