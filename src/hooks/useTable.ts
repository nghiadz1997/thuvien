"use client";

import { useEffect, useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export interface UseTableOptions<T> {
  pageSize?: number;
  initialSort?: { key: string; dir: SortDir };
  accessors?: Record<string, (row: T) => string | number | null | undefined>;
}

/** Sắp xếp + phân trang phía client cho bảng dữ liệu */
export function useTable<T>(rows: T[], options: UseTableOptions<T> = {}) {
  const { pageSize: initialPageSize = 20, initialSort, accessors = {} } = options;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = accessors[sort.key] ?? ((r: T) => (r as Record<string, unknown>)[sort.key] as string | number);
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined || va === "") return 1;
      if (vb === null || vb === undefined || vb === "") return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "vi", { numeric: true }) * factor;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize]);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  return { page, setPage, pageSize, setPageSize, totalPages, pageRows, sorted, sort, toggleSort, total: rows.length };
}
