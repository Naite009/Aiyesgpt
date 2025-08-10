import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { parseStepsFromMarkdown } from "@/services/ai";

type Row = {
  id: string;
  title: string;
  content: string;
  created_at: string;
};

interface Q {
  id: string;
  prompt: string;
  options?: string[];
  answer?: number;
  type: "mc" | "practical";
}

export default function TestMode() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("instructions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (error) console.error("Load instruction error:", error);
      setRow(data as Row | null);
      setLoading(false);
      setScore(0);
      setAnswered({});
    })();
    return () => { active = false; };
  }, [id]);

  const steps = useMemo(() => {
    const md = row?.content ?? "";
    const parsed = parseStepsFromMarkdown(md);
    return parsed.length ? parsed : (md ? [md] : []);
  }, [row?.content]);

  const questions: Q[] = useMemo(() => {
    if (steps.length === 0) return [];
    const firstStep = steps[0];
    const opts = steps.slice(0, Math.min(4, steps.length));
    return [
      { id: "q1", type: "mc", prompt: `What is the first step?`, options: opts, answer: 0 },
      { id: "q2", type: "practical", prompt: `Show the result of step: ${steps[Math.min(1, steps.length - 1)]}` },
    ];
  }, [steps]);

  const handleMC = (q: Q, choice: number) => {
    if (answered[q.id]) return; // prevent double scoring
    setAnswered((a) => ({ ...a, [q.id]: true }));
    if (choice === q.answer) setScore((s) => s + 1);
  };

  if (loading) return <div>Loading…</div>;
  if (!row) return <div className="text-white/70">Instruction not found.</div>;

  const totalMC = questions.filter((q) => q.type === "mc").length;

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Test: {row.title}</h1>

      {questions.length === 0 ? (
        <div className="text-white/70">No questions could be generated for this content.</div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="card p-4">
              <div className="mb-2 text-sm text-white/60">Question {idx + 1}</div>
              <div className="font-medium">{q.prompt}</div>

              {q.type === "mc" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {q.options?.map((opt, i) => (
                    <button
                      key={i}
                      className={`btn ${answered[q.id] && i === q.answer ? "btn-primary" : "btn-outline"}`}
                      onClick={() => handleMC(q, i)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "practical" && (
                <div className="mt-2 space-y-2 text-sm text-white/80">
                  <div>Use Guided Mode to verify practical answers with the camera.</div>
                  <Link to={`/guided/${row.id}`} className="btn btn-primary">
                    Open Guided Mode
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-white/80">
        Score: {score} / {totalMC}
      </div>
    </div>
  );
}
