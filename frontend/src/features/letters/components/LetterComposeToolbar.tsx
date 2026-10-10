"use client";

import { useEffect, useState } from "react";
import { BarChart3, PenSquare } from "lucide-react";

import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { Button } from "@/components/ui/button";
import { LETTER_WORKFLOWS, type LetterType } from "@/features/management";

const LETTER_TYPES: LetterType[] = ["internal", "external"];

const SHORT_LABELS: Record<LetterType, string> = {
  internal: "درون‌سازمانی",
  external: "برون‌سازمانی",
};

export function useLetterSendAccess() {
  const [allowedTypes, setAllowedTypes] = useState<LetterType[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all(
      LETTER_TYPES.map((letterType) =>
        client
          .get<{ allowed: boolean }>(endpoints.managementLetterAccess, {
            params: { letter_type: letterType },
          })
          .then(({ data }) => (data.allowed ? letterType : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (active) setAllowedTypes(results.filter((item): item is LetterType => item !== null));
    });
    return () => {
      active = false;
    };
  }, []);

  return allowedTypes;
}

type LetterComposeToolbarProps = {
  allowedTypes: LetterType[];
  onCompose: (letterType: LetterType) => void;
  onReport: (letterType: LetterType) => void;
};

export function LetterComposeToolbar({
  allowedTypes,
  onCompose,
  onReport,
}: LetterComposeToolbarProps) {
  if (allowedTypes.length === 0) return null;

  return (
    <div className="space-y-2 border-b border-border pb-3">
      {allowedTypes.map((letterType) => (
        <Button
          key={`compose-${letterType}`}
          type="button"
          onClick={() => onCompose(letterType)}
          className="h-10 w-full justify-start gap-2 rounded-xl px-3 text-sm font-bold"
          title={LETTER_WORKFLOWS[letterType].sendTitle}
        >
          <PenSquare size={16} />
          نامه جدید {SHORT_LABELS[letterType]}
        </Button>
      ))}
      {allowedTypes.map((letterType) => (
        <Button
          key={`report-${letterType}`}
          type="button"
          variant="ghost"
          onClick={() => onReport(letterType)}
          className="h-9 w-full justify-start gap-2 rounded-xl px-3 text-xs font-semibold text-muted-foreground"
          title={LETTER_WORKFLOWS[letterType].reportTitle}
        >
          <BarChart3 size={14} />
          گزارش {SHORT_LABELS[letterType]}
        </Button>
      ))}
    </div>
  );
}
