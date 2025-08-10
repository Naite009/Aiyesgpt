import { Link } from "react-router-dom";
import type { Instruction } from "@/types";
import { useBookmarks } from "@/hooks/useBookmarks";

function formatDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function InstructionCard({ instruction }: { instruction: Instruction }) {
  const { isBookmarked, toggle } = useBookmarks();
  const fav = isBookmarked(instruction.id);

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold truncate">{instruction.title}</h3>
            {fav && (
              <span className="badge">★ Favorite</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
            {instruction.category && <span className="badge">{instruction.category}</span>}
            {instruction.tags?.slice(0, 3).map((t) => (
              <span key={t} className="badge">{t}</span>
            ))}
            {instruction.createdAt && (
              <span className="opacity-60">{formatDate(instruction.createdAt)}</span>
            )}
            {!instruction.isPublic && <span className="badge">Private</span>}
          </div>
        </div>

        {/* Bookmark toggle */}
        <button
          className={`btn ${fav ? "btn-primary" : "btn-outline"}`}
          onClick={() => toggle(instruction.id)}
          title={fav ? "Remove from Favorites" : "Add to Favorites"}
        >
          {fav ? "★ Bookmarked" : "☆ Bookmark"}
        </button>
      </div>

      {/* Preview (first lines of content) */}
      <div className="text-sm text-white/80 line-clamp-3 whitespace-pre-wrap">
        {instruction.content?.split("\n").slice(0, 4).join("\n")}
      </div>

      {/* Actions */}
      <div className="mt-1 flex flex-wrap gap-2">
        <Link to={`/guided/${instruction.id}`} className="btn btn-primary">
          Start Guided
        </Link>
        <Link to={`/test/${instruction.id}`} className="btn btn-outline">
          Start Test
        </Link>
        {/* Optional: link to details/browse */}
        <Link to={`/browse`} className="btn btn-outline">
          Back to Browse
        </Link>
      </div>
    </div>
  );
}
