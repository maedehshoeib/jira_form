import vesoughLogo from "../../assets/vesough-logo.png";
import { assetUrl } from "../../lib/assetUrl";

type PurchaseItem = {
  item_title?: string;
  requested_quantity?: string;
  usage_reason?: string;
  technical_specs?: string;
  stock_quantity?: string;
  purchase_quantity?: string;
};

type Props = {
  data: Record<string, unknown>;
  editable?: boolean;
  onChange?: (name: string, value: unknown) => void;
};

const ITEM_KEYS: (keyof PurchaseItem)[] = [
  "item_title",
  "requested_quantity",
  "usage_reason",
  "technical_specs",
  "stock_quantity",
  "purchase_quantity",
];

const SIGNATURES = [
  ["requester_name", "requester_signature_date", "درخواست کننده"],
  ["approver_name", "approver_signature_date", "تایید کننده (معاونت یا مدیر مربوطه)"],
  ["procurement_name", "procurement_signature_date", "واحد تدارکات"],
  ["finance_name", "finance_signature_date", "** معاونت مالی/اقتصادی"],
  ["ceo_name", "ceo_signature_date", "** مدیرعامل و عضو هیات مدیره"],
] as const;

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function normalizedItems(value: unknown): PurchaseItem[] {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [];
    }
  }
  const rows = Array.isArray(parsed)
    ? parsed.filter((row): row is PurchaseItem => Boolean(row && typeof row === "object"))
    : [];
  return Array.from({ length: 9 }, (_, index) => ({ ...(rows[index] ?? {}) }));
}

export default function PurchaseRequestDocument({
  data,
  editable = false,
  onChange,
}: Props) {
  const items = normalizedItems(data.items);
  const setValue = (name: string, value: string) => onChange?.(name, value);
  const setItem = (rowIndex: number, key: keyof PurchaseItem, value: string) => {
    const next = items.map((row, index) =>
      index === rowIndex ? { ...row, [key]: value } : row,
    );
    onChange?.("items", next);
  };

  const fieldClass = editable
    ? "min-w-0 border-0 border-b border-dotted border-slate-500 bg-transparent px-1 py-0.5 text-right outline-none focus:border-red-600"
    : "min-w-0 border-0 bg-transparent px-1 py-0.5 text-right outline-none";

  return (
    <div className="overflow-x-auto rounded-2xl bg-slate-100 p-3 sm:p-5">
      <div
        dir="rtl"
        className="mx-auto min-w-[940px] max-w-[1040px] border border-slate-800 bg-white px-8 pb-7 pt-6 font-vazirmatn text-[12px] leading-5 text-slate-950 shadow-lg"
      >
        <table className="w-full table-fixed border-collapse text-center">
          <tbody>
            <tr>
              <td className="w-[27%] border border-slate-800 px-2 py-1 text-right">
                شماره مدرک: <span dir="ltr">EV-FF-FR-16</span>
              </td>
              <td rowSpan={4} className="w-[44%] border border-slate-800 text-xl font-bold text-red-600">
                فرم درخواست تامین کالا
              </td>
              <td rowSpan={4} className="w-[29%] border border-slate-800 p-2 align-middle">
                <img
                  src={assetUrl(vesoughLogo)}
                  alt="توسعه اعتماد وثوق گستر"
                  className="mx-auto h-[70px] max-w-[190px] object-contain"
                />
              </td>
            </tr>
            <tr><td className="border border-slate-800 px-2 py-1 text-right">شماره ویرایش: 01</td></tr>
            <tr><td className="border border-slate-800 px-2 py-1 text-right">تاریخ ویرایش: 13/05/1404</td></tr>
            <tr><td className="border border-slate-800 px-2 py-1 text-right">صفحه 2 از 7</td></tr>
          </tbody>
        </table>

        <div className="mt-7 space-y-3">
          <div className="flex items-center justify-between gap-12">
            <label className="flex w-[58%] items-center gap-2 font-semibold">
              <span className="shrink-0">واحد درخواست کننده:</span>
              <input
                aria-label="واحد درخواست کننده"
                value={text(data.requesting_unit)}
                readOnly={!editable}
                onChange={(event) => setValue("requesting_unit", event.target.value)}
                className={`${fieldClass} w-full`}
              />
            </label>
            <label className="flex w-[34%] items-center gap-2 font-semibold">
              <span className="shrink-0">شماره درخواست:</span>
              <input
                aria-label="شماره درخواست"
                value={text(data.request_number)}
                readOnly={!editable}
                onChange={(event) => setValue("request_number", event.target.value)}
                className={`${fieldClass} w-full`}
              />
            </label>
          </div>
          <label className="flex w-[42%] items-center gap-2 font-semibold">
            <span className="shrink-0">تاریخ درخواست:</span>
            <input
              aria-label="تاریخ درخواست"
              placeholder="____/__/__"
              value={text(data.request_date)}
              readOnly={!editable}
              onChange={(event) => setValue("request_date", event.target.value)}
              className={`${fieldClass} w-full`}
            />
          </label>
        </div>

        <table className="mt-5 w-full table-fixed border-collapse text-center">
          <thead className="bg-slate-200">
            <tr className="h-14">
              <th className="w-[6%] border border-slate-800 px-1">ردیف</th>
              <th className="w-[17%] border border-slate-800 px-1">عنوان کالا</th>
              <th className="w-[12%] border border-slate-800 px-1">تعداد درخواستی</th>
              <th className="w-[22%] border border-slate-800 px-1">علت / محل مصرف</th>
              <th className="w-[21%] border border-slate-800 px-1">مشخصات فنی / توضیحات</th>
              <th className="w-[10%] border border-slate-800 px-1">*تعداد موجودی</th>
              <th className="w-[12%] border border-slate-800 px-1">*تعداد مورد نیاز برای خرید</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, rowIndex) => (
              <tr key={rowIndex} className="h-12">
                <td className="border border-slate-800 bg-slate-200 font-semibold">{rowIndex + 1}</td>
                {ITEM_KEYS.map((key) => (
                  <td key={key} className="border border-slate-800 p-0.5">
                    <textarea
                      aria-label={`${key}-${rowIndex + 1}`}
                      value={text(row[key])}
                      readOnly={!editable}
                      onChange={(event) => setItem(rowIndex, key, event.target.value)}
                      className="block h-11 w-full resize-none border-0 bg-transparent px-1 py-1 text-center text-[11px] leading-4 outline-none focus:bg-red-50"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <table className="mt-4 w-full table-fixed border-collapse text-center">
          <tbody>
            <tr className="h-14 bg-slate-200">
              {SIGNATURES.map(([, , title]) => (
                <th key={title} className="border border-slate-800 px-2 align-middle">{title}</th>
              ))}
            </tr>
            <tr className="h-24">
              {SIGNATURES.map(([nameKey, dateKey]) => (
                <td key={nameKey} className="border border-slate-800 p-2 text-right align-top">
                  <label className="mb-2 flex items-center gap-1">
                    <span className="shrink-0">نام و نام خانوادگی:</span>
                    <input
                      value={text(data[nameKey])}
                      readOnly={!editable}
                      onChange={(event) => setValue(nameKey, event.target.value)}
                      className={`${fieldClass} w-full`}
                    />
                  </label>
                  <label className="flex items-center gap-1">
                    <span className="shrink-0">تاریخ و امضا:</span>
                    <input
                      value={text(data[dateKey])}
                      readOnly={!editable}
                      onChange={(event) => setValue(dateKey, event.target.value)}
                      className={`${fieldClass} w-full`}
                    />
                  </label>
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <div className="mt-3 space-y-1 text-right text-[11px] text-red-600">
          <p>• ستون‌های با علامت * توسط واحد تدارکات تکمیل می‌شود.</p>
          <p>• در صورت نیاز به خرید کالا، محل امضا با علامت ** توسط مسئولین مربوطه تکمیل می‌گردد.</p>
        </div>
      </div>
    </div>
  );
}
