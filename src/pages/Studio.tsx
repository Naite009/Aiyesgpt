import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useToast } from "@/components/ToastProvider";
import { supabase } from "@/lib/supabase";

type InstructionRow = {
  id: string;
  title: string;
  created_by: string | null;
  is_public: boolean;
  created_at: string;
};

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export default function Studio() {
  const cap = useScreenCapture();
  const { notify } = useToast();

  const [mode, setMode] = useState<"screen" | "camera">("screen");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Attach to instruction
  const [myInstructions, setMyInstructions] = useState<InstructionRow[]>([]);
  const [attachTo, setAttachTo] = useState<string>(""); // instruction_id or ""
  const [loadingIns, setLoadingIns] = useState(true);

  const liveRef = useRef<HTMLVideoElement | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);

  // Load instructions (yours + public if signed in, else public only)
  useEffect(() => {
    let active = true;
    (async () => {
      setLoadingIns(true);
      const { data: { user } } = await supabase.auth.getUser();
      const q = supabase
        .from("instructions")
        .select("id,title,created_by,is_public,created_at")
        .order("created_at", { ascending: false })
        .limit(1000);

      const { data, error } = user
        ? await q.or(`is_public.eq.true,created_by.eq.${user.id}`)
        : await q.eq("is_public", true);

      if (!active) return;
      if (error) {
        console.error("[studio] load instructions error", error);
        setMyInstructions([]);
      } else {
        setMyInstructions((data ?? []) as InstructionRow[]);
      }
      setLoadingIns(false);
    })();
    return () => { active = false; };
  }, []);

  // Bind LIVE stream to liveRef while recording
  useEffect(() => {
    if (!liveRef.current) return;
    if (cap.recording && cap.stream) {
      try {
        liveRef.current.srcObject = cap.stream;
        liveRef.current.onloadedmetadata = () => liveRef.current?.play().catch(() => {});
      } catch (e) {
        console.warn("live preview bind error", e);
      }
    } else {
      if (liveRef.current) {
        try { (liveRef.current as any).srcObject = null; } catch {}
      }
    }
  }, [cap.recording, cap.stream]);

  // Bind BLOB preview after stop
  useEffect(() => {
    if (!previewRef.current) return;
    if (!cap.blob) {
      previewRef.current.removeAttribute("src");
      previewRef.current.load();
      return;
    }
    const url = URL.createObjectURL(cap.blob);
    previewRef.current.src = url;
    previewRef.current.onloadeddata = () => previewRef.current?.play().catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, [cap.blob]);

  // Thumbnail from first frame
  async function extractThumbnail(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(blob);
      v.src = url; v.muted = true; v.playsInline = true;
      v.onloadeddata = () => { try { v.currentTime = Math.min(0.25, (v.duration || 1) * 0.05); } catch {} };
      v.onseeked = () => {
        const canvas = document.createElement("canvas");
        const w = v.videoWidth || 1280;
        const h = v.videoHeight || 720;
        canvas.width = 640;
        canvas.height = Math.round((h / w) * 640) || 360;
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
      setJustSaved(false);
      if (!cap.blob) return notify({ tone: "error", message: "Record something first." });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return notify({ tone: "error", message: "Please sign in first." });
      if (!title.trim()) return notify({ tone: "error", message: "Please enter a title." });

      setSaving(true);

      const fileId = uuidv4();
      const ext = ".webm";
      const videoPath = `${user.id}/${fileId}${ext}`;
      const thumbPath = `${user.id}/${fileId}.png`;

      const { error: upErr } = await supabase.storage.from("lessons")
        .upload(videoPath, cap.blob, { contentType: cap.blob.type || "video/webm", upsert: false });
      if (upErr) throw upErr;

      const thumb = await extractThumbnail(cap.blob);
      const { error: thErr } = await supabase.storage.from("lessons")
        .upload(thumbPath, thumb, { contentType: "image/png", upsert: false });
      if (thErr) throw thErr;

      const duration = await getAccurateDuration(cap.blob);

      const { error: dbErr } = await supabase.from("lessons").insert({
        title: title.trim(),
        description: description.trim() || null,
        duration,
        video_path: videoPath,
        thumbnail_path: thumbPath,
        video_url: null,
        thumbnail_url: null,
        created_by: user.id,
        instruction_id: attachTo || null,
      });
      if (dbErr) throw dbErr;

      notify({
        tone: "success",
        title: "Saved",
        message: attachTo
          ? "Lesson uploaded and linked. View it in Lessons or try the instruction."
          : "Lesson uploaded (private). View it in Lessons.",
      });
      cap.reset();
      setTitle(""); setDescription("");
      setJustSaved(true);
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
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2">
          <label className={`btn ${mode === "screen" ? "btn-primary" : "btn-outline"}`}>
            <input type="radio" className="hidden" checked={mode === "screen"} onChange={() => setMode("screen")} />
            Screen
          </label>
          <label className={`btn ${mode === "camera" ? "btn-primary" : "btn-outline"}`}>
            <input type="radio" className="hidden" checked={mode === "camera"} onChange={() => setMode("camera")} />
            Camera
          </label>

          {!cap.recording ? (
            <button className="btn btn-primary" onClick={() => cap.start(mode)}>
              Start recording
            </button>
          ) : (
            <button className="btn btn-outline" onClick={cap.stop}>Stop & preview</button>
          )}

          {cap.blob && (
            <button className="btn btn-danger" onClick={cap.reset}>Discard</button>
          )}

          <Link to="/lessons" className="btn btn-success">Go to Lessons</Link>
        </div>

        {/* Metadata + Attach */}
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
            <span className="text-sm text-white/70">Attach to Instruction (optional)</span>
            <select
              className="input"
              value={attachTo}
              onChange={(e) => setAttachTo(e.target.value)}
              disabled={loadingIns || myInstructions.length === 0}
            >
              <option value="">{loadingIns ? "Loading…" : "— None —"}</option>
              {myInstructions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
            {!loadingIns && myInstructions.length === 0 && (
              <div className="text-xs text-white/60 mt-1">
                No instructions found. Create one in <Link to="/create" className="underline">Create</Link>, or make an existing instruction public.
              </div>
            )}
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm text-white/70">Description</span>
            <input
              className="input"
              placeholder="What this lesson covers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>

        {/* Live preview while recording */}
        {cap.recording && cap.stream && (
          <div className="grid gap-2">
            <div className="text-sm text-white/70">Live preview</div>
            <video ref={liveRef} muted playsInline autoPlay className="w-full rounded-xl bg-black aspect-video" />
          </div>
        )}

        {/* Saved blob preview after stop */}
        <div className="grid gap-2">
          <div className="text-sm text-white/70">Preview</div>
          <video
            ref={previewRef}
            controls
            playsInline
            className="w-full rounded-xl bg-black aspect-video"
            aria-label="Recording preview"
          />
          {isIOS() && (
            <div className="text-xs text-white/60">
              Heads up: iPhone Safari may not preview WebM. Your recording will still upload and play on desktop.
            </div>
          )}
        </div>

        {/* Actions */}
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
          {justSaved && (
            <>
              <Link to="/lessons" className="btn btn-success">View in Lessons</Link>
              {attachTo && <Link to={`/guided/${attachTo}`} className="btn btn-outline">Try Attached Instruction</Link>}
            </>
          )}
        </div>
      </div>

      <div className="text-sm text-white/60">
        Tip: choose <b>Screen</b> to record code walkthroughs (e.g., highlight <code>PUT_API_KEY_HERE</code>,
        paste your key, save). Attach it so learners get a <b>Try This</b> button in Lessons.
      </div>
    </div>
  );
}
