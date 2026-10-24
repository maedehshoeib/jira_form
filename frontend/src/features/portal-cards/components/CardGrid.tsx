"use client";

import Link from "next/link";
import { Plus } from "lucide-react";

import type { PortalCardSummary } from "../types";
import CardTile from "./CardTile";

export default function CardGrid({
  cards,
  isAdmin,
  parentId,
  emptyText = "هنوز موردی در این بخش ثبت نشده است.",
}: {
  cards: PortalCardSummary[];
  isAdmin: boolean;
  parentId: number | null;
  emptyText?: string;
}) {
  if (cards.length === 0 && !isAdmin) {
    return (
      <p className="rounded-3xl border border-dashed border-primary/20 bg-card p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  const addHref = `/admin/cards?new=1&parent=${parentId ?? "root"}`;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <CardTile key={card.id} card={card} isAdmin={isAdmin} />
      ))}
      {isAdmin && (
        <Link
          href={addHref}
          className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-primary transition hover:border-primary hover:bg-primary/10"
        >
          <Plus size={28} />
          <span className="font-bold">افزودن کارت</span>
        </Link>
      )}
    </div>
  );
}
