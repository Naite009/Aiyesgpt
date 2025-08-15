import { useEffect, useMemo, useRef, useState } from "react";
import { useScreenShare } from "@/hooks/useScreenShare";
import supabase from "@/lib/supabase";

type RecordedEvent = import("@/hooks/useScreenShare").RecordedEvent;

type Instruction = {
  id: string;
  title: string;
};

export default function Studio() {
  const s = useScreenShare();
  const [saving, setSaving] = useState(false);
  const [scriptName, setScriptName] = useState("My Lesson Script");
  const [desc, setDesc] = useState("");
  const [attachInstructionId, setAttachInstructionId] = useState<string | "">("");
  const [myInstructions, setMyInstructions] = useState<Instruction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const dlRef = useRef<HTMLAnchorElement | null>(null);

  // Load my own instructions for the dropdown
  useEffect(() => {
    let on = true;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;
      if (!userId) return;
      const { data, error } = await supabase
        .from("instructions")
        .select("id,title")
        .eq("created_by", userId)
        .order("created_at", { ascending: false });
      if (!on) return;
      if (!error && data) setMyInstructions(data as Instruction[]);
    })();
    return () => { on = false; };
  }, []);

  // autoplay shared video
  useEffect(() => {
    s.videoRef.current?.addEventListener("loadedmetadata", () => s.videoRef.current?.play(), { once: true });
  }, [s.videoRef]);

  function saveScriptLocal(steps: RecordedEvent[]) {
    const script = {
      title: scriptName || "Untitled Script",
      createdAt: new Date().toISOString(),
      steps,
      desc,
      attachInstructionId,
    };
    localStorage.setItem("aiyes_last_script", JSON.stringify(script));
  }

  async function saveToSupabase() {
    setError(null);
    setOk(null);
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      if (!user) throw new Error("You must be signed in to save a lesson.");

      // Ensure we have a video recording blob
      if (!s.videoURL) throw new Error("No recording yet. Click Stop Recording first.");
      // Ensure we have steps (optional, but recommended)
      const steps: RecordedEvent[] = (window as any).__lastSteps__ || [];
      if (!steps.length) {
        // Not a hard fail—still allow save:
        console.warn("No in-app steps captured; saving video only.");
      }

      // Convert object URL back to Blob
      const videoBlob = await fetch(s.videoURL).then((r) => r.blob());

      // Generate IDs & paths
      const lessonId = crypto.randomUUID();
      const basePath = `${user.id}/${lessonId}`;
      const videoPath = `${basePath}/video.webm`;
      const stepsPath = `${basePath}/steps.json`;

      // Upload video
      const { error: upErrV } = await supabase.storage.from("lessons").upload(videoPath, videoBlob, {
        contentType: "video/webm",
        upsert: true,
      });
      if (upErrV) throw upErrV;

      // Upload steps
      const stepsBlob = new Blob([JSON.stringify({ title: scriptName, desc, steps }, null, 2)], {
        type: "application/json",
      });
      const { error: upErrS } = await supabase.storage.from("lessons").upload(stepsPath, stepsBlob, {
        contentType: "application/json",
        upsert: true,
      });
      if (upErrS) throw upErrS;

      // Insert DB row (we’ll store stepsPath temporarily in thumbnail_url)
      const { error: insErr } = await supabase.from("lessons").insert({
        id: lessonId,
        title: scriptName,
        description: desc,
        video_url: videoPath,        // storage path, not signed URL
        thumbnail_url: stepsPath,    // using this column to stash steps.json path (quick win)
        created_by: user.id,
        instruction_id: attachInstructionId || null,
        duration: 0, // optional: you can probe video element for duration if needed
      });
      if (insErr) throw insErr;

      saveScriptLocal(steps);
      setOk("Lesson saved to Supabase!");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function exportScriptJSON() {
    const raw = localStorage.getItem("aiyes_last_script");
    if (!raw) return alert("No script saved yet.");
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = dlRef.current || document.createElement("a");
    a.href = url;
    a.download = `${(scriptName || "lesson").replace(/\s+/g, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadVideo() {
    if (!s.videoURL) return alert("No recording yet.");
    const a = dlRef.current || document.createElement("a");
    a.href = s.videoURL;
    a.download = `lesson-${Date.now()}.webm`;
    a.click();
  }

  const canSave = useMemo(() => s.videoURL, [s.videoURL]);

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-semibold">Studio – Screen Recording + Step Capture</h1>

      <div className="card p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="grid gap-2">
            <input
              className="input"
              placeholder="Lesson title"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
            />
            <textarea
              className="input min-h-[80px]"
              placeholder="Description / notes"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
            <label className="text-sm">
              Attach to Instruction:
              <select
                className="input mt-1"
                value={attachInstructionId}
                onChange={(e) => setAttachInstructionId(e.target.value as any)}
              >
                <option value="">— none —</option>
                {myInstructions.map((i) => (
                  <option key={i.id} value={i.id}>{i.title}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!s.capturing ? (
              <button className="btn btn-outline" onClick={s.startCapture}>Share Screen</button>
            ) : (
              <button className="btn btn-outline" onClick={s.stopCapture}>Stop Share</button>
            )}
            {!s.recording ? (
              <button className="btn btn-primary" onClick={s.startRecording} disabled={!s.capturing}>Start Recording</button>
            ) : (
              <button className="btn btn-outline" onClick={s.stopRecording}>Stop Recording</button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          <video ref={s.videoRef} playsInline className="h-72 w-full bg-black object-contain" />
        </div>

        <div className="flex flex-wrap gap-2">
          {!s.stepRecording ? (
            <button
              className="btn btn-outline"
              onClick={() => {
                (window as any).__lastSteps__ = [];
                s.startStepRecorder();
              }}
            >
              Start Step Recorder (in-app)
            </button>
          ) : (
            <button
              className="btn btn-outline"
              onClick={() => {
                const steps = s.stopStepRecorder();
                (window as any).__lastSteps__ = steps;
                alert(`Captured ${steps.length} actions.`);
              }}
            >
              Stop Step Recorder
            </button>
          )}

          <button className="btn btn-outline" onClick={exportScriptJSON}>
            Export Script JSON
          </button>

          <button className="btn btn-outline" onClick={downloadVideo} disabled={!s.videoURL}>
            Download Video
          </button>

          <button className="btn btn-primary" disabled={!canSave || saving} onClick={saveToSupabase}>
            {saving ? "Saving…" : "Save to Supabase"}
          </button>

          <a ref={dlRef} className="hidden" />
        </div>

        {error && <div className="text-red-400 text-sm">Error: {error}</div>}
        {ok && <div className="text-green-400 text-sm">{ok}</div>}

        <p className="text-sm text-white/70">
          Notes: Step Recorder listens for clicks/keys <b>inside this app</b> while it’s on.
          For cross-site steps, we’ll add a browser extension in a later phase.
        </p>
      </div>
    </div>
  );
}
