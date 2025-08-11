import { Link } from "react-router-dom";
import { Bookmark } from "lucide-react";
import { useBookmarks } from "@/hooks/useBookmarks";

export default function InstructionCard(props: any) {
  // Normalize props (accept either {instruction} or individual fields)
  const i = props.instruction
    ? props.instruction
    : {
        id: props.id,
        title: props.title,
        category: props.category,
        tags: props.tags,
        is_public: props.isPublic,
        content: props.preview, // used as preview text
      };

  const id: string = i.id;
  const title: string = i.title;
  const category: string | null = i.category ?? null;
  const tags: string[] | null = i.tags ?? null;
  const isPublic: boolean = Boolean(i.is_public);
  const preview: string | undefined = props.instruction
    ? (i.content ?? "").slice(0, 160)
    : props.preview;

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
