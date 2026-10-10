"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const DEFAULT_PAGE_SIZE = 20;

export function paginateItems<T>(items: T[], page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    pageCount,
    safePage,
    total,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, total),
  };
}

type LetterListPaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
};

export function LetterListPagination({
  page,
  pageCount,
  total,
  rangeStart,
  rangeEnd,
  onPageChange,
}: LetterListPaginationProps) {
  if (total <= DEFAULT_PAGE_SIZE) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        نمایش {rangeStart.toLocaleString("fa-IR")} تا {rangeEnd.toLocaleString("fa-IR")} از{" "}
        {total.toLocaleString("fa-IR")}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 gap-1 rounded-lg px-2 font-bold"
          aria-label="صفحه قبلی"
        >
          <ChevronRight size={14} />
          قبلی
        </Button>
        <span className="min-w-16 text-center font-bold text-foreground">
          {page.toLocaleString("fa-IR")} / {pageCount.toLocaleString("fa-IR")}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="h-8 gap-1 rounded-lg px-2 font-bold"
          aria-label="صفحه بعدی"
        >
          بعدی
          <ChevronLeft size={14} />
        </Button>
      </div>
    </div>
  );
}

export { DEFAULT_PAGE_SIZE as LETTER_LIST_PAGE_SIZE };
