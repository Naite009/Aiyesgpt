import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
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

export default function Browse() {
  const [rows, setRows] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      // show public + mine if signed in; otherwise public only
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
        console.error("[browse] load error", error);
        setRows([]);
      } else {
        setRows((data ?? []) as Instruction[]);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    let xs = rows;
    if (category) xs = xs.filter((r) => (r.category || "").toLowerCase() === category.toLowerCase());
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      xs = xs.filter((r) =>
        r.title.toLowerCase().includes(s) ||
        (r.content || "").toLowerCase().includes(s) ||
        (r.tags || []).some((t) => t.toLowerCase().includes(s))
      );
    }
    return xs;
  }, [rows, q, category]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.category) set.add(r.category); });
    return Array.from(set).sort();
  }, [rows]);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Browse Instructions</h1>

      {/* Search / Filter */}
      <div className="card p-3 grid gap-3 sm:grid-cols-3">
        <input
          className="input sm:col-span-2"
          placeholder="Search title, content, or tags…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card p-4 text-white/60">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-4 text-white/60">No instructions found.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((i) => (
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
