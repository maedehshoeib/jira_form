"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";

import { getAdminCard, listAdminCards, reorderCards, requestErrorMessage } from "../api";
import CardBasicsEditor from "../components/admin/CardBasicsEditor";
import CardTree from "../components/admin/CardTree";
import CreateCardDialog from "../components/admin/CreateCardDialog";
import DocumentEditor from "../components/admin/DocumentEditor";
import FormBuilder from "../components/admin/FormBuilder";
import { buildTree, parentLabel } from "../components/admin/treeUtils";
import { CARD_KIND_LABELS, type PortalCardAdminDetail, type PortalCardSummary } from "../types";

type Tab = "info" | "content";

export default function AdminPortalCardsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = Number(params.get("card")) || null;

  const [cards, setCards] = useState<PortalCardSummary[]>([]);
  const [detail, setDetail] = useState<PortalCardAdminDetail | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [creating, setCreating] = useState<{ parentId: number | null } | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setCards(await listAdminCards());
    } catch (err) {
      setError(requestErrorMessage(err, "دریافت فهرست کارت‌ها انجام نشد."));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Deep link from the homepage: /admin/cards?new=1&parent=root|<id>
  useEffect(() => {
    if (params.get("new") !== "1") return;
    const parent = params.get("parent");
    setCreating({ parentId: parent && parent !== "root" ? Number(parent) || null : null });
    const keep = params.get("card");
    router.replace(keep ? `/admin/cards?card=${keep}` : "/admin/cards", { scroll: false });
  }, [params, router]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    getAdminCard(selectedId)
      .then((data) => active && setDetail(data))
      .catch(() => {
        if (!active) return;
        setDetail(null);
        setError("این کارت پیدا نشد.");
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const tree = useMemo(() => buildTree(cards), [cards]);
  const select = (id: number | null) =>
    router.replace(id ? `/admin/cards?card=${id}` : "/admin/cards", { scroll: false });

  async function reorder(parentId: number | null, orderedIds: number[]) {
    try {
      await reorderCards(parentId, orderedIds);
      await refresh();
    } catch (err) {
      setError(requestErrorMessage(err, "تغییر ترتیب انجام نشد."));
    }
  }

  function applySaved(saved: PortalCardAdminDetail) {
    setDetail(saved);
    void refresh();
  }

  const contentTab = detail?.kind === "form" ? "فیلدهای فرم" : detail?.kind === "document" ? "متن و فایل‌ها" : null;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">مدیریت کارت‌های صفحه اصلی</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          کارت جدید بسازید، داخل آن کارت یا فرم یا مستند اضافه کنید و ترتیب نمایش را تعیین کنید.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="h-fit rounded-3xl border border-primary/15 bg-card p-4 shadow-sm">
          <CardTree
            nodes={tree}
            selectedId={selectedId}
            onSelect={(id) => {
              setTab("info");
              select(id);
            }}
            onAdd={(parentId) => setCreating({ parentId })}
            onAddRoot={() => setCreating({ parentId: null })}
            onReorder={reorder}
          />
        </aside>

        <section className="min-w-0 rounded-3xl border border-primary/15 bg-card p-5 shadow-sm">
          {!detail ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              یک کارت را از فهرست انتخاب کنید یا کارت تازه‌ای بسازید.
            </p>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">{detail.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {CARD_KIND_LABELS[detail.kind]}
                  {detail.parent_id !== null && ` · داخل «${parentLabel(cards, detail.parent_id)}»`}
                </p>
              </div>

              {contentTab && (
                <div className="flex gap-2 border-b pb-3">
                  <Button type="button" size="sm" variant={tab === "info" ? "default" : "outline"} onClick={() => setTab("info")}>
                    اطلاعات کارت
                  </Button>
                  <Button type="button" size="sm" variant={tab === "content" ? "default" : "outline"} onClick={() => setTab("content")}>
                    {contentTab}
                  </Button>
                </div>
              )}

              {tab === "info" || !contentTab ? (
                <CardBasicsEditor
                  key={detail.id}
                  card={detail}
                  allCards={cards}
                  onSaved={applySaved}
                  onDeleted={() => {
                    setDetail(null);
                    select(null);
                    void refresh();
                  }}
                />
              ) : detail.kind === "form" ? (
                <FormBuilder key={detail.id} card={detail} onSaved={applySaved} />
              ) : (
                <DocumentEditor key={detail.id} card={detail} onSaved={applySaved} />
              )}
            </div>
          )}
        </section>
      </div>

      {creating && (
        <CreateCardDialog
          parentId={creating.parentId}
          parentTitle={creating.parentId ? parentLabel(cards, creating.parentId) : null}
          onClose={() => setCreating(null)}
          onCreated={(created) => {
            setCreating(null);
            applySaved(created);
            select(created.id);
            setTab(created.kind === "group" ? "info" : "content");
          }}
        />
      )}
    </AppShell>
  );
}
