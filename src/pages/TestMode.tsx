import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { parseStepsFromMarkdown } from "@/services/ai";

type Instruction = {
  id: string;
  title: string;
  content?: string | null;
};

type MCQ = {
  q: string;
  options: string[];
  answerIndex: number;
};

export default function TestMode() {
  const { id } = useParams<{ id: string }>();
  const [instruction, setInstruction] = useState<Instruction | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Load the instruction
  useEffect(() => {
    let alive = true;
    async function run() {
      if (!id) return;
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase.from("instructions").select("*").eq("id", id).single();
      if (!alive) return;
      if (error) {
        setErr(error.message || String(error));
        setInstruction(null);
      } else {
        setInstruction(data as Instruction);
      }
      setLoading(false);
    }
    run();
    return () => {
      alive = false;
    };
  }, [id]);

  // Naive question generator: turn steps into MCQs (demo-quality)
  const questions: MCQ[] = useMemo(() => {
    const md = instruction?.content ?? "";
    const steps = parseStepsFromMarkdown(md).slice(0, 6); // cap it a bit
    if (!steps.length) return [];

    const qs: MCQ[] = [];
    for (const step of steps) {
      // Build a simple multiple-choice question "Which step matches this?"
      const correct = step;
      const distractors = steps
        .filter((s) => s !== step)
        .slice(0, 3);
      while (distractors.length < 3) distractors.push("None of the above");

      const choices = [correct, ...distractors].slice(0, 4);
      // shuffle deterministically-ish
      const shuffled = [...choices].sort((a, b) => a.localeCompare(b));
      const answerIndex = shuffled.findIndex((c) => c === correct);
      qs.push({
        q: `Which of the following best matches this step?`,
        options: shuffled,
        answerIndex: Math.max(0, answerIndex),
      });
    }
    return qs;
  }, [instruction]);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState<number>(0);
  const done = idx >= questions.length;

  useEffect(() => {
    setPicked(null);
  }, [idx]);

  function submit() {
    if (picked === null) return;
    const isCorrect = picked === questions[idx].answerIndex;
    setScore((s) => s + (isCorrect ? 1 : 0));
    setIdx((i) => i + 1);
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;
  if (!instruction) return <div className="p-6 text-red-600">Instruction not found.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Test Mode</h1>
        <div className="text-sm opacity-80">{instruction.title}</div>
      </div>

      {!questions.length ? (
        <div className="p-4 rounded-xl border">
          No questions generated from this instruction yet.
        </div>
      ) : done ? (
        <div className="p-4 rounded-xl border">
          <div className="text-lg font-semibold mb-1">Results</div>
          <div>
            Score: {score} / {questions.length} (
            {Math.round((score / Math.max(1, questions.length)) * 100)}%)
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border space-y-3">
          <div className="text-sm opacity-70">
            Question {idx + 1} of {questions.length}
          </div>
          <div className="text-lg">{questions[idx].q}</div>

          <div className="space-y-2">
            {questions[idx].options.map((opt, i) => (
              <label
                key={i}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                  picked === i ? "bg-blue-50 border-blue-400" : "hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="answer"
                  checked={picked === i}
                  onChange={() => setPicked(i)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
              onClick={submit}
              disabled={picked === null}
            >
              Submit
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-slate-600 text-white"
              onClick={() => setIdx((i) => Math.min(questions.length, i + 1))}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
