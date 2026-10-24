"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  currentUrl?: string | null;
  file: File | null;
  removed?: boolean;
  onFile: (file: File | null) => void;
  onRemoveCurrent?: (removed: boolean) => void;
};

export default function LogoPicker({ currentUrl, file, removed = false, onFile, onRemoveCurrent }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(selected: File | null) {
    setError("");
    if (!selected) return;
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError("فقط تصویر JPG، PNG یا WebP مجاز است.");
      return;
    }
    if (selected.size > MAX_LOGO_BYTES) {
      setError("حجم لوگو نباید بیشتر از ۵ مگابایت باشد.");
      return;
    }
    onRemoveCurrent?.(false);
    onFile(selected);
  }

  function clear() {
    onFile(null);
    if (currentUrl) onRemoveCurrent?.(true);
    if (input.current) input.current.value = "";
  }

  const shown = preview ?? (removed ? null : currentUrl ?? null);

  return (
    <div className="space-y-2">
      <Label>لوگو</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border bg-primary/5">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob or API image preview
            <img src={shown} alt="پیش‌نمایش لوگو" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
            {shown ? "تغییر لوگو" : "انتخاب لوگو"}
          </Button>
          {shown && (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              <X /> حذف
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(event) => pick(event.target.files?.[0] ?? null)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
