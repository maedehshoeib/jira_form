/** Strip bidi/BOM marks that can blank a title. Keep ZWNJ/ZWJ for Persian. */
export function cleanDisplayText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/[\u200b\u200e\u200f\u202a-\u202e\ufeff]/g, "")
    .trim();
}

/** True when text has visible glyphs (ignores ZWNJ/ZWJ-only strings). */
export function hasVisibleText(value: string | null | undefined) {
  return cleanDisplayText(value).replace(/[\u200c\u200d]/g, "").trim().length > 0;
}

type SubmissionTitleSource = {
  subject?: string | null;
  section_title?: string | null;
  form_title?: string | null;
  data?: Record<string, unknown>;
};

/** Card/list title: subject → data.subject → section → form → fallback. */
export function submissionDisplayTitle(
  item: SubmissionTitleSource,
  fallback = "بدون عنوان",
) {
  const subject = cleanDisplayText(item.subject);
  if (hasVisibleText(subject)) return subject;

  const dataSubject = cleanDisplayText(
    typeof item.data?.subject === "string" ? item.data.subject : "",
  );
  if (hasVisibleText(dataSubject)) return dataSubject;

  const section = cleanDisplayText(item.section_title);
  if (hasVisibleText(section)) return section;

  const formTitle = cleanDisplayText(item.form_title);
  if (hasVisibleText(formTitle)) return formTitle;

  return fallback;
}
