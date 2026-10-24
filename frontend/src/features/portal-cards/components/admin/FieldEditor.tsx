"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { FIELD_TYPE_LABELS, type CardFieldType, type CardFormField } from "../../types";
import { newColumnKey } from "./builderUtils";

type Props = {
  field: CardFormField;
  /** Select fields placed before this one; they can control its visibility. */
  controllers: CardFormField[];
  isFirst: boolean;
  isLast: boolean;
  onChange: (field: CardFormField) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
};

const TYPE_OPTIONS = Object.entries(FIELD_TYPE_LABELS) as [CardFieldType, string][];

export default function FieldEditor({
  field,
  controllers,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: Props) {
  const [optionsText, setOptionsText] = useState(() =>
    field.options.map((option) => option.label).join("\n"),
  );
  const patch = (changes: Partial<CardFormField>) => onChange({ ...field, ...changes });

  function changeType(type: CardFieldType) {
    patch({
      type,
      columns: type === "table" && field.columns.length === 0
        ? [{ key: newColumnKey(), title: "" }]
        : field.columns,
    });
  }

  function changeOptions(text: string) {
    setOptionsText(text);
    const options = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ label: line, value: line }));
    patch({ options });
  }

  function changeController(name: string) {
    patch({ visible_when_field: name || null, visible_when_value: null });
  }

  const controller = controllers.find((item) => item.name === field.visible_when_field);

  return (
    <div className="space-y-3 rounded-2xl border bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
        <div className="space-y-1">
          <Label>عنوان فیلد</Label>
          <Input
            value={field.label}
            maxLength={120}
            placeholder="مثلاً: نام و نام خانوادگی"
            onChange={(event) => patch({ label: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>نوع فیلد</Label>
          <NativeSelect
            className="w-full"
            value={field.type}
            onChange={(event) => changeType(event.target.value as CardFieldType)}
          >
            {TYPE_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {field.type === "select" && (
        <div className="space-y-1">
          <Label>گزینه‌ها (هر گزینه در یک خط)</Label>
          <Textarea
            rows={4}
            value={optionsText}
            onChange={(event) => changeOptions(event.target.value)}
          />
        </div>
      )}

      {field.type === "table" && (
        <div className="space-y-2">
          <Label>ستون‌های جدول</Label>
          {field.columns.map((column, index) => (
            <div key={column.key} className="flex gap-2">
              <Input
                value={column.title}
                maxLength={80}
                placeholder={`ستون ${(index + 1).toLocaleString("fa-IR")}`}
                onChange={(event) =>
                  patch({
                    columns: field.columns.map((item) =>
                      item.key === column.key ? { ...item, title: event.target.value } : item,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="حذف ستون"
                disabled={field.columns.length <= 1}
                onClick={() =>
                  patch({ columns: field.columns.filter((item) => item.key !== column.key) })
                }
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={field.columns.length >= 12}
            onClick={() => patch({ columns: [...field.columns, { key: newColumnKey(), title: "" }] })}
          >
            <Plus /> افزودن ستون
          </Button>
        </div>
      )}

      {controllers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>نمایش فقط وقتی…</Label>
            <NativeSelect
              className="w-full"
              value={field.visible_when_field ?? ""}
              onChange={(event) => changeController(event.target.value)}
            >
              <option value="">همیشه نمایش داده شود</option>
              {controllers.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.label || "بدون عنوان"}
                </option>
              ))}
            </NativeSelect>
          </div>
          {controller && (
            <div className="space-y-1">
              <Label>برابر با</Label>
              <NativeSelect
                className="w-full"
                value={field.visible_when_value ?? ""}
                onChange={(event) => patch({ visible_when_value: event.target.value || null })}
              >
                <option value="">انتخاب کنید</option>
                {controller.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={field.required}
            onCheckedChange={(checked) => patch({ required: checked === true })}
          />
          الزامی
        </label>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="بالا" disabled={isFirst} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="پایین" disabled={isLast} onClick={() => onMove(1)}>
            <ArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="حذف فیلد" onClick={onRemove}>
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
