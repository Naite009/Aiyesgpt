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

export default function Studio() {
  const cap = useScreenCapture();
  const { notify } = useToast();

  const [mode, setMode] = useState<"screen" | "camera">("screen");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // NEW: attach to instruction
  const [myInstructions, setMyInstructions] = useState<InstructionRow[]>([]);
  const [attachTo, setAttachTo] = useState<string>(""); // instruction_id or ""

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Preview the recorded blob
  useEffect(() => {
    if (!videoRef.current) return;
    if (!cap.blob) {
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
      return;
    }
    const url = URL.createObjectURL(cap.blob);
    videoRef.current.src = url;
    videoRef.current.onloadeddata = () => videoRef.current?.play().catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, [cap.blob]);

  // Load the current user's instructions for the dropdown
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setMyInstructions([]);
      const { data, error } = await supabase
        .from("instructions")
        .select("id,title,created_by,is_public,created_at")
        .or(`is_public.eq.true,created_by.eq.${user.id}`) // show your own + public
        .order("created_at", { ascending: false })
        .limit(1000);
      if (!active) return;
      if (error) {
        console.error("[studio] load instructions error", error);
        return;
      }
      setMyInstructions((data ?? []) as InstructionRow[]);
    })();
    return () => { active = false; };
  }, []);

  // Thumbnail from first frame
  async function extractThumbnail(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(blob);
      v.src = url; v.muted = true; v.playsInline = true;
      v.onloadeddata = () => { try { v.currentTime = Math.min(0.25, (v.duration || 1) * 0.05); } catch {} };
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
      setJustSaved(false);
      if (!cap.blob) return notify({ tone: "error", message: "Record something first." });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return notify({ tone: "error", message: "Please sign in first." });
      if (!title.trim()) return notify({ tone: "error", message: "Please enter a title." });

      setSaving(true);

      // Build private storage paths
      const fileId = uuidv4();
      const videoPath = `${user.id}/${fileId}.webm`;
      const thumbPath = `${user.id}/${fileId}.png`;

      // Upload video (PRIVATE bucket)
      const { error: upErr } = await supabase.storage.from("lessons")
        .upload(videoPath, cap.blob, { contentType: cap.blob.type || "video/webm", upsert: false });
      if (upErr) throw upErr;

      // Upload thumbnail
      const thumb = await extractThumbnail(cap.blob);
      const { error: thErr } = await supabase.storage.from("lessons")
        .upload(thumbPath, thumb, { contentType: "image/png", upsert: false });
      if (thErr) throw thErr;

      // Duration
      const duration = await getAccurateDuration(cap.blob);

      // Insert DB row (store PATHS + optional instruction attachment)
      const { error: dbErr } = await supabase.from("lessons").insert({
        title: title.trim(),
        description: description.trim() || null,
        duration,
        video_path: videoPath,
        thumbnail_path: thumbPath,
        video_url: null,        // legacy fields unused now
        thumbnail_url: null,
        created_by: user.id,
        instruction_id: attachTo || null,
      });
      if (dbErr) throw dbErr;

      notify({
        tone: "success",
        title: "Saved",
        message: attachTo ? "Lesson uploaded and linked. View it in Lessons or try the instruction." : "Lesson uploaded (private). View it in Lessons.",
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
        {/* Controls row (includes Go to Lessons) */}
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
            <button className="btn btn-primary" onClick={() => cap.start(mode)}>Start recording</button>
          ) : (
            <button className="btn btn-outline" onClick={cap.stop}>Stop & preview</button>
          )}

          {cap.blob && <button className="btn btn-outline" onClick={cap.reset}>Discard</button>}

          {/* Always-visible link */}
          <Link to="/lessons" className="btn btn-outline">Go to Lessons</Link>
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
            >
              <option value="">— None —</option>
              {myInstructions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
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

        {/* Preview */}
        <div className="grid gap-2">
          <div className="text-sm text-white/70">Preview</div>
          <video ref={videoRef} controls className="w-full rounded-xl bg-black aspect-video" />
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
              <Link to="/lessons" className="btn btn-primary">View in Lessons</Link>
              {attachTo && <Link to={`/guided/${attachTo}`} className="btn btn-outline">Try Attached Instruction</Link>}
            </>
          )}
        </div>
      </div>

      <div className="text-sm text-white/60">
        Tip: choose <b>Screen</b> to record code walkthroughs (e.g., highlight <code>PUT_API_KEY_HERE</code>,
        paste your key, save). Attach it to an instruction so learners can click <b>Try This</b> from the Lessons page.
      </div>
    </div>
  );
}
