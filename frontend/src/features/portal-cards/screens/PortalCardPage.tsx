"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";

import DynamicForm from "@/components/forms/DynamicForm";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

import { getCard } from "../api";
import CardGrid from "../components/CardGrid";
import { CardLogo } from "../components/CardTile";
import DocumentView from "../components/DocumentView";
import type { PortalCardDetail } from "../types";

function Message({ title, text }: { title: string; text?: string }) {
  return (
    <AppShell>
      <div className="rounded-3xl border border-primary/20 bg-card p-10 text-center shadow-sm">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {text && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
        <Link href="/" className="mt-5 inline-block font-bold text-primary">
          بازگشت به خانه
        </Link>
      </div>
    </AppShell>
  );
}

export default function PortalCardPage() {
  const params = useParams<{ cardId: string }>();
  const { user } = useAuth();
  const isAdmin = Boolean(user?.is_admin);
  const cardId = Number(params.cardId);

  const [card, setCard] = useState<PortalCardDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(cardId) || cardId <= 0) {
      setFailed(true);
      return;
    }
    let active = true;
    setCard(null);
    setFailed(false);
    getCard(cardId)
      .then((data) => active && setCard(data))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [cardId]);

  if (failed) {
    return (
      <Message
        title="دسترسی به این بخش امکان‌پذیر نیست"
        text="این بخش برای حساب شما فعال نشده یا دیگر وجود ندارد."
      />
    );
  }
  if (!card) {
    return <AppShell>در حال بارگذاری...</AppShell>;
  }

  const parent = card.breadcrumbs.length > 0 ? card.breadcrumbs[card.breadcrumbs.length - 1] : null;
  const backHref = parent ? `/cards/${parent.id}` : "/";

  return (
    <AppShell>
      <nav aria-label="مسیر" className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Link href={backHref} className="inline-flex items-center gap-1 text-primary">
          <ChevronLeft size={18} />
          بازگشت
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link href="/" className="text-muted-foreground hover:text-primary">
          خانه
        </Link>
        {card.breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-2">
            <span className="text-muted-foreground">/</span>
            <Link href={`/cards/${crumb.id}`} className="text-muted-foreground hover:text-primary">
              {crumb.title}
            </Link>
          </span>
        ))}
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">{card.title}</span>
      </nav>

      <header className="mb-8 flex flex-col gap-4 rounded-3xl bg-card p-6 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CardLogo card={card} className="h-16 w-16" />
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{card.title}</h1>
            {card.description && (
              <p className="mt-1 text-muted-foreground">{card.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <Button asChild variant="outline">
            <Link href={`/admin/cards?card=${card.id}`}>
              <Pencil /> ویرایش کارت
            </Link>
          </Button>
        )}
      </header>

      {card.kind === "group" && (
        <CardGrid cards={card.children} isAdmin={isAdmin} parentId={card.id} />
      )}
      {card.kind === "form" &&
        (card.form && card.form.fields.length > 0 ? (
          <DynamicForm form={card.form} />
        ) : (
          <p className="rounded-3xl border border-dashed border-primary/20 bg-card p-8 text-center text-sm text-muted-foreground">
            فیلدهای این فرم هنوز تعریف نشده است.
          </p>
        ))}
      {card.kind === "document" && <DocumentView card={card} />}
    </AppShell>
  );
}
