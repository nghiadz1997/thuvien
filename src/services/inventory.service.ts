import {
  addDoc,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getDb } from "@/lib/firebase";
import { col, docRef, type Actor } from "@/lib/firestore";
import type { Book, InventoryItem } from "@/types";
import { countsOf } from "@/utils/integrity";
import { buildTransactionData, newTransactionRef } from "./transaction.service";

export const INVENTORY_ITEMS = "items";

export async function createInventorySession(name: string, note: string, expectedCount: number, actor: Actor) {
  if (!name.trim()) throw new Error("Vui lòng nhập tên đợt kiểm kê.");
  const ref = await addDoc(col(COLLECTIONS.inventorySessions), {
    name: name.trim(),
    note: note.trim(),
    startDate: serverTimestamp(),
    endDate: null,
    status: "in_progress",
    scannedCount: 0,
    expectedCount,
    missingCount: 0,
    extraCount: 0,
    createdBy: actor.uid,
    createdByName: actor.name,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Ghi nhận 1 lần quét (dùng increment để an toàn khi nhiều máy quét cùng lúc) */
export async function recordInventoryScan(sessionId: string, barcode: string, book: Book | null) {
  const db = getDb();
  const itemId = book ? book.id : `unknown_${barcode.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100)}`;
  const batch = writeBatch(db);
  batch.set(
    doc(db, COLLECTIONS.inventorySessions, sessionId, INVENTORY_ITEMS, itemId),
    {
      bookId: book?.id ?? "",
      barcode: book?.barcode ?? barcode,
      bookTitle: book?.title ?? "(Không xác định)",
      known: Boolean(book),
      scannedCount: increment(1),
      lastScannedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.update(docRef(COLLECTIONS.inventorySessions, sessionId), { scannedCount: increment(1) });
  await batch.commit();
}

/** Bớt 1 lần quét (khi quét nhầm) */
export async function undoInventoryScan(sessionId: string, item: InventoryItem) {
  if (item.scannedCount <= 0) return;
  const db = getDb();
  const batch = writeBatch(db);
  batch.update(doc(db, COLLECTIONS.inventorySessions, sessionId, INVENTORY_ITEMS, item.id), {
    scannedCount: increment(-1),
  });
  batch.update(docRef(COLLECTIONS.inventorySessions, sessionId), { scannedCount: increment(-1) });
  await batch.commit();
}

export interface InventoryRow {
  bookId: string;
  barcode: string;
  title: string;
  expected: number; // sách phải có trên kệ = quantityAvailable
  borrowed: number;
  scanned: number;
  diff: number; // scanned - expected
  known: boolean;
}

/** Tính kết quả kiểm kê từ danh sách sách và các lần quét */
export function computeInventory(books: Book[], items: InventoryItem[]) {
  const scannedMap = new Map(items.filter((i) => i.known).map((i) => [i.bookId, i]));
  const rows: InventoryRow[] = [];
  for (const b of books) {
    const scanned = scannedMap.get(b.id)?.scannedCount ?? 0;
    const expected = b.quantityAvailable ?? 0;
    if (expected === 0 && scanned === 0 && (b.quantityBorrowed ?? 0) === 0) continue;
    rows.push({
      bookId: b.id,
      barcode: b.barcode,
      title: b.title,
      expected,
      borrowed: b.quantityBorrowed ?? 0,
      scanned,
      diff: scanned - expected,
      known: true,
    });
  }
  // Sách đã quét nhưng không còn trong danh sách sách (bị xóa)
  for (const i of items) {
    if (i.known && !books.some((b) => b.id === i.bookId) && i.scannedCount > 0) {
      rows.push({ bookId: i.bookId, barcode: i.barcode, title: i.bookTitle, expected: 0, borrowed: 0, scanned: i.scannedCount, diff: i.scannedCount, known: false });
    }
  }
  const unknown = items.filter((i) => !i.known && i.scannedCount > 0);
  const scannedTotal = items.reduce((s, i) => s + Math.max(0, i.scannedCount), 0);
  const expectedTotal = rows.reduce((s, r) => s + r.expected, 0);
  const missingTotal = rows.reduce((s, r) => s + Math.max(0, -r.diff), 0);
  const extraTotal = rows.reduce((s, r) => s + Math.max(0, r.diff), 0) + unknown.reduce((s, i) => s + i.scannedCount, 0);
  return {
    rows,
    unknown,
    notScanned: rows.filter((r) => r.scanned === 0 && r.expected > 0),
    missing: rows.filter((r) => r.diff < 0),
    extra: rows.filter((r) => r.diff > 0),
    borrowed: rows.filter((r) => r.borrowed > 0),
    scannedTotal,
    expectedTotal,
    missingTotal,
    extraTotal,
  };
}

/**
 * Hoàn tất kiểm kê: lưu số liệu tổng, ghi transaction INVENTORY cho các sách chênh lệch.
 * Kiểm kê KHÔNG tự sửa số lượng kho — nếu cần, thủ thư điều chỉnh kho ở trang chi tiết sách
 * (mỗi điều chỉnh đều ghi log STOCK_ADJUSTMENT).
 */
export async function completeInventorySession(
  sessionId: string,
  sessionName: string,
  books: Book[],
  items: InventoryItem[],
  actor: Actor,
) {
  const db = getDb();
  const result = computeInventory(books, items);
  const bookMap = new Map(books.map((b) => [b.id, b]));
  const discrepancies = result.rows.filter((r) => r.diff !== 0 && r.known);

  const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  for (const r of discrepancies) {
    const book = bookMap.get(r.bookId);
    if (!book) continue;
    const counts = countsOf(book);
    ops.push((batch) =>
      batch.set(
        newTransactionRef(),
        buildTransactionData(
          {
            type: "INVENTORY",
            book,
            quantity: r.scanned,
            before: counts,
            after: counts,
            note: `Kiểm kê "${sessionName}": quét ${r.scanned} / cần có ${r.expected} (${r.diff > 0 ? `dư ${r.diff}` : `thiếu ${-r.diff}`})`,
          },
          actor,
        ),
      ),
    );
    ops.push((batch) =>
      batch.set(
        doc(db, COLLECTIONS.inventorySessions, sessionId, INVENTORY_ITEMS, r.bookId),
        { bookId: r.bookId, barcode: r.barcode, bookTitle: r.title, known: true, expected: r.expected, scannedCount: increment(0) },
        { merge: true },
      ),
    );
  }
  // Ghi theo lô (giới hạn 500 thao tác / batch)
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(batch));
    await batch.commit();
  }
  await updateDoc(docRef(COLLECTIONS.inventorySessions, sessionId), {
    status: "completed",
    endDate: serverTimestamp(),
    scannedCount: result.scannedTotal,
    expectedCount: result.expectedTotal,
    missingCount: result.missingTotal,
    extraCount: result.extraTotal,
  });
  return result;
}

export async function cancelInventorySession(sessionId: string) {
  await updateDoc(docRef(COLLECTIONS.inventorySessions, sessionId), { status: "cancelled", endDate: serverTimestamp() });
}
