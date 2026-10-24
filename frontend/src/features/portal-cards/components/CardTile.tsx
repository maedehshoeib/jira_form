"use client";

import Link from "next/link";
import { ChevronLeft, FileText, FolderOpen, Pencil, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { CARD_KIND_LABELS, type CardKind, type PortalCardSummary } from "../types";

const KIND_ICONS: Record<CardKind, typeof FileText> = {
  group: FolderOpen,
  form: FileText,
  document: ScrollText,
};

export function CardLogo({
  card,
  className = "h-16 w-16",
}: {
  card: Pick<PortalCardSummary, "kind" | "logo_url" | "title">;
  className?: string;
}) {
  const Icon = KIND_ICONS[card.kind];
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 ${className}`}
    >
      {card.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not optimizable
        <img src={card.logo_url} alt={card.title} className="h-full w-full object-cover" />
      ) : (
        <Icon className="h-1/2 w-1/2 text-primary" />
      )}
    </div>
  );
}

export default function CardTile({
  card,
  isAdmin,
}: {
  card: PortalCardSummary;
  isAdmin: boolean;
}) {
  return (
    <div className="group relative">
      <Link
        href={`/cards/${card.id}`}
        className="flex h-full min-h-44 flex-col gap-4 rounded-3xl border border-primary/10 bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
      >
        <div className="flex items-start justify-between gap-3">
          <CardLogo card={card} />
          <div className="flex flex-col items-end gap-1">
            <Badge variant="secondary">{CARD_KIND_LABELS[card.kind]}</Badge>
            {isAdmin && !card.is_published && <Badge variant="outline">پیش‌نویس</Badge>}
          </div>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground">{card.title}</h3>
          {card.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{card.description}</p>
          )}
        </div>
        <div className="flex items-center justify-between text-sm font-medium text-primary">
          <span>
            {card.kind === "group" ? `${card.child_count.toLocaleString("fa-IR")} مورد` : "مشاهده"}
          </span>
          <ChevronLeft size={18} />
        </div>
      </Link>
      {isAdmin && (
        <Link
          href={`/admin/cards?card=${card.id}`}
          aria-label={`ویرایش ${card.title}`}
          title="ویرایش"
          className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground opacity-100 shadow-sm ring-1 ring-border transition hover:text-primary md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
          <Pencil size={14} />
        </Link>
      )}
    </div>
  );
}
