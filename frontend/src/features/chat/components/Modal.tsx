import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ title, children, onClose }: ModalProps) {
  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <Button variant="ghost"
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
      />
      <section className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-hidden rounded-3xl bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-bold text-foreground">{title}</h2>
          <Button variant="ghost"
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted"
          >
            <X size={20} />
          </Button>
        </header>
        {children}
      </section>
    </div>
  );
}
