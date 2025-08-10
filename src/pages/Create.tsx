import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { triggerRefresh } from "@/store";
import { useToast } from "@/components/ToastProvider";

export default function Create() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("1. Step one\n2. Step two\n- Optional tip");
  const [category, setCategory] = useState("General");
  const [tags, setTags] = useState("howto,guide");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notify } = useToast();

  const onSave = async () => {
    setError(null);

    if (!title.trim()) {
      setError("Please enter a title.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in first.");

      const payload = {
        title: title.trim(),
        content: content.trim(),
        category: category.trim() || "General",
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        is_public: isPublic,
        created_by: user.id,
      };

      const { error: dbError } = await supabase.from("instructions").insert(payload);
      if (dbError) throw dbError;

      triggerRefresh();
      setTitle("");
      setContent("");
      setCategory("General");
      setTags("howto,guide");
      setIsPublic(true);

      notify({ tone: "success", title: "Saved", message: "Your instruction was created." });
    } catch (e: any) {
      console.error("Create error:", e);
      const msg = e?.message ?? "Failed to save instruction.";
      setError(msg);
      notify({ tone: "error", title: "Create failed", message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold">Create Instruction</h1>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <label className="grid gap-1">
        <span className="text-sm text-white/70">Title *</span>
        <input
          className="input"
          placeholder="e.g., Make Tea"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="grid gap-1">
        <span className="text-sm text-white/70">Steps (markdown or numbered list)</span>
        <textarea
          className="input min-h-[180px]"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={"1. Step one\n2. Step two\n- Optional tip"}
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-sm text-white/70">Category</span>
          <input
            className="input"
            placeholder="General"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm text-white/70">Tags (comma-separated)</span>
          <input
            className="input"
            placeholder="howto,guide"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-white/80">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
        />
        Public
      </label>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="btn btn-primary">
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => notify({ tone: "info", message: "File attachments coming soon" })}
        >
          Attach File (TODO)
        </button>
      </div>
    </div>
  );
}
