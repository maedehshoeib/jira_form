import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AppShell from "../../components/layout/AppShell";
import client from "../../api/client";
import { endpoints } from "../../api/endpoints";
import { API_BASE } from "../../config/portal";
import { Button } from "../../components/ui/button";
import { Download } from "lucide-react";

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

export default function ContractList() {
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    client
      .get(endpoints.contracts)
      .then((res) => setContracts(res.data))
      .catch(() => setError("خطا در بارگذاری فهرست قراردادها"))
      .finally(() => setLoading(false));
  }, []);

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
            to="/contracts-archive"
            className="font-semibold text-red-600 hover:text-red-700"
          >
            بازگشت
          </Link>
          <Link to="/contracts-archive/submit">
            <Button className="rounded-xl bg-red-600 hover:bg-red-700">
              ثبت قرارداد جدید
            </Button>
          </Link>
        </div>

        <h1 className="mt-8 text-3xl font-bold">گزارش قراردادها</h1>
        <p className="mt-2 text-slate-500">
          فهرست قراردادهای آرشیو شده
        </p>

        {loading && (
          <p className="mt-10 text-slate-500">در حال بارگذاری...</p>
        )}

        {error && (
          <p className="mt-10 text-red-600">{error}</p>
        )}

        {!loading && !error && contracts.length === 0 && (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            هنوز قراردادی ثبت نشده است.
          </div>
        )}

        {!loading && !error && contracts.length > 0 && (
          <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-700">
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
                {contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    className="border-t border-slate-100 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3 font-semibold text-red-600">
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
                        <button
                          type="button"
                          onClick={() => downloadAttachment(contract.id)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <Download size={16} />
                          {contract.attachment_name || "دانلود"}
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{contract.created_by_name}</td>
                    <td className="px-4 py-3">{contract.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
