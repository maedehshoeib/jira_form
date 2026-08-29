import { Table } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AppShell from "@/components/layout/AppShell";
import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { API_BASE } from "@/config/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search } from "lucide-react";
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { formatPersianDateTime } from "@/lib/persianDate";

type ContractItem = {
  id: number;
  row_number: number;
  start_date: string;
  end_date: string;
  subject: string;
  contract_party: string;
  contract_type_label: string;
  contract_number: string;
  attachment_name: string | null;
  has_attachment: boolean;
  created_by_name: string;
  created_at: string;
};

function contractSearchText(contract: ContractItem): string {
  return [
    contract.row_number,
    contract.subject,
    contract.contract_party,
    contract.contract_type_label,
    contract.contract_number,
    contract.attachment_name,
    contract.has_attachment ? "پیوست" : "",
    contract.created_by_name,
    contract.created_at,
    formatPersianDateTime(contract.created_at),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesDateField(value: string, query: string): boolean {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return true;
  return value === normalizedQuery;
}

const datePickerInputClass = `
  w-full
  h-11
  rounded-xl
  border
  border-border
  bg-muted/40
  px-4
  text-right
  shadow-sm
`;

export default function ContractList() {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDateQuery, setStartDateQuery] = useState("");
  const [endDateQuery, setEndDateQuery] = useState("");

  useEffect(() => {
    client
      .get(endpoints.contracts)
      .then((res) => setContracts(res.data))
      .catch(() => setError("خطا در بارگذاری فهرست قراردادها"))
      .finally(() => setLoading(false));
  }, []);

  const filteredContracts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return contracts.filter((contract) => {
      const matchesText = !query || contractSearchText(contract).includes(query);
      const matchesStartDate = matchesDateField(contract.start_date, startDateQuery);
      const matchesEndDate = matchesDateField(contract.end_date, endDateQuery);
      return matchesText && matchesStartDate && matchesEndDate;
    });
  }, [contracts, searchQuery, startDateQuery, endDateQuery]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(startDateQuery.trim()) ||
    Boolean(endDateQuery.trim());

  const downloadAttachment = async (contractId: number) => {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${API_BASE}/contracts/${contractId}/attachment`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;

    const blob = await res.blob();
    const contract = contracts.find((c) => c.id === contractId);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = contract?.attachment_name || "attachment";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/contracts-archive"
            className="font-semibold text-primary hover:text-primary"
          >
            بازگشت
          </Link>
          <Link href="/contracts-archive/submit">
            <Button className="rounded-xl bg-primary hover:bg-primary/90">
              ثبت قرارداد جدید
            </Button>
          </Link>
        </div>

        <h1 className="mt-8 text-3xl font-bold">گزارش قراردادها</h1>
        <p className="mt-2 text-muted-foreground">
          فهرست قراردادهای آرشیو شده
        </p>

        {loading && (
          <p className="mt-10 text-muted-foreground">در حال بارگذاری...</p>
        )}

        {error && (
          <p className="mt-10 text-primary">{error}</p>
        )}

        {!loading && !error && contracts.length === 0 && (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            هنوز قراردادی ثبت نشده است.
          </div>
        )}

        {!loading && !error && contracts.length > 0 && (
          <>
            <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-1">
                  <Label htmlFor="contract-search" className="mb-2 block text-sm font-medium text-foreground">
                    جستجو
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="contract-search"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ردیف، موضوع، طرف قرارداد، شماره، ثبت‌کننده و ..."
                      className="h-11 rounded-xl pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label className="mb-2 block text-sm font-medium text-foreground">
                    تاریخ شروع
                  </Label>
                  <DatePicker
                    calendar={persian}
                    locale={persian_fa}
                    value={startDateQuery || undefined}
                    onChange={(date) =>
                      setStartDateQuery(date?.format?.("YYYY/MM/DD") ?? "")
                    }
                    inputClass={datePickerInputClass}
                    calendarPosition="bottom-right"
                    placeholder="انتخاب تاریخ شروع"
                  />
                </div>

                <div>
                  <Label className="mb-2 block text-sm font-medium text-foreground">
                    تاریخ پایان
                  </Label>
                  <DatePicker
                    calendar={persian}
                    locale={persian_fa}
                    value={endDateQuery || undefined}
                    onChange={(date) =>
                      setEndDateQuery(date?.format?.("YYYY/MM/DD") ?? "")
                    }
                    inputClass={datePickerInputClass}
                    calendarPosition="bottom-right"
                    placeholder="انتخاب تاریخ پایان"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {filteredContracts.length} مورد از {contracts.length} قرارداد
                </p>
              )}
            </div>

            {filteredContracts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
                {hasActiveFilters
                  ? "نتیجه‌ای با فیلترهای انتخاب‌شده یافت نشد."
                  : "هنوز قراردادی ثبت نشده است."}
              </div>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <Table className="min-w-full text-right text-sm">
                  <thead className="bg-muted/40 text-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">ردیف</th>
                      <th className="px-4 py-3 font-semibold">تاریخ شروع</th>
                      <th className="px-4 py-3 font-semibold">تاریخ پایان</th>
                      <th className="px-4 py-3 font-semibold">موضوع قرارداد</th>
                      <th className="px-4 py-3 font-semibold">طرف قرارداد</th>
                      <th className="px-4 py-3 font-semibold">نوع قرارداد</th>
                      <th className="px-4 py-3 font-semibold">شماره قرارداد</th>
                      <th className="px-4 py-3 font-semibold">پیوست</th>
                      <th className="px-4 py-3 font-semibold">ثبت‌کننده</th>
                      <th className="px-4 py-3 font-semibold">تاریخ ثبت در سامانه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.map((contract) => (
                      <tr
                        key={contract.id}
                        className="border-t border-border hover:bg-muted/40"
                      >
                        <td className="px-4 py-3 font-semibold text-primary">
                          {contract.row_number}
                        </td>
                        <td className="px-4 py-3">{contract.start_date}</td>
                        <td className="px-4 py-3">{contract.end_date}</td>
                        <td className="max-w-xs px-4 py-3">{contract.subject}</td>
                        <td className="px-4 py-3">{contract.contract_party}</td>
                        <td className="px-4 py-3">{contract.contract_type_label}</td>
                        <td className="px-4 py-3">{contract.contract_number}</td>
                        <td className="px-4 py-3">
                          {contract.has_attachment ? (
                            <Button
                              type="button"
                              onClick={() => downloadAttachment(contract.id)}
                              className="inline-flex items-center gap-1 text-primary hover:text-primary"
                            >
                              <Download size={16} />
                              {contract.attachment_name || "دانلود"}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{contract.created_by_name}</td>
                        <td className="px-4 py-3">
                          {formatPersianDateTime(contract.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
