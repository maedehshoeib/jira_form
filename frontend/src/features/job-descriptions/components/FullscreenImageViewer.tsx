"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";

import { cn } from "@/lib/utils";

type FullscreenImageViewerProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

export function FullscreenImageViewer({
  src,
  alt,
  onClose,
}: FullscreenImageViewerProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "نمایش تمام‌صفحه تصویر"}
    >
      <button
        type="button"
        aria-label="بستن"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="بستن تصویر"
        className="absolute left-4 top-4 z-20 rounded-xl bg-white/15 p-2.5 text-white backdrop-blur transition hover:bg-white/25"
      >
        <X size={22} />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="relative z-10 max-h-[92vh] max-w-[96vw] rounded-2xl object-contain shadow-2xl"
      />
    </div>,
    document.body,
  );
}

type ClickableImageProps = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  fit?: "cover" | "contain";
  onOpen: () => void;
};

export function ClickableImage({
  src,
  alt,
  className,
  imageClassName,
  fit = "cover",
  onOpen,
}: ClickableImageProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      aria-label={`نمایش تمام‌صفحه ${alt}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        className={cn(
          "h-full w-full",
          fit === "contain" ? "object-contain" : "object-cover",
          imageClassName,
        )}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/0 transition group-hover:bg-slate-950/35">
        <ZoomIn
          size={28}
          className="text-white opacity-0 drop-shadow transition group-hover:opacity-100"
        />
      </span>
    </button>
  );
}
