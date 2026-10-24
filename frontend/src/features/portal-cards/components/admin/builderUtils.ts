import type {
  CardFieldType,
  CardFormField,
  CardFormSchema,
  CardFormSection,
} from "../../types";

function randomToken(length = 6) {
  let token = "";
  while (token.length < length) {
    token += Math.random().toString(36).slice(2);
  }
  return token.slice(0, length);
}

export const newFieldName = () => `f_${randomToken()}`;
export const newSectionId = () => `s_${randomToken()}`;
export const newColumnKey = () => `c_${randomToken()}`;

export function createField(type: CardFieldType = "text"): CardFormField {
  return {
    name: newFieldName(),
    label: "",
    type,
    required: false,
    placeholder: null,
    options: [],
    columns: type === "table" ? [{ key: newColumnKey(), title: "" }] : [],
    initial_rows: 1,
    visible_when_field: null,
    visible_when_value: null,
  };
}

export function createSection(): CardFormSection {
  return { id: newSectionId(), title: "", fields: [createField()] };
}

export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function emptySchema(): CardFormSchema {
  return { sections: [createSection()] };
}

/** Returns a Persian message for the first problem found, or null when valid. */
export function validateSchema(schema: CardFormSchema): string | null {
  if (schema.sections.length === 0) return "حداقل یک بخش لازم است.";
  const seen = new Map<string, CardFormField>();
  for (const [sIndex, section] of schema.sections.entries()) {
    if (!section.title.trim()) return `عنوان بخش ${sIndex + 1} را وارد کنید.`;
    if (section.fields.length === 0) return `بخش «${section.title}» باید حداقل یک فیلد داشته باشد.`;
    for (const field of section.fields) {
      const name = field.label.trim() || "بدون عنوان";
      if (!field.label.trim()) return `در بخش «${section.title}» عنوان همه فیلدها را وارد کنید.`;
      if (field.type === "select") {
        const values = field.options.map((o) => o.value.trim());
        if (values.length === 0 || values.some((v) => !v)) {
          return `برای فیلد «${name}» حداقل یک گزینه تعریف کنید.`;
        }
        if (new Set(values).size !== values.length) {
          return `گزینه‌های فیلد «${name}» نباید تکراری باشد.`;
        }
      }
      if (field.type === "table") {
        if (field.columns.length === 0 || field.columns.some((c) => !c.title.trim())) {
          return `برای جدول «${name}» عنوان همه ستون‌ها را وارد کنید.`;
        }
      }
      if (field.visible_when_field && !field.visible_when_value) {
        return `برای شرط نمایش فیلد «${name}» یک مقدار انتخاب کنید.`;
      }
      if (field.visible_when_field) {
        const controller = seen.get(field.visible_when_field);
        const valid =
          controller?.type === "select" &&
          controller.options.some((option) => option.value === field.visible_when_value);
        if (!valid) {
          return `شرط نمایش فیلد «${name}» باید به یکی از گزینه‌های یک لیست انتخابیِ قبل از آن اشاره کند.`;
        }
      }
      seen.set(field.name, field);
    }
  }
  return null;
}
