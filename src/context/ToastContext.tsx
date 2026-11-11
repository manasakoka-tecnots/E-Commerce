// src/context/ToastContext.tsx
"use client";
import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type Toast = { id: number; message: string; exiting: boolean };

type ToastContextType = {
  addToast: (msg: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((msg: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message: msg, exiting: false }]);
    // Auto‑remove after 3 seconds
    // Start exit animation slightly before removal
    setTimeout(() => setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t)), 2700);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bg-black text-white px-4 py-2 rounded shadow-lg ${t.exiting ? "toast-exit" : "toast-enter"}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
