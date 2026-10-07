export type LetterType = "internal" | "external";

type LetterWorkflowConfig = {
  type: LetterType;
  accessDepartmentId: string;
  title: string;
  sendTitle: string;
  reportTitle: string;
  description: string;
  numberExample: string;
};

export const LETTERS_HOME_PATH = "/my-letters";

export function letterComposeHref(letterType: LetterType, draftId?: number | string | null) {
  const params = new URLSearchParams({ compose: letterType });
  if (draftId) params.set("draft", String(draftId));
  return `${LETTERS_HOME_PATH}?${params.toString()}`;
}

export function letterReportHref(letterType: LetterType) {
  return `${LETTERS_HOME_PATH}?report=${letterType}`;
}

export const LETTER_WORKFLOWS: Record<LetterType, LetterWorkflowConfig> = {
  external: {
    type: "external",
    accessDepartmentId: "management-workflow",
    title: "\u0646\u0627\u0645\u0647\u200c\u0647\u0627\u06cc \u0628\u0631\u0648\u0646\u200c\u0633\u0627\u0632\u0645\u0627\u0646\u06cc",
    sendTitle: "\u0627\u0631\u0633\u0627\u0644 \u0646\u0627\u0645\u0647 \u0628\u0631\u0648\u0646\u200c\u0633\u0627\u0632\u0645\u0627\u0646\u06cc",
    reportTitle: "\u06af\u0632\u0627\u0631\u0634 \u0646\u0627\u0645\u0647\u200c\u0647\u0627\u06cc \u0628\u0631\u0648\u0646\u200c\u0633\u0627\u0632\u0645\u0627\u0646\u06cc",
    description: "\u0627\u0631\u0633\u0627\u0644 \u0648 \u067e\u06cc\u06af\u06cc\u0631\u06cc \u0646\u0627\u0645\u0647\u200c\u0647\u0627\u06cc \u0628\u0631\u0648\u0646\u200c\u0633\u0627\u0632\u0645\u0627\u0646\u06cc",
    numberExample: "1001/\u0628",
  },
  internal: {
    type: "internal",
    accessDepartmentId: "internal-letters",
    title: "\u0646\u0627\u0645\u0647\u200c\u0647\u0627\u06cc \u062f\u0631\u0648\u0646\u200c\u0633\u0627\u0632\u0645\u0627\u0646\u06cc",
    sendTitle: "\u0627\u0631\u0633\u0627\u0644 \u0646\u0627\u0645\u0647 \u062f\u0631\u0648\u0646\u200c\u0633\u0627\u0632\u0645\u0627\u0646\u06cc",
    reportTitle: "\u06af\u0632\u0627\u0631\u0634 \u0646\u0627\u0645\u0647\u200c\u0647\u0627\u06cc \u062f\u0631\u0648\u0646\u200c\u0633\u0627\u0632\u0645\u0627\u0646\u06cc",
    description: "\u0627\u0631\u0633\u0627\u0644 \u0648 \u067e\u06cc\u06af\u06cc\u0631\u06cc \u0646\u0627\u0645\u0647\u200c\u0647\u0627\u06cc \u062f\u0631\u0648\u0646\u200c\u0633\u0627\u0632\u0645\u0627\u0646\u06cc",
    numberExample: "1001/\u062f",
  },
};
