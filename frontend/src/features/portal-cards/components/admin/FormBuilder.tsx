"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { requestErrorMessage, saveCardForm } from "../../api";
import type { CardFormField, CardFormSchema, CardFormSection, PortalCardAdminDetail } from "../../types";
import { createField, createSection, emptySchema, moveItem, validateSchema } from "./builderUtils";
import FieldEditor from "./FieldEditor";

type Props = {
  card: PortalCardAdminDetail;
  onSaved: (card: PortalCardAdminDetail) => void;
};

export default function FormBuilder({ card, onSaved }: Props) {
  const [schema, setSchema] = useState<CardFormSchema>(() => card.form_schema ?? emptySchema());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function update(next: CardFormSchema) {
    setSchema(next);
    setNotice("");
  }

  const updateSection = (index: number, section: CardFormSection) =>
    update({ sections: schema.sections.map((item, i) => (i === index ? section : item)) });

  const updateField = (sIndex: number, fIndex: number, field: CardFormField) =>
    updateSection(sIndex, {
      ...schema.sections[sIndex],
      fields: schema.sections[sIndex].fields.map((item, i) => (i === fIndex ? field : item)),
    });

  function removeField(sIndex: number, fIndex: number) {
    const removed = schema.sections[sIndex].fields[fIndex];
    update({
      sections: schema.sections.map((section, i) => ({
        ...section,
        fields: section.fields
          .filter((_, j) => !(i === sIndex && j === fIndex))
          .map((field) =>
            field.visible_when_field === removed.name
              ? { ...field, visible_when_field: null, visible_when_value: null }
              : field,
          ),
      })),
    });
  }

  /** Select fields positioned before the given field (any earlier section or field). */
  function controllersFor(sIndex: number, fIndex: number) {
    const earlier: CardFormField[] = [];
    schema.sections.forEach((section, i) => {
      section.fields.forEach((field, j) => {
        if ((i < sIndex || (i === sIndex && j < fIndex)) && field.type === "select") {
          earlier.push(field);
        }
      });
    });
    return earlier;
  }

  async function save() {
    const problem = validateSchema(schema);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveCardForm(card.id, schema);
      onSaved(saved);
      setSchema(saved.form_schema ?? schema);
      setNotice("فرم ذخیره شد.");
    } catch (err) {
      setError(requestErrorMessage(err, "ذخیره فرم انجام نشد."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {schema.sections.map((section, sIndex) => (
        <section key={section.id} className="space-y-3 rounded-3xl border border-primary/15 bg-card p-4 shadow-sm">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label>عنوان بخش {(sIndex + 1).toLocaleString("fa-IR")}</Label>
              <Input
                value={section.title}
                maxLength={120}
                placeholder="مثلاً: اطلاعات متقاضی"
                onChange={(event) => updateSection(sIndex, { ...section, title: event.target.value })}
              />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="بالا" disabled={sIndex === 0}
              onClick={() => update({ sections: moveItem(schema.sections, sIndex, -1) })}>
              <ArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="پایین" disabled={sIndex === schema.sections.length - 1}
              onClick={() => update({ sections: moveItem(schema.sections, sIndex, 1) })}>
              <ArrowDown />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="حذف بخش" disabled={schema.sections.length <= 1}
              onClick={() => update({ sections: schema.sections.filter((_, i) => i !== sIndex) })}>
              <Trash2 className="text-destructive" />
            </Button>
          </div>

          {section.fields.map((field, fIndex) => (
            <FieldEditor
              key={field.name}
              field={field}
              controllers={controllersFor(sIndex, fIndex)}
              isFirst={fIndex === 0}
              isLast={fIndex === section.fields.length - 1}
              onChange={(next) => updateField(sIndex, fIndex, next)}
              onMove={(delta) => updateSection(sIndex, { ...section, fields: moveItem(section.fields, fIndex, delta) })}
              onRemove={() => removeField(sIndex, fIndex)}
            />
          ))}

          <Button type="button" variant="outline" size="sm"
            onClick={() => updateSection(sIndex, { ...section, fields: [...section.fields, createField()] })}>
            <Plus /> افزودن فیلد
          </Button>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => update({ sections: [...schema.sections, createSection()] })}>
          <Plus /> افزودن بخش
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} ذخیره فرم
        </Button>
        {notice && <span className="text-sm text-emerald-600">{notice}</span>}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
