import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store";
import { useBookmarks } from "@/hooks/useBookmarks";
import InstructionCard from "@/components/InstructionCard";
import { supabase } from "@/lib/supabase";
import type { Instruction, DbInstructionRow } from "@/types";
import { toInstruction } from "@/types";

export default function Favorites() {
  const { instructions } = useAppStore();
  const { ids: favIds } = useBookmarks();
  const [extra, setExtra] = useState<Record<string, Instruction>>({}); // fetched favorites not already in store
  const favList = useMemo(() => Array.from(favIds), [favIds]);

  // find favorites that are already in memory
  const present: Instruction[] = useMemo(() => {
    const map = new Map(instructions.map((i) => [i.id, i]));
    return favList.map((id) => map.get(id)).filter(Boolean) as Instruction[];
  }, [instructions, favList]);

  // lookup any missing favorites from Supabase
  useEffect(() => {
    const map = new Map(instructions.map((i) => [i.id, i]));
    const missing = favList.filter((id) => !map.has(id) && !extra[id]);
    if (missing.length === 0) return;

    (async () => {
      const { data, error } = await supabase
        .from("instructions")
        .select("*")
        .in("id", missing);

      if (error) {
        console.error("[favorites] fetch missing error:", error);
        return;
      }
      const additions: Record<string, Instruction> = {};
      (data as DbInstructionRow[] | null)?.forEach((row) => {
        const ins = toInstruction(row);
        additions[ins.id] = ins;
      });
      if (Object.keys(additions).length > 0) {
        setExtra((prev) => ({ ...prev, ...additions }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favList.join(","), instructions]);

  const combined: Instruction[] = useMemo(() => {
    const withExtras = [...present, ...Object.values(extra)];
    // keep bookmark order, favorites first by original order of ids
    const order = new Map(favList.map((id, idx) => [id, idx]));
    return withExtras
      .filter((i, idx, arr) => arr.findIndex((x) => x.id === i.id) === idx) // dedupe
      .sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
  }, [present, extra, favList]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Favorites</h1>
        <div className="text-sm text-white/60">{combined.length} saved</div>
      </div>

      {combined.length === 0 ? (
        <div className="card p-4 text-white/70">
          You haven’t bookmarked anything yet. Go to Browse and hit “☆ Bookmark”.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {combined.map((ins) => (
            <InstructionCard key={ins.id} instruction={ins} />
          ))}
        </div>
      )}
    </div>
  );
}
