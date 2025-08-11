import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBookmarks } from "@/hooks/useBookmarks";
import InstructionCard from "@/components/InstructionCard";

type Instruction = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
  is_public: boolean | null;
  created_by: string | null;
  created_at: string;
};

export default function Favorites() {
  const [rows, setRows] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const { isBookmarked } = useBookmarks();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      // Load public+mine similar to Browse, then filter by bookmark locally
      const { data: { user } } = await supabase.auth.getUser();
      const q = supabase
        .from("instructions")
        .select("id,title,content,category,tags,is_public,created_by,created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      const { data, error } = user
        ? await q.or(`is_public.eq.true,created_by.eq.${user.id}`)
        : await q.eq("is_public", true);

      if (!mounted) return;
      if (error) {
        console.error("[favorites] load error", error);
        setRows([]);
      } else {
        setRows((data ?? []) as Instruction[]);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const bookmarked = useMemo(
    () => rows.filter((r) => isBookmarked(r.id)),
    [rows, isBookmarked]
  );

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Favorites</h1>

      {loading ? (
        <div className="card p-4 text-white/60">Loading…</div>
      ) : bookmarked.length === 0 ? (
        <div className="card p-4 text-white/60">No favorites yet.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookmarked.map((i) => (
            <InstructionCard
              key={i.id}
              id={i.id}
              title={i.title}
              category={i.category ?? undefined}
              tags={i.tags ?? undefined}
              isPublic={!!i.is_public}
              preview={i.content?.slice(0, 160)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
