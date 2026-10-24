"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Loader2, Save, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { deleteCard, moveCard, requestErrorMessage, updateCard } from "../../api";
import type { PortalCardAdminDetail, PortalCardSummary } from "../../types";
import LogoPicker from "./LogoPicker";
import { descendantIds, parentLabel } from "./treeUtils";

type Props = {
  card: PortalCardAdminDetail;
  allCards: PortalCardSummary[];
  onSaved: (card: PortalCardAdminDetail) => void;
  onDeleted: () => void;
};

export default function CardBasicsEditor({ card, allCards, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [published, setPublished] = useState(card.is_published);
  const [logo, setLogo] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [parentId, setParentId] = useState(card.parent_id === null ? "" : String(card.parent_id));
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const parentOptions = useMemo(() => {
    const blocked = descendantIds(allCards, card.id);
    blocked.add(card.id);
    return allCards.filter((item) => item.kind === "group" && !blocked.has(item.id));
  }, [allCards, card.id]);

  async function save() {
    if (!title.trim()) {
      setError("عنوان کارت را وارد کنید.");
      return;
    }
    setBusy("save");
    setError("");
    setNotice("");
    try {
      let saved = await updateCard(card.id, {
        title,
        description,
        is_published: published,
        logo,
        remove_logo: removeLogo,
      });
      const targetParent = parentId === "" ? null : Number(parentId);
      if (targetParent !== card.parent_id) {
        saved = await moveCard(card.id, targetParent);
      }
      setLogo(null);
      setRemoveLogo(false);
      setNotice("تغییرات ذخیره شد.");
      onSaved(saved);
    } catch (err) {
      setError(requestErrorMessage(err, "ذخیره تغییرات انجام نشد."));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const extra = card.kind === "group" ? " همه زیرمجموعه‌های آن نیز حذف می‌شود." : "";
    if (!window.confirm(`کارت «${card.title}» حذف شود؟${extra}`)) return;
    setBusy("delete");
    setError("");
    try {
      await deleteCard(card.id);
      onDeleted();
    } catch (err) {
      setError(requestErrorMessage(err, "حذف کارت انجام نشد."));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="card-title">عنوان</Label>
        <Input id="card-title" value={title} maxLength={128} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="card-description">توضیح کوتاه</Label>
        <Textarea
          id="card-description"
          rows={2}
          maxLength={512}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
      <LogoPicker
        currentUrl={card.logo_url}
        file={logo}
        removed={removeLogo}
        onFile={setLogo}
        onRemoveCurrent={setRemoveLogo}
      />
      <div className="space-y-1">
        <Label htmlFor="card-parent">محل قرارگیری</Label>
        <NativeSelect
          id="card-parent"
          className="w-full"
          value={parentId}
          onChange={(event) => setParentId(event.target.value)}
        >
          <option value="">صفحه اصلی</option>
          {parentOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {parentLabel(allCards, item.id)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={published} onCheckedChange={(checked) => setPublished(checked === true)} />
        نمایش برای کاربران (در حالت خاموش فقط مدیران آن را می‌بینند)
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} disabled={busy !== null}>
          {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />} ذخیره
        </Button>
        <Button asChild variant="outline">
          <Link href={`/cards/${card.id}`}>
            <ExternalLink /> مشاهده در پورتال
          </Link>
        </Button>
        <Button type="button" variant="destructive" className="ms-auto" onClick={remove} disabled={busy !== null}>
          {busy === "delete" ? <Loader2 className="animate-spin" /> : <Trash2 />} حذف
        </Button>
      </div>
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
