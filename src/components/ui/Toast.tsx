"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; tone: ToastTone; message: string };

const ToastContext = createContext<{
  push: (message: string, tone?: ToastTone) => void;
} | null>(null);

const TONE: Record<ToastTone, { bg: string; fg: string; icon: string }> = {
  success: { bg: "bg-grid-green", fg: "text-white", icon: "✓" },
  error: { bg: "bg-danger", fg: "text-white", icon: "!" },
  info: { bg: "bg-ink", fg: "text-white", icon: "i" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[200] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
      >
        {toasts.map((toast) => {
          const tone = TONE[toast.tone];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-2xl px-4 py-3 shadow-[0_18px_40px_-20px_rgba(18,22,28,0.6)] ${tone.bg} ${tone.fg}`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 font-display text-xs font-bold">
                {tone.icon}
              </span>
              <span className="text-[13.5px] font-medium">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
