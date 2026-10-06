"use client";

import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { formatNumber } from "@/utils/format";
import type { SortDir } from "@/hooks/useTable";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>;
}

export function Th({
  children,
  sortKey,
  sort,
  onSort,
  className,
  ...rest
}: {
  children: ReactNode;
  sortKey?: string;
  sort?: { key: string; dir: SortDir } | null;
  onSort?: (key: string) => void;
  className?: string;
} & ThHTMLAttributes<HTMLTableCellElement>) {
  const active = sortKey && sort?.key === sortKey;
  return (
    <th className={cn("whitespace-nowrap px-3 py-2.5", className)} {...rest}>
      {sortKey && onSort ? (
        <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-slate-800">
          {children}
          {active ? (
            sort?.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({
  children,
  className,
  colSpan,
  ...rest
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
} & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-2.5 align-middle text-slate-700", className)} {...rest}>
      {children}
    </td>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize?: (s: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 print:hidden">
      <div className="flex items-center gap-2">
        <span>
          {formatNumber(from)}–{formatNumber(to)} / {formatNumber(total)}
        </span>
        {onPageSize && (
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
            aria-label="Số dòng mỗi trang"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / trang
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2">
          Trang {page} / {totalPages}
        </span>
        <button
          className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
