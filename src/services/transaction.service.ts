import {
  deleteDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentReference,
  type Transaction as FsTransaction,
  type WriteBatch,
} from "firebase/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { col, docRef, newDocRef, snapToData, type Actor } from "@/lib/firestore";
import type { Book, BookCounts, Transaction, TransactionType } from "@/types";
import { countsOf } from "@/utils/integrity";

export interface TransactionInput {
  type: TransactionType;
  book: Pick<Book, "id" | "barcode" | "title" | "categoryId">;
  quantity: number;
  before: BookCounts | null;
  after: BookCounts | null;
  borrowerId?: string;
  borrowerName?: string;
  borrowerFaculty?: string;
  loanId?: string;
  note?: string;
}

/** Tạo ref transaction mới (để gán vào book.lastTransactionId trong cùng 1 lần ghi) */
export function newTransactionRef(): DocumentReference {
  return newDocRef(COLLECTIONS.transactions);
}

export function buildTransactionData(input: TransactionInput, actor: Actor) {
  return {
    bookId: input.book.id,
    barcode: input.book.barcode ?? "",
    bookTitle: input.book.title ?? "",
    categoryId: input.book.categoryId ?? "",
    type: input.type,
    quantity: input.quantity,
    beforeQuantity: input.before?.quantityAvailable ?? 0,
    afterQuantity: input.after?.quantityAvailable ?? 0,
    before: input.before ? countsOf(input.before) : null,
    after: input.after ? countsOf(input.after) : null,
    borrowerId: input.borrowerId ?? "",
    borrowerName: input.borrowerName ?? "",
    borrowerFaculty: input.borrowerFaculty ?? "",
    loanId: input.loanId ?? "",
    note: input.note ?? "",
    createdBy: actor.uid,
    createdByName: actor.name,
    createdAt: serverTimestamp(),
  };
}

/** Ghi transaction log bên trong Firestore transaction */
export function logInTransaction(tx: FsTransaction, ref: DocumentReference, input: TransactionInput, actor: Actor) {
  tx.set(ref, buildTransactionData(input, actor));
}

/** Ghi transaction log bên trong batch write */
export function logInBatch(batch: WriteBatch, ref: DocumentReference, input: TransactionInput, actor: Actor) {
  batch.set(ref, buildTransactionData(input, actor));
}

/** Lấy giao dịch trong khoảng thời gian (mới nhất trước) */
export async function getTransactionsInRange(from: Date, to: Date, max = 500): Promise<Transaction[]> {
  try {
    const q = query(
      col(COLLECTIONS.transactions),
      where("createdAt", ">=", Timestamp.fromDate(from)),
      where("createdAt", "<=", Timestamp.fromDate(to)),
      orderBy("createdAt", "desc"),
      limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => snapToData<Transaction>(d));
  } catch (err) {
    console.warn("getTransactionsInRange fallback:", err);
    try {
      const snap = await getDocs(query(col(COLLECTIONS.transactions), limit(max)));
      const fromMs = from.getTime();
      const toMs = to.getTime();
      return snap.docs
        .map((d) => snapToData<Transaction>(d))
        .filter((t) => {
          const tMs = t.createdAt?.toMillis?.() ?? 0;
          return tMs >= fromMs && tMs <= toMs;
        })
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    } catch {
      return [];
    }
  }
}

export async function getRecentTransactions(max = 10): Promise<Transaction[]> {
  try {
    const q = query(col(COLLECTIONS.transactions), orderBy("createdAt", "desc"), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((d) => snapToData<Transaction>(d));
  } catch (err) {
    console.warn("getRecentTransactions fallback:", err);
    try {
      const snap = await getDocs(query(col(COLLECTIONS.transactions), limit(max)));
      return snap.docs
        .map((d) => snapToData<Transaction>(d))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    } catch {
      return [];
    }
  }
}

/** Giao dịch của 1 sách (không cần composite index: lọc bằng where rồi sắp xếp phía client) */
export async function getTransactionsByBook(bookId: string, max = 200): Promise<Transaction[]> {
  const q = query(col(COLLECTIONS.transactions), where("bookId", "==", bookId), limit(1000));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => snapToData<Transaction>(d))
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
    .slice(0, max);
}

/** Chỉ admin (Security Rules cũng chặn các role khác) */
export async function deleteTransaction(id: string) {
  await deleteDoc(docRef(COLLECTIONS.transactions, id));
}
