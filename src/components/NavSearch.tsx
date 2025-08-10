import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

export default function NavSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [inner, setInner] = useState(value);
  useEffect(() => setInner(value), [value]);

  // simple debounce
  const debounced = useMemo(() => {
    const h = setTimeout(() => onChange(inner), 250);
    return () => clearTimeout(h);
  }, [inner]);

  useEffect(() => debounced, [debounced]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
      <input
        className="input pl-10"
        placeholder="Search instructions…"
        value={inner}
        onChange={(e) => setInner(e.target.value)}
      />
    </div>
  );
}
