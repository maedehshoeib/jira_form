"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

import { groupErrorMessage, listRecipientGroups } from "../api";
import type { RecipientGroup, RecipientGroupPerson } from "../types";
import { toggleGroupMembers } from "../types";
import { RecipientGroupEditor } from "./RecipientGroupEditor";

type RecipientGroupBarProps = {
  people: RecipientGroupPerson[];
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  disabled?: boolean;
};

export function RecipientGroupBar({
  people,
  selectedIds,
  onSelectedIdsChange,
  disabled = false,
}: RecipientGroupBarProps) {
  const [groups, setGroups] = useState<RecipientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<RecipientGroup | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    return listRecipientGroups()
      .then((data) => {
        setGroups(data);
        setError("");
      })
      .catch((err: unknown) => {
        setError(groupErrorMessage(err, "دریافت گروه‌ها با مشکل مواجه شد."));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    listRecipientGroups()
      .then((data) => {
        if (cancelled) return;
        setGroups(data);
        setError("");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(groupErrorMessage(err, "دریافت گروه‌ها با مشکل مواجه شد."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableIds = useMemo(
    () => new Set(people.map((person) => person.id)),
    [people],
  );

  const applyGroup = (group: RecipientGroup) => {
    const { nextIds, eligibleIds } = toggleGroupMembers(
      selectedIds,
      group.members.map((member) => member.id),
      availableIds,
    );
    if (eligibleIds.length === 0) {
      setNotice("هیچ‌کدام از اعضای این گروه در این فهرست نیستند.");
      return;
    }
    setNotice("");
    onSelectedIdsChange(nextIds);
  };

  const openEditor = (group: RecipientGroup | null) => {
    setEditing(group);
    setEditorOpen(true);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          گروه‌ها
        </span>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          groups.map((group) => {
            const eligible = group.members.filter((member) => availableIds.has(member.id));
            const active =
              eligible.length > 0 &&
              eligible.every((member) => selectedIds.includes(member.id));
            return (
              <span
                key={group.id}
                className={`inline-flex items-center rounded-full border ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground"
                }`}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={disabled}
                  onClick={() => applyGroup(group)}
                  className={`rounded-full px-2.5 hover:bg-transparent ${
                    active ? "text-primary-foreground hover:text-primary-foreground" : ""
                  }`}
                  title="انتخاب همه اعضای گروه"
                >
                  {group.name}
                  <span className="opacity-80">
                    {eligible.length.toLocaleString("fa-IR")}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled}
                  onClick={() => openEditor(group)}
                  aria-label={`ویرایش گروه ${group.name}`}
                  className={`rounded-full ${
                    active ? "text-primary-foreground hover:text-primary-foreground" : ""
                  }`}
                >
                  <Pencil />
                </Button>
              </span>
            );
          })
        )}
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={disabled || people.length === 0}
          onClick={() => openEditor(null)}
          className="rounded-full"
        >
          <Plus />
          گروه جدید
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        یک کلیک، همه اعضای گروه را انتخاب می‌کند و کلیک دوباره همان افراد را برمی‌دارد.
      </p>
      {notice && <p className="text-xs font-semibold text-primary">{notice}</p>}
      {error && (
        <p role="alert" className="text-xs font-semibold text-primary">
          {error}
        </p>
      )}
      {editorOpen && (
        <RecipientGroupEditor
          key={editing?.id ?? "new"}
          open={editorOpen}
          people={people}
          group={editing}
          onOpenChange={setEditorOpen}
          onSaved={() => void reload()}
        />
      )}
    </div>
  );
}
