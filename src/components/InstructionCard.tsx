import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { useBookmarks } from "@/hooks/useBookmarks";

/** Shape used when callers pass a single `instruction` prop */
type Instruction = {
  id: string;
  title: string;
  content?: string;
  category?: string | null;
  tags?: string[] | null;
  is_public?: boolean | null;
  created_by?: string | null;
  created_at?: string;
};

/**
 * Accepts EITHER individual props OR a single `{ instruction }` (legacy).
 */
export type InstructionCardProps =
  | {
      id: string;
      title: string;
      category?: string | null;
      tags?: string[] | null;
      isPublic?: boolean;
      preview?: string;
      instruction?: never;
    }
  | {
      instruction: Instruction; // <— allow legacy callers
      id?: never;
      title?: never;
      category?: never;
      tags?: never;
      isPublic?: never;
      preview?: never;
    };

export default function InstructionCard(props: InstructionCardProps) {
  // Normalize props to a single object
  const i: Instruction =
    "instruction" in props
      ? props.instruction
      : {
          id: props.id,
          title: props.title,
          category: props.category,
          tags: props.tags,
          is_public: props.isPublic,
          content: props.preview, // used only as preview text
        };

  const id = i.id;
  const title = i.title;
  const category = i.category ?? null;
  const tags = i.tags ?? null;
  const isPublic = Boolean(i.is_public);
  const preview =
    "instruction" in props ? (i.content ?? "").slice(0, 160) : props.preview;

  const { isBookmarked, toggle } = useBookmarks();

  return (
    <div className="card p-4 grid gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-lg font-medium leading-tight">{title}</h3>
        <button
          className={`btn btn-icon ${isBookmarked(id) ? "btn-primary" : "btn-outline"}`}
          aria-label="Bookmark"
          onClick={() => toggle(id)}
          title={isBookmarked(id) ? "Remove bookmark" : "Bookmark"}
        >
          <Bookmark size={18} />
        </button>
      </div>

      {preview && <div className="text-white/70 line-clamp-3">{preview}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {category && <span className="badge">{category}</span>}
        {(tags ?? []).slice(0, 3).map((t) => (
          <span key={t} className="badge badge-outline">#{t}</span>
        ))}
        {isPublic && <span className="badge badge-success">Public</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to={`/student/guided/${id}`} className="btn btn-primary">Start Guided</Link>
        <Link to={`/student/test/${id}`} className="btn btn-outline">Start Test</Link>
      </div>
    </div>
  );
}
