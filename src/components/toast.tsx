"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, TriangleAlert } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; tone: "ok" | "error" };
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, tone: Toast["tone"] = "ok") => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 520, damping: 38 }}
              className="pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl bg-ink px-4 py-3 text-sm text-page shadow-float"
              role={t.tone === "error" ? "alert" : "status"}
            >
              {t.tone === "ok" ? (
                <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--soon)]" strokeWidth={2.25} />
              )}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
