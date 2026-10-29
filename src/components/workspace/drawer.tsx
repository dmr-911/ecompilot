"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Accessible side panel built on <dialog> (focus trap, Esc to close). */
export function Drawer({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-0 ml-auto h-dvh max-h-dvh w-full ${wide ? "max-w-5xl" : "max-w-2xl"} bg-white p-0 shadow-xl backdrop:bg-slate-900/40`}
    >
      {open ? (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}
