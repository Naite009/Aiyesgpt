import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";

type Row = {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  video_url: string | null;
  video_path: string | null;
  thumbnail_path: string | null;
  created_at: string;
  instruction_id: string | null;
};

export default function Lessons() {
  const { notify } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const q = supabase
        .from("lessons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      const { data, error } = user ? await q.eq("created_by", user.id) : await q.eq("created_by", ""); // only show yours
      if (!mounted) return;
      if (error) {
        console.error("[lessons] load error", error);
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  async function open(row: Row) {
    if (row.video_path) {
      const { data, error } = await supabase.storage.from("lessons").createSignedUrl(row.video_path, 3600);
      if (error || !data?.signedUrl) {
        notify({ tone: "error", message: "Could not open video." });
        return;
      }
      window.open(data.signedUrl, "_blank");
    } else if (row.video_url) {
      window.open(row.video_url, "_blank");
    } else {
      notify({ tone: "error", message: "No video available." });
    }
  }

  async function remove(row: Row) {
    if (!confirm("Delete this lesson?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", row.id);
    if (error) return notify({ tone: "error", message: "Delete failed." });
    setRows((xs) => xs.filter((x) => x.id !== row.id));
  }

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Lessons</h1>
      {loading ? (
        <div className="card p-4 text-white/60">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card p-4 text-white/60">No lessons yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r.id} className="card p-3 grid gap-2">
              <div className="aspect-video w-full rounded-lg bg-black overflow-hidden">
                {r.thumbnail_path ? (
                  <Thumb path={r.thumbnail_path} />
                ) : (
                  <div className="w-full h-full grid place-items-center text-white/40">No thumbnail</div>
                )}
              </div>
              <div className="font-medium">{r.title}</div>
              {r.description && <div className="text-white/70 text-sm line-clamp-2">{r.description}</div>}
              <div className="text-white/60 text-xs">{r.duration ? `${r.duration}s` : ""}</div>
              <div className="flex flex-wrap gap-2">
                {r.instruction_id && (
                  <Link to={`/student/guided/${r.instruction_id}`} className="btn btn-primary">Try This</Link>
                )}
                <button className="btn btn-outline" onClick={() => open(r)}>Open</button>
                <button className="btn btn-danger" onClick={() => remove(r)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.storage.from("lessons").createSignedUrl(path, 3600);
      if (!mounted) return;
      setUrl(data?.signedUrl ?? null);
    })();
    return () => { mounted = false; };
  }, [path]);
  return url ? <img src={url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/5" />;
}
