import { getDocs, limit, query, runTransaction, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { COLLECTIONS, DEFAULT_SETTINGS } from "@/lib/constants";
import { getDb } from "@/lib/firebase";
import { col, docRef, newDocRef, snapToData, type Actor } from "@/lib/firestore";
import type { Book, Borrower, Loan, LoanStatus, Settings } from "@/types";
import { overdueDays } from "@/utils/format";
import { applyDelta, countsOf } from "@/utils/integrity";
import { logInTransaction, newTransactionRef } from "./transaction.service";

export interface BorrowInput {
  bookId: string;
  borrowerId: string;
  borrowDate: Date;
  dueDate: Date;
  note?: string;
}

export type ReturnCondition = "normal" | "damaged" | "lost";

export interface ReturnInput {
  loanId: string;
  condition: ReturnCondition;
  returnDate: Date;
  note?: string;
}

/**
 * Mượn sách — Firestore transaction đảm bảo:
 * quantityAvailable giảm, quantityBorrowed tăng, tạo loan, tạo log BORROW.
 */
export async function borrowBook(input: BorrowInput, actor: Actor): Promise<string> {
  if (input.dueDate < input.borrowDate) throw new Error("Hạn trả phải sau ngày mượn.");

  // Kiểm tra trước: người mượn đang mượn chính đầu sách này chưa trả
  const dup = await getDocs(
    query(
      col(COLLECTIONS.loans),
      where("borrowerId", "==", input.borrowerId),
      where("bookId", "==", input.bookId),
      where("status", "==", "borrowing"),
      limit(1),
    ),
  );
  if (!dup.empty) throw new Error("Người mượn đang mượn cuốn sách này và chưa trả.");

  const db = getDb();
  const bookRef = docRef(COLLECTIONS.books, input.bookId);
  const borrowerRef = docRef(COLLECTIONS.borrowers, input.borrowerId);
  const settingsRef = docRef(COLLECTIONS.settings, "general");
  const loanRef = newDocRef(COLLECTIONS.loans);
  const txRef = newTransactionRef();

  await runTransaction(db, async (tx) => {
    const [bookSnap, borrowerSnap, settingsSnap] = await Promise.all([
      tx.get(bookRef),
      tx.get(borrowerRef),
      tx.get(settingsRef),
    ]);
    if (!bookSnap.exists()) throw new Error("Không tìm thấy sách.");
    if (!borrowerSnap.exists()) throw new Error("Không tìm thấy người mượn.");
    const book = snapToData<Book>(bookSnap);
    const borrower = snapToData<Borrower>(borrowerSnap);
    const settings = { ...DEFAULT_SETTINGS, ...(settingsSnap.exists() ? (settingsSnap.data() as Partial<Settings>) : {}) };

    if (book.status === "locked") throw new Error("Sách đang bị khóa, không thể cho mượn.");
    if ((book.quantityAvailable ?? 0) <= 0) throw new Error("Hết sách: không còn cuốn nào có sẵn.");
    if (borrower.status !== "active") throw new Error("Người mượn đang bị khóa.");
    if ((borrower.currentBorrowCount ?? 0) >= settings.maxBorrowBooks) {
      throw new Error(`Người mượn đã mượn tối đa ${settings.maxBorrowBooks} cuốn.`);
    }

    const before = countsOf(book);
    const after = applyDelta(before, { quantityAvailable: -1, quantityBorrowed: 1 });

    tx.set(loanRef, {
      borrowerId: borrower.id,
      borrowerName: borrower.fullName,
      borrowerFaculty: borrower.faculty ?? "",
      bookId: book.id,
      barcode: book.barcode,
      bookTitle: book.title,
      borrowDate: Timestamp.fromDate(input.borrowDate),
      dueDate: Timestamp.fromDate(input.dueDate),
      returnDate: null,
      status: "borrowing" as LoanStatus,
      overdueDays: 0,
      note: input.note ?? "",
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.update(bookRef, {
      ...after,
      totalBorrowCount: (book.totalBorrowCount ?? 0) + 1,
      updatedAt: serverTimestamp(),
      lastTransactionId: txRef.id,
    });
    tx.update(borrowerRef, {
      currentBorrowCount: (borrower.currentBorrowCount ?? 0) + 1,
      updatedAt: serverTimestamp(),
    });
    logInTransaction(
      tx,
      txRef,
      {
        type: "BORROW",
        book,
        quantity: 1,
        before,
        after,
        borrowerId: borrower.id,
        borrowerName: borrower.fullName,
        borrowerFaculty: borrower.faculty ?? "",
        loanId: loanRef.id,
        note: input.note || `Mượn đến ${input.dueDate.toLocaleDateString("vi-VN")}`,
      },
      actor,
    );
  });
  return loanRef.id;
}

/**
 * Trả sách — bình thường / hư / mất.
 * normal: available+1, borrowed-1 (RETURN)
 * damaged: borrowed-1, damaged+1 (DAMAGED)
 * lost: borrowed-1, lost+1 (LOST)
 */
export async function returnBook(input: ReturnInput, actor: Actor) {
  const db = getDb();
  const loanRef = docRef(COLLECTIONS.loans, input.loanId);
  const txRef = newTransactionRef();

  await runTransaction(db, async (tx) => {
    const loanSnap = await tx.get(loanRef);
    if (!loanSnap.exists()) throw new Error("Không tìm thấy phiếu mượn.");
    const loan = snapToData<Loan>(loanSnap);
    if (loan.status !== "borrowing") throw new Error("Phiếu mượn này đã được xử lý trả trước đó.");

    const bookRef = docRef(COLLECTIONS.books, loan.bookId);
    const borrowerRef = docRef(COLLECTIONS.borrowers, loan.borrowerId);
    const [bookSnap, borrowerSnap] = await Promise.all([tx.get(bookRef), tx.get(borrowerRef)]);
    if (!bookSnap.exists()) throw new Error("Sách của phiếu mượn không còn tồn tại.");
    const book = snapToData<Book>(bookSnap);

    const before = countsOf(book);
    const delta =
      input.condition === "normal"
        ? { quantityAvailable: 1, quantityBorrowed: -1 }
        : input.condition === "damaged"
          ? { quantityBorrowed: -1, quantityDamaged: 1 }
          : { quantityBorrowed: -1, quantityLost: 1 };
    const after = applyDelta(before, delta);
    const late = overdueDays(loan.dueDate, input.returnDate);
    const status: LoanStatus = input.condition === "normal" ? "returned" : input.condition;
    const type = input.condition === "normal" ? "RETURN" : input.condition === "damaged" ? "DAMAGED" : "LOST";

    tx.update(loanRef, {
      status,
      returnDate: Timestamp.fromDate(input.returnDate),
      overdueDays: late,
      note: input.note ?? loan.note ?? "",
      updatedAt: serverTimestamp(),
    });
    tx.update(bookRef, { ...after, updatedAt: serverTimestamp(), lastTransactionId: txRef.id });
    if (borrowerSnap.exists()) {
      const current = Number(borrowerSnap.data().currentBorrowCount) || 0;
      tx.update(borrowerRef, { currentBorrowCount: Math.max(0, current - 1), updatedAt: serverTimestamp() });
    }
    const condLabel = input.condition === "normal" ? "Trả sách" : input.condition === "damaged" ? "Trả sách bị hư" : "Báo mất sách";
    logInTransaction(
      tx,
      txRef,
      {
        type,
        book,
        quantity: 1,
        before,
        after,
        borrowerId: loan.borrowerId,
        borrowerName: loan.borrowerName,
        borrowerFaculty: loan.borrowerFaculty ?? "",
        loanId: loan.id,
        note: [condLabel, late > 0 ? `trễ ${late} ngày` : "", input.note ?? ""].filter(Boolean).join(" — "),
      },
      actor,
    );
  });
}

export async function getActiveLoans(): Promise<Loan[]> {
  const snap = await getDocs(query(col(COLLECTIONS.loans), where("status", "==", "borrowing")));
  return snap.docs.map((d) => snapToData<Loan>(d));
}

export async function getActiveLoansByBook(bookId: string): Promise<Loan[]> {
  const snap = await getDocs(
    query(col(COLLECTIONS.loans), where("bookId", "==", bookId), where("status", "==", "borrowing")),
  );
  return snap.docs
    .map((d) => snapToData<Loan>(d))
    .sort((a, b) => (a.dueDate?.toMillis() ?? 0) - (b.dueDate?.toMillis() ?? 0));
}

function sortByBorrowDateDesc(list: Loan[]) {
  return list.sort((a, b) => (b.borrowDate?.toMillis() ?? 0) - (a.borrowDate?.toMillis() ?? 0));
}

export async function getLoansByBorrower(borrowerId: string): Promise<Loan[]> {
  const snap = await getDocs(query(col(COLLECTIONS.loans), where("borrowerId", "==", borrowerId), limit(500)));
  return sortByBorrowDateDesc(snap.docs.map((d) => snapToData<Loan>(d)));
}

export async function getLoansByBook(bookId: string): Promise<Loan[]> {
  const snap = await getDocs(query(col(COLLECTIONS.loans), where("bookId", "==", bookId), limit(500)));
  return sortByBorrowDateDesc(snap.docs.map((d) => snapToData<Loan>(d)));
}
