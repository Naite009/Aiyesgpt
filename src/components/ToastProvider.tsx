import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; title?: string; message: string; tone?: "info"|"success"|"error" };
type Ctx = { notify: (t: Omit<Toast,"id">) => void };
const ToastCtx = createContext<Ctx>({ notify: () => {} });

export function useToast(){ return useContext(ToastCtx); }

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const notify = useCallback((t: Omit<Toast,"id">) => {
    const id = Date.now();
    setItems((prev) => [...prev, { id, ...t }]);
    setTimeout(() => setItems((prev) => prev.filter(x => x.id !== id)), 3200);
  }, []);
  const ctx = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <div className="fixed bottom-4 right-4 z-[1000] flex w-[340px] flex-col gap-2">
        {items.map(t => (
          <div key={t.id}
               className={`rounded-2xl border px-3 py-2 shadow-lg backdrop-blur
                 ${t.tone==="success" ? "border-green-500/40 bg-green-500/10" :
                   t.tone==="error" ? "border-red-500/40 bg-red-500/10" :
                   "border-white/15 bg-white/5"}`}>
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            <div className="text-sm opacity-80">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
