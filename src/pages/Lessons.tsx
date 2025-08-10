import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { useSession } from "@/hooks/useSession";

type LessonRow = {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  video_url: string | null;        // legacy (public)
  thumbnail_url: string | null;    // legacy (public)
  video_path: string | null;       // new (private)
  thumbnail_path: string | null;   // new (private)
  created_by: string | null;
  instruction_id: string | null;
  created_at: string;
};

const PAGE_SIZE = 12;

export default function Lessons() {
  const { user } = useSession();
  const { notify } = useToast();

  const [rows, setRows] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number>(0);
  const [playing, setPlaying] = useState<string | null>(null);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  async function loadCount() {
    const { count } = await supabase.from("lessons").select("*", { count: "exact", head: true });
    if (typeof count === "number") setTotal(count);
  }

  async function sign(path?: string | null, seconds = 3600) {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("lessons").createSignedUrl(path, seconds);
    if (error) {
      console.error("[lessons] sign error", error);
      return null;
    }
    return data.signedUrl;
  }

  function extractPathFromPublicUrl(url?: string | null): string | null {
    if (!url) return null;
    // Works for URLs like:
    // https://<ref>.supabase.co/storage/v1/object/public/lessons/<user>/<file>.ext
    const i = url.indexOf("/object/public/lessons/");
    if (i === -1) return null;
    return url.slice(i + "/object/public/lessons/".length);
  }

  async function loadPage(p = page) {
    setLoading(true);
    const from = (p - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[lessons] load error", error);
      notify({ tone: "error", title: "Load failed", message: error.message });
      setRows([]);
      setLoading(false);
      return;
    }

    const raw = (data ?? []) as LessonRow[];

    // Prefer private paths; else derive from legacy URLs and sign those.
    const signed = await Promise.all(raw.map(async (r) => {
      const vPath = r.video_path ?? extractPathFromPublicUrl(r.video_url);
      const tPath = r.thumbnail_path ?? extractPathFromPublicUrl(r.thumbnail_url);
      const video = vPath ? await sign(vPath) : r.video_url;
      const thumb = tPath ? await sign(tPath) : r.thumbnail_url;
      return { ...r, video_url: video, thumbnail_url: thumb };
    }));

    setRows(signed);
    setLoading(false);
  }

  useEffect(() => {
    loadCount().then(() => loadPage(1));
    setPage(1);
  }, []);

  useEffect(() => {
    loadPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function onDelete(id: string) {
    if (!confirm("Delete this lesson? This cannot be undone.")) return;
    try {
      const row = rows.find(r => r.id === id);
      const toRemove: string[] = [];
      // Remove by private paths when present; else try to derive from legacy URL.
      const vPath = row?.video_path ?? extractPathFromPublicUrl(row?.video_url ?? undefined);
      const tPath = row?.thumbnail_path ?? extractPathFromPublicUrl(row?.thumbnail_url ?? undefined);
      if (vPath) toRemove.push(vPath);
      if (tPath) toRemove.push(tPath);
      if (toRemove.length) await supabase.storage.from("lessons").remove(toRemove);

      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;

      notify({ tone: "success", message: "Lesson deleted." });
      await loadCount();
      const newLastPage = Math.max(1, Math.ceil((total - 1) / PAGE_SIZE));
      if (page > newLastPage) setPage(newLastPage);
      else loadPage(page);
    } catch (e: any) {
      console.error("[lessons] delete error", e);
      notify({ tone: "error", title: "Delete failed", message: e?.message ?? "Unknown error" });
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lessons</h1>
        <div className="text-sm text-white/60">{total} total · Page {page} / {pageCount}</div>
      </div>

      {loading ? (
        <div className="card p-4">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card p-4 text-white/70">
          No lessons yet. Go to <b>Studio</b>, record a screen/camera walkthrough, and click “Save lesson”.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const mine = user?.id && r.created_by === user.id;
            return (
              <div key={r.id} className="card p-3 flex flex-col gap-3">
                <div className="relative">
                  {playing === r.id && r.video_url ? (
                    <video
                      src={r.video_url}
                      controls
                      autoPlay
                      className="w-full aspect-video rounded-lg bg-black"
                      onEnded={() => setPlaying(null)}
                    />
                  ) : (
                    <button className="w-full" onClick={() => setPlaying(r.id)} title="Play preview">
                      <img
                        src={r.thumbnail_url ?? ""}
                        alt={r.title}
                        className="w-full aspect-video rounded-lg object-cover bg-black"
                        onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.4")}
                      />
                    </button>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold truncate" title={r.title}>{r.title}</h3>
                    {r.duration ? <span className="badge">{formatDuration(r.duration)}</span> : null}
                  </div>
                  {r.description && <div className="text-xs text-white/70 line-clamp-2">{r.description}</div>}
                </div>

                <div className="mt-auto flex flex-wrap gap-2">
                  {r.video_url && (
                    <a className="btn btn-outline" href={r.video_url} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}
                  {mine && (
                    <button className="btn btn-outline" onClick={() => onDelete(r.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(1)}>« First</button>
          <button className="btn btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>
          <button className="btn btn-outline" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next ›</button>
          <button className="btn btn-outline" disabled={page >= pageCount} onClick={() => setPage(pageCount)}>Last »</button>
        </div>
      )}
    </div>
  );
}

function formatDuration(s?: number | null) {
  if (!s || s < 1) return "0:00";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
