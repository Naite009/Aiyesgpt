import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";

export function useBookmarks() {
  const { user } = useSession();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user) { setIds(new Set()); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("bookmarks")
      .select("instruction_id")
      .eq("user_id", user.id);
    if (!error) setIds(new Set((data ?? []).map(r => r.instruction_id)));
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user?.id]);

  const isBookmarked = (instructionId: string) => ids.has(instructionId);

  const toggle = async (instructionId: string) => {
    if (!user) { alert("Please sign in first."); return; }
    if (ids.has(instructionId)) {
      const { error } = await supabase.from("bookmarks")
        .delete().match({ user_id: user.id, instruction_id: instructionId });
      if (!error) setIds(prev => { const c = new Set(prev); c.delete(instructionId); return c; });
    } else {
      const { error } = await supabase.from("bookmarks")
        .insert({ user_id: user.id, instruction_id: instructionId });
      if (!error) setIds(prev => new Set(prev).add(instructionId));
    }
  };

  return { loading, isBookmarked, toggle, ids: useMemo(() => ids, [ids]) };
}
