import { useMemo } from "react";
import { useAppStore, triggerRefresh } from "@/store";
import { useBookmarks } from "@/hooks/useBookmarks";
import InstructionCard from "@/components/InstructionCard";

export default function Browse() {
  const {
    instructions,
    searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory,
  } = useAppStore();

  const { ids: favIds } = useBookmarks();

  // Build category list from data
  const categories = useMemo(() => {
    const set = new Set<string>();
    instructions.forEach((i) => set.add(i.category || "General"));
    return ["All", ...Array.from(set).sort()];
  }, [instructions]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const cat = selectedCategory && selectedCategory !== "All" ? selectedCategory : null;

    let list = instructions.filter((i) => {
      if (cat && (i.category || "General") !== cat) return false;
      if (!q) return true;

      const hay = [
        i.title,
        i.category,
        i.tags?.join(" "),
        i.content.slice(0, 500),
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });

    // Sort favorites to the top, then newest
    list = list
      .slice()
      .sort((a, b) => {
        const af = favIds.has(a.id) ? 1 : 0;
        const bf = favIds.has(b.id) ? 1 : 0;
        if (af !== bf) return bf - af; // favorites first
        // newest first by createdAt
        return (new Date(b.createdAt).getTime()) - (new Date(a.createdAt).getTime());
      });

    return list;
  }, [instructions, searchQuery, selectedCategory, favIds]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Browse</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="input"
            placeholder="Search instructions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="input"
            value={selectedCategory || "All"}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="btn btn-outline" onClick={() => triggerRefresh()}>
            Refresh
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-4 text-white/70">
          No results. Try clearing filters or searching for a different term.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ins) => (
            <InstructionCard key={ins.id} instruction={ins} />
          ))}
        </div>
      )}
    </div>
  );
}
