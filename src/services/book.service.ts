import {
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { COLLECTIONS, DEFAULT_SETTINGS } from "@/lib/constants";
import { getDb, getFirebaseStorage } from "@/lib/firebase";
import { col, docRef, newDocRef, snapToData, type Actor } from "@/lib/firestore";
import type { Book, BookCounts, BookStatus } from "@/types";
import { applyDelta, countsOf } from "@/utils/integrity";
import { buildSearchText, padNumber } from "@/utils/text";
import { logInBatch, logInTransaction, newTransactionRef } from "./transaction.service";

export interface BookInput {
  title: string;
  author: string;
  categoryId: string;
  faculty: string;
  publisher: string;
  publishYear: number | null;
  isbn: string;
  dateAdded: Date;
  quantity: number;
  shelfLocation: string;
  notes: string;
  coverUrl?: string;
}

export type BookUpdateInput = Partial<
  Pick<
    Book,
    "title" | "author" | "categoryId" | "faculty" | "publisher" | "publishYear" | "isbn" | "shelfLocation" | "notes" | "coverUrl" | "status"
  >
> & { dateAdded?: Date };

const FIELD_LABELS: Record<string, string> = {
  title: "Tên sách",
  author: "Tác giả",
  categoryId: "Thể loại",
  faculty: "Khoa",
  publisher: "NXB",
  publishYear: "Năm XB",
  isbn: "ISBN",
  shelfLocation: "Vị trí kệ",
  notes: "Ghi chú",
  coverUrl: "Ảnh bìa",
  status: "Trạng thái",
  dateAdded: "Ngày nhập",
};

function bookSearchText(b: Pick<Book, "title" | "author" | "publisher" | "isbn" | "bookCode" | "barcode"> & { faculty?: string }) {
  return buildSearchText(b.title, b.author, b.publisher, b.isbn, b.bookCode, b.barcode, b.faculty);
}

/** Sinh mã sách: {prefix}-{năm}-{6 số}, ví dụ NSG-BK-2026-000001 */
export function formatBookCode(prefix: string, year: number, seq: number) {
  return `${prefix || DEFAULT_SETTINGS.barcodePrefix}-${year}-${padNumber(seq, 6)}`;
}

/**
 * Tạo đầu sách mới. Dùng Firestore transaction để:
 * - tăng bộ đếm mã sách (không trùng mã khi nhiều người thêm cùng lúc)
 * - tạo book
 * - ghi transaction log CREATE_BOOK
 */
export async function createBook(input: BookInput, actor: Actor, prefix: string): Promise<{ id: string; bookCode: string }> {
  if (!input.title.trim()) throw new Error("Vui lòng nhập tên sách.");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("Số lượng nhập phải là số nguyên ≥ 1.");
  const db = getDb();
  const year = new Date().getFullYear();
  const counterRef = docRef(COLLECTIONS.counters, `books_${year}`);
  const bookRef = newDocRef(COLLECTIONS.books);
  const txRef = newTransactionRef();

  return runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const seq = (counterSnap.exists() ? Number(counterSnap.data().seq) || 0 : 0) + 1;
    const bookCode = formatBookCode(prefix, year, seq);
    const counts: BookCounts = {
      quantityTotal: input.quantity,
      quantityAvailable: input.quantity,
      quantityBorrowed: 0,
      quantityDamaged: 0,
      quantityLost: 0,
    };
    const book = {
      bookCode,
      barcode: bookCode,
      title: input.title.trim(),
      author: input.author.trim(),
      categoryId: input.categoryId,
      faculty: input.faculty?.trim() || "Khác / Toàn trường",
      publisher: input.publisher.trim(),
      publishYear: input.publishYear,
      isbn: input.isbn.trim(),
      dateAdded: Timestamp.fromDate(input.dateAdded),
      ...counts,
      shelfLocation: input.shelfLocation.trim(),
      coverUrl: input.coverUrl ?? "",
      status: "active" as BookStatus,
      notes: input.notes.trim(),
      totalBorrowCount: 0,
      lastTransactionId: txRef.id,
      searchText: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actor.uid,
    };
    book.searchText = bookSearchText(book);

    if (counterSnap.exists()) tx.update(counterRef, { seq });
    else tx.set(counterRef, { seq });
    tx.set(bookRef, book);
    logInTransaction(
      tx,
      txRef,
      {
        type: "CREATE_BOOK",
        book: { id: bookRef.id, barcode: bookCode, title: book.title, categoryId: book.categoryId },
        quantity: input.quantity,
        before: null,
        after: counts,
        note: `Thêm đầu sách mới với ${input.quantity} cuốn`,
      },
      actor,
    );
    return { id: bookRef.id, bookCode };
  });
}

/** Cập nhật thông tin (không đổi số lượng) + ghi log UPDATE_BOOK */
export async function updateBook(bookId: string, changes: BookUpdateInput, actor: Actor) {
  const db = getDb();
  const ref = docRef(COLLECTIONS.books, bookId);
  const txRef = newTransactionRef();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Sách không tồn tại.");
    const book = snapToData<Book>(snap);
    const update: Record<string, unknown> = {};
    const changed: string[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      if (key === "dateAdded") {
        const ts = Timestamp.fromDate(value as Date);
        if (book.dateAdded?.toMillis() !== ts.toMillis()) {
          update.dateAdded = ts;
          changed.push(FIELD_LABELS.dateAdded);
        }
        continue;
      }
      const v = typeof value === "string" ? value.trim() : value;
      if ((book as unknown as Record<string, unknown>)[key] !== v) {
        update[key] = v;
        changed.push(FIELD_LABELS[key] ?? key);
      }
    }
    if (changed.length === 0) return;
    const merged = { ...book, ...update } as Book;
    update.searchText = bookSearchText(merged);
    update.updatedAt = serverTimestamp();
    update.lastTransactionId = txRef.id;
    tx.update(ref, update);
    const counts = countsOf(book);
    logInTransaction(
      tx,
      txRef,
      {
        type: "UPDATE_BOOK",
        book: { id: bookId, barcode: book.barcode, title: merged.title, categoryId: merged.categoryId },
        quantity: 0,
        before: counts,
        after: counts,
        note: `Cập nhật: ${changed.join(", ")}`,
      },
      actor,
    );
  });
}

/** Nhập bổ sung sách đã tồn tại: tăng total + available, ghi log IMPORT */
export async function importStock(bookId: string, quantity: number, actor: Actor, note = "") {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Số lượng nhập phải là số nguyên ≥ 1.");
  const db = getDb();
  const ref = docRef(COLLECTIONS.books, bookId);
  const txRef = newTransactionRef();
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Sách không tồn tại.");
    const book = snapToData<Book>(snap);
    const before = countsOf(book);
    const after = applyDelta(before, { quantityTotal: quantity, quantityAvailable: quantity });
    tx.update(ref, { ...after, updatedAt: serverTimestamp(), lastTransactionId: txRef.id });
    logInTransaction(
      tx,
      txRef,
      { type: "IMPORT", book, quantity, before, after, note: note || `Nhập bổ sung ${quantity} cuốn` },
      actor,
    );
    return after;
  });
}

export type StockAdjustKind =
  | "available_to_damaged"
  | "available_to_lost"
  | "damaged_to_available"
  | "lost_to_available"
  | "writeoff_damaged"
  | "writeoff_lost"
  | "increase_available"
  | "decrease_available";

export const STOCK_ADJUST_OPTIONS: { value: StockAdjustKind; label: string }[] = [
  { value: "available_to_damaged", label: "Đánh dấu hư (từ sách đang có)" },
  { value: "available_to_lost", label: "Đánh dấu mất (từ sách đang có)" },
  { value: "damaged_to_available", label: "Sách hư đã sửa → đưa lại vào kho" },
  { value: "lost_to_available", label: "Tìm thấy sách mất → đưa lại vào kho" },
  { value: "writeoff_damaged", label: "Thanh lý sách hư (giảm tổng)" },
  { value: "writeoff_lost", label: "Xóa sổ sách mất (giảm tổng)" },
  { value: "increase_available", label: "Điều chỉnh tăng sách đang có (tăng tổng)" },
  { value: "decrease_available", label: "Điều chỉnh giảm sách đang có (giảm tổng)" },
];

function adjustDelta(kind: StockAdjustKind, n: number): { delta: Partial<BookCounts>; type: "DAMAGED" | "LOST" | "STOCK_ADJUSTMENT" } {
  switch (kind) {
    case "available_to_damaged":
      return { delta: { quantityAvailable: -n, quantityDamaged: n }, type: "DAMAGED" };
    case "available_to_lost":
      return { delta: { quantityAvailable: -n, quantityLost: n }, type: "LOST" };
    case "damaged_to_available":
      return { delta: { quantityAvailable: n, quantityDamaged: -n }, type: "STOCK_ADJUSTMENT" };
    case "lost_to_available":
      return { delta: { quantityAvailable: n, quantityLost: -n }, type: "STOCK_ADJUSTMENT" };
    case "writeoff_damaged":
      return { delta: { quantityTotal: -n, quantityDamaged: -n }, type: "STOCK_ADJUSTMENT" };
    case "writeoff_lost":
      return { delta: { quantityTotal: -n, quantityLost: -n }, type: "STOCK_ADJUSTMENT" };
    case "increase_available":
      return { delta: { quantityTotal: n, quantityAvailable: n }, type: "STOCK_ADJUSTMENT" };
    case "decrease_available":
      return { delta: { quantityTotal: -n, quantityAvailable: -n }, type: "STOCK_ADJUSTMENT" };
  }
}

/** Điều chỉnh kho (hư/mất/thanh lý/...) — luôn ghi transaction log */
export async function adjustStock(bookId: string, kind: StockAdjustKind, quantity: number, note: string, actor: Actor) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Số lượng phải là số nguyên ≥ 1.");
  const db = getDb();
  const ref = docRef(COLLECTIONS.books, bookId);
  const txRef = newTransactionRef();
  const { delta, type } = adjustDelta(kind, quantity);
  const label = STOCK_ADJUST_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Sách không tồn tại.");
    const book = snapToData<Book>(snap);
    const before = countsOf(book);
    const after = applyDelta(before, delta);
    tx.update(ref, { ...after, updatedAt: serverTimestamp(), lastTransactionId: txRef.id });
    logInTransaction(tx, txRef, { type, book, quantity, before, after, note: `${label}${note ? ` — ${note}` : ""}` }, actor);
    return after;
  });
}

/** Kiểm tra sách có loan đang mượn chưa trả hay không */
export async function hasActiveLoans(bookId: string): Promise<boolean> {
  const q = query(col(COLLECTIONS.loans), where("bookId", "==", bookId), where("status", "==", "borrowing"), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

/** Xóa đầu sách (chỉ admin). Không cho xóa nếu còn sách đang được mượn. */
export async function deleteBook(bookId: string, actor: Actor) {
  const ref = docRef(COLLECTIONS.books, bookId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Sách không tồn tại.");
  const book = snapToData<Book>(snap);
  if ((book.quantityBorrowed ?? 0) > 0 || (await hasActiveLoans(bookId))) {
    throw new Error("Không thể xóa: sách đang có giao dịch mượn chưa trả.");
  }
  const batch = writeBatch(getDb());
  const txRef = newTransactionRef();
  batch.delete(ref);
  logInBatch(
    batch,
    txRef,
    {
      type: "STOCK_ADJUSTMENT",
      book,
      quantity: book.quantityTotal,
      before: countsOf(book),
      after: { quantityTotal: 0, quantityAvailable: 0, quantityBorrowed: 0, quantityDamaged: 0, quantityLost: 0 },
      note: `Xóa đầu sách ${book.bookCode}`,
    },
    actor,
  );
  await batch.commit();
}

/** Tìm sách theo barcode → mã sách → ISBN */
export async function findBookByCode(code: string): Promise<Book | null> {
  const value = code.trim();
  if (!value) return null;
  for (const field of ["barcode", "bookCode", "isbn"]) {
    const snap = await getDocs(query(col(COLLECTIONS.books), where(field, "==", value), limit(1)));
    if (!snap.empty) return snapToData<Book>(snap.docs[0]);
  }
  return null;
}

export async function getBook(bookId: string): Promise<Book | null> {
  const snap = await getDoc(docRef(COLLECTIONS.books, bookId));
  return snap.exists() ? snapToData<Book>(snap) : null;
}

/** Upload ảnh bìa lên Firebase Storage (tùy chọn) */
export async function uploadCover(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("File phải là ảnh.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Ảnh tối đa 2MB.");
  const ext = file.name.split(".").pop() || "jpg";
  const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const r = storageRef(getFirebaseStorage(), path);
  await uploadBytes(r, file, { contentType: file.type });
  return getDownloadURL(r);
}
