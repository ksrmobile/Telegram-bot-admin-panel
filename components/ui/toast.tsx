"use client";

import * as React from "react";
import { cn } from "../../lib/utils";

export type Toast = {
  id: number;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  /**
   * Optional per-toast auto-dismiss timeout in milliseconds.
   * Defaults to 6000ms when not provided.
   */
  timeoutMs?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

let idCounter = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const push = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = idCounter++;
    const timeoutMs =
      typeof toast.timeoutMs === "number" && toast.timeoutMs >= 0
        ? toast.timeoutMs
        : 6000;

    setToasts((prev) => [...prev, { ...toast, id }]);

    if (timeoutMs > 0 && typeof window !== "undefined") {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, timeoutMs);
    }
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 p-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto w-full max-w-sm overflow-hidden rounded-md border border-border/60 bg-card/95 px-4 py-3 shadow-lg",
              toast.variant === "destructive" && "border-red-500/60"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                {toast.title && (
                  <p className="text-sm font-medium">{toast.title}</p>
                )}
                {toast.description && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

export function Toaster() {
  // Rendered in RootLayout via ToastProvider, so this is a no-op placeholder
  return null;
}

