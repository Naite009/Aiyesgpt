import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import { Link } from "react-router-dom";

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;      // storage path
  thumbnail_url: string | null;  // we'll stash steps.json path here
  created_by: string;
  instruction_id: string | null;
  created_at: string;
};

export default function Lessons() {
  const [items, setItems] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from("lessons")
        .select("id,title,description,video_url,thumbnail_url,created_by,instruction_id,created_at")
        .order("created_at", { ascending: false });
      if (!on) return;
      if (error) setErr(error.message);
      else setItems((data || []) as Lesson[]);
      setLoading(false);
    })();
    return () => { on = false; };
  }, []);

  async function openVideo(path: string | null) {
    if (!path) return alert("No video.");
    const { data, error } = await supabase.storage.from("lessons").createSignedUrl(path, 60 * 15);
    if (error || !data?.signedUrl) return alert("Could not sign URL.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function removeLesson(id: string) {
    if (!confirm("Delete this lesson?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", id);
    if (error) return alert(error.message);
    setItems((x) => x.filter((i) => i.id !== id));
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-semibold">Lessons</h1>
      {loading && <div className="text-white/70">Loading…</div>}
      {err && <div className="text-red-400">Error: {err}</div>}
      {!loading && !items.length && <div className="card p-4">No lessons yet.</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((l) => (
          <div key={l.id} className="card p-4 space-y-2">
            <div className="text-lg font-medium">{l.title}</div>
            {l.description && <div className="text-sm text-white/70">{l.description}</div>}
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn btn-outline" onClick={() => openVideo(l.video_url)}>
                Open
              </button>
              <Link className="btn btn-primary" to={`/student/practice/${l.id}`}>
                Try This
              </Link>
              <button className="btn btn-outline" onClick={() => removeLesson(l.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
