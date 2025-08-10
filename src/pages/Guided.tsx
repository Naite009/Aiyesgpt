import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useCamera, CameraPreview } from "@/components/Camera";
import { parseStepsFromMarkdown, verifyStepImage } from "@/services/ai";
import { useToast } from "@/components/ToastProvider";

type InstructionRow = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
};

export default function Guided() {
  const { id } = useParams<{ id: string }>();
  const cam = useCamera();
  const { notify } = useToast();

  const [row, setRow] = useState<InstructionRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [current, setCurrent] = useState<number>(0);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [history, setHistory] = useState<{ step: number; conf: number; text: string }[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("instructions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        console.error("[guided] load error:", error);
        setRow(null);
      } else {
        setRow(data as InstructionRow | null);
      }
      setLoading(false);
      setCurrent(0);
      setFeedback(null);
      setHistory([]);
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const steps = useMemo(() => {
    const md = row?.content ?? "";
    const list = parseStepsFromMarkdown(md);
    return list.length ? list : md ? [md] : [];
  }, [row?.content]);

  const verify = async () => {
    const frame = cam.capture();
    if (!frame) {
      notify({ tone: "error", message: "No camera frame captured. Open the app in a new tab and allow camera." });
      return;
    }
    console.log("[guided] frame length:", frame.length);
    if (frame.length < 2000) {
      notify({ tone: "error", message: "Camera frame too small. Ensure the video is playing and permission is granted." });
      return;
    }
    if (!steps[current]) {
      notify({ tone: "error", message: "No step text found to verify." });
      return;
    }

    setVerifying(true);
    setFeedback(null);
    try {
      const res = await verifyStepImage({
        imageBase64: frame,
        stepText: steps[current],
      });
      setHistory((h) => [{ step: current, conf: res.confidence, text: steps[current] }, ...h].slice(0, 8));
      setFeedback(`${Math.round(res.confidence * 100)}% · ${res.feedback}`);
      if (res.confidence > 0.8 && current < steps.length - 1) {
        setCurrent((c: number) => c + 1);
      }
    } catch (e: any) {
      console.error("[guided] verify error:", e);
      setFeedback(`Error: ${e.message}`);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div>Loading…</div>;
  if (!row) return <div className="text-white/70">Instruction not found.</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{row.title}</h1>

        {steps.length > 1 ? (
          <ol className="list-decimal space-y-2 pl-6">
            {steps.map((s, i) => (
              <li
                key={i}
                className={i === current ? "font-semibold text-white" : "text-white/80"}
              >
                {s}
              </li>
            ))}
          </ol>
        ) : (
          <div className="card whitespace-pre-wrap p-4 text-white/80">{row.content}</div>
        )}

        <div className="flex gap-2">
          <button
            className="btn btn-outline"
            disabled={current === 0}
            onClick={() => setCurrent((c: number) => Math.max(0, c - 1))}
          >
            Prev
          </button>
          <button className="btn btn-primary" onClick={verify} disabled={verifying || steps.length === 0}>
            {verifying ? <span className="spinner" /> : "Verify Step"}
          </button>
          <button
            className="btn btn-outline"
            disabled={current >= steps.length - 1}
            onClick={() => setCurrent((c: number) => Math.min(steps.length - 1, c + 1))}
          >
            Next
          </button>
        </div>

        {feedback && <div className="text-sm text-white/80">{feedback}</div>}

        {history.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {history.map((h, i) => (
              <span
                key={i}
                className={`rounded-full px-2 py-1 text-xs
                ${h.conf >= 0.8 ? "bg-green-500/15 border border-green-400/30" :
                  h.conf >= 0.5 ? "bg-yellow-500/15 border border-yellow-400/30" :
                    "bg-red-500/15 border border-red-400/30"}`}
              >
                Step {h.step + 1}: {Math.round(h.conf * 100)}%
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <CameraPreview hook={cam} />
        <div className="text-sm text-white/70">
          Verification sends one frame + the current step to your Supabase function.
        </div>
      </div>
    </div>
  );
}
