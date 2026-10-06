"use client";

import { useCallback } from "react";
import { findBookByCode } from "@/services/book.service";
import type { Book } from "@/types";
import { useBooks } from "./useRealtime";

/** Tra cứu sách theo mã quét: barcode → mã sách → ISBN (cache realtime trước, sau đó truy vấn Firestore) */
export function useBookLookup() {
  const { data: books } = useBooks();
  return useCallback(
    async (code: string): Promise<Book | null> => {
      const v = code.trim();
      const upper = v.toUpperCase();
      const local =
        books.find((b) => b.barcode?.toUpperCase() === upper) ??
        books.find((b) => b.bookCode?.toUpperCase() === upper) ??
        books.find((b) => b.isbn && b.isbn.replace(/-/g, "") === v.replace(/-/g, ""));
      if (local) return local;
      return findBookByCode(v);
    },
    [books],
  );
}
