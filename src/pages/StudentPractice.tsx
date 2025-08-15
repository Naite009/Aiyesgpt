import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import supabase from "@/lib/supabase";
import { coachSay, checkAction, ExpectedStep } from "@/services/coach";

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_url: string | null; // we store steps.json path here
};

function toExpected(steps: any[]): ExpectedStep[] {
  const out: ExpectedStep[] = [];
  for (const ev of steps) {
    if (ev.type === "click" && ev.targetText) out.push({ kind: "clickText", text: ev.targetText });
    else if (ev.type === "type" && ev.value) out.push({ kind: "typeContains", sample: ev.value });
    else if (ev.type === "keydown" && ev.key) out.push({ kind: "key", key: ev.key });
  }
  return out.slice(0, 80);
}

export default function StudentPractice() {
  const { lessonId } = useParams();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [expected, setExpected] = useState<ExpectedStep[]>([]);
  const [doneIndex, setDoneIndex] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);

  // Load lesson + steps.json
  useEffect(() => {
    let on = true;
    (async () => {
      setErr(null);
      if (!lessonId) { setErr("Missing lesson id"); return; }
      const { data, error } = await supabase
        .from("lessons")
        .select("id,title,description,video_url,thumbnail_url")
        .eq("id", lessonId)
        .maybeSingle();
      if (!on) return;
      if (error || !data) { setErr(error?.message || "Lesson not found"); return; }
      setLesson(data as Lesson);

      // Determine steps path
      const stepsPath =
        (data as any).thumbnail_url?.endsWith(".json")
          ? (data as any).thumbnail_url
          : (data as any).video_url?.replace(/\/[^/]+$/, "/steps.json"); // swap file in same folder

      if (!stepsPath) { setErr("No steps.json path found for this lesson"); return; }

      // Create signed URL + fetch JSON
      const { data: sig, error: sigErr } = await supabase.storage.from("lessons").createSignedUrl(stepsPath, 60 * 10);
      if (sigErr || !sig?.signedUrl) { setErr("Could not sign steps.json"); return; }
      const json = await fetch(sig.signedUrl).then((r) => r.json()).catch(() => null);
      if (!json || !Array.isArray(json.steps)) { setErr("Invalid steps.json format"); return; }

      setExpected(toExpected(json.steps));
      setDoneIndex(0);
    })();
    return () => { on = false; };
  }, [lessonId]);

  // Red dot + coach
  useEffect(() => {
    function placeDot(x?: number, y?: number) {
      if (!dotRef.current || x == null || y == null) return;
      dotRef.current.style.left = `${x - 8}px`;
      dotRef.current.style.top = `${y - 8}px`;
      dotRef.current.style.opacity = "1";
      setTimeout(() => { if (dotRef.current) dotRef.current.style.opacity = "0"; }, 800);
    }

    function onClick(e: MouseEvent) {
      const targetText = (e.target as HTMLElement)?.innerText?.trim()?.slice(0, 80);
      const res = checkAction(expected, doneIndex, { type: "click", targetText, x: e.clientX, y: e.clientY });
      if (res.ok) {
        setDoneIndex(res.doneIndex);
        coachSay("Good!");
      } else {
        coachSay(res.msg);
        placeDot(e.clientX, e.clientY);
      }
    }

    function onKeydown(e: KeyboardEvent) {
      const res = checkAction(expected, doneIndex, { type: "keydown", key: e.key });
      if (res.ok) {
        setDoneIndex(res.doneIndex);
        coachSay("Nice.");
      } else {
        coachSay(res.msg);
      }
    }

    function onInput(e: Event) {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      const value = target?.value || "";
      const res = checkAction(expected, doneIndex, { type: "type", value });
      if (res.ok) setDoneIndex(res.doneIndex);
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeydown, true);
    document.addEventListener("input", onInput, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("input", onInput, true);
    };
  }, [expected, doneIndex]);

  const done = doneIndex >= expected.length;

  return (
    <div className="relative">
      <div
        ref={dotRef}
        className="pointer-events-none absolute z-50 h-4 w-4 rounded-full bg-red-500 opacity-0 transition-opacity"
      />
      <h1 className="mb-3 text-2xl font-semibold">
        Practice{lesson?.title ? ` – ${lesson.title}` : ""}
      </h1>

      {err && <div className="text-red-400">{err}</div>}

      {!err && expected.length === 0 ? (
        <div className="card p-4">Loading steps…</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="card p-4">
            <p className="text-sm text-white/70">
              Follow the steps. The coach will speak and show a red dot when a step is wrong.
            </p>
            <div className="mt-3 space-y-2">
              {expected.map((s, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-2 text-sm ${
                    i < doneIndex ? "border-green-500/50 bg-green-500/10" :
                    i === doneIndex ? "border-blue-400/50 bg-blue-400/10" :
                    "border-white/10"
                  }`}
                >
                  {renderStep(s)}
                </div>
              ))}
            </div>
            {done && <div className="mt-3 text-green-400">All steps completed! 🎉</div>}
          </div>

          <div className="card p-4">
            <div className="text-sm text-white/70">Try interacting here:</div>
            <div className="mt-3 space-y-2">
              <input className="input" placeholder="Try typing here…" />
              <button className="btn btn-outline">Save</button>
              <button className="btn btn-outline">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderStep(s: ExpectedStep) {
  switch (s.kind) {
    case "clickText": return <>Click “<b>{s.text}</b>”</>;
    case "typeContains": return <>Type something that includes “<b>{s.sample}</b>”</>;
    case "key": return <>Press key “<b>{s.key}</b>”</>;
  }
}
