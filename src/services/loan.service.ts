import { getDocs, limit, query, runTransaction, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { COLLECTIONS, DEFAULT_SETTINGS } from "@/lib/constants";
import { getDb } from "@/lib/firebase";
import { col, docRef, newDocRef, snapToData, type Actor } from "@/lib/firestore";
import type { Book, Borrower, Loan, LoanStatus, Settings } from "@/types";
import { overdueDays, toMillis } from "@/utils/format";
import { applyDelta, countsOf } from "@/utils/integrity";
import { logInTransaction, newTransactionRef } from "./transaction.service";

export interface BorrowInput {
  bookId: string;
  borrowerId: string;
  borrowDate: Date;
  dueDate: Date;
  note?: string;
}

export interface BorrowMultipleInput {
  bookIds: string[];
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
 * Mượn nhiều cuốn sách cùng một lúc cho 1 bạn đọc — Firestore transaction đảm bảo:
 * quantityAvailable giảm, quantityBorrowed tăng cho từng cuốn, tạo loan tương ứng, tạo log BORROW.
 */
export async function borrowBooks(input: BorrowMultipleInput, actor: Actor): Promise<string[]> {
  if (!input.bookIds || input.bookIds.length === 0) {
    throw new Error("Vui lòng chọn ít nhất một cuốn sách để mượn.");
  }
  if (input.dueDate < input.borrowDate) {
    throw new Error("Hạn trả phải sau ngày mượn.");
  }

  // Loại bỏ mã trùng trong danh sách mượn (nếu có)
  const uniqueBookIds = Array.from(new Set(input.bookIds));
  if (uniqueBookIds.length !== input.bookIds.length) {
    throw new Error("Danh sách sách mượn có mã sách bị trùng lặp.");
  }

  // Kiểm tra trước: người mượn đang mượn những cuốn nào chưa trả
  const dupSnap = await getDocs(
    query(
      col(COLLECTIONS.loans),
      where("borrowerId", "==", input.borrowerId),
      where("status", "==", "borrowing"),
    ),
  );
  const currentlyBorrowedBookIds = new Set(dupSnap.docs.map((d) => d.data().bookId as string));
  for (const id of uniqueBookIds) {
    if (currentlyBorrowedBookIds.has(id)) {
      throw new Error("Bạn đọc này đang mượn một trong các cuốn sách đã chọn và chưa trả.");
    }
  }

  const db = getDb();
  const borrowerRef = docRef(COLLECTIONS.borrowers, input.borrowerId);
  const settingsRef = docRef(COLLECTIONS.settings, "general");
  const bookRefs = uniqueBookIds.map((id) => docRef(COLLECTIONS.books, id));

  const loanIds: string[] = [];

  await runTransaction(db, async (tx) => {
    // 1. Tất cả reads trước
    const [borrowerSnap, settingsSnap, ...bookSnaps] = await Promise.all([
      tx.get(borrowerRef),
      tx.get(settingsRef),
      ...bookRefs.map((ref) => tx.get(ref)),
    ]);

    if (!borrowerSnap.exists()) throw new Error("Không tìm thấy người mượn.");
    const borrower = snapToData<Borrower>(borrowerSnap);
    if (borrower.status !== "active") throw new Error("Người mượn đang bị khóa.");

    const settings = {
      ...DEFAULT_SETTINGS,
      ...(settingsSnap.exists() ? (settingsSnap.data() as Partial<Settings>) : {}),
    };

    const newTotalBorrowCount = (borrower.currentBorrowCount ?? 0) + uniqueBookIds.length;
    if (newTotalBorrowCount > settings.maxBorrowBooks) {
      throw new Error(
        `Người mượn sẽ vượt quá giới hạn tối đa ${settings.maxBorrowBooks} cuốn (hiện mượn ${borrower.currentBorrowCount ?? 0}, thêm ${uniqueBookIds.length} cuốn).`,
      );
    }

    const booksToBorrow: Book[] = [];
    for (let i = 0; i < bookSnaps.length; i++) {
      const snap = bookSnaps[i];
      if (!snap.exists()) {
        throw new Error(`Không tìm thấy sách với ID: ${uniqueBookIds[i]}.`);
      }
      const b = snapToData<Book>(snap);
      if (b.status === "locked") {
        throw new Error(`Sách "${b.title}" đang bị khóa, không thể cho mượn.`);
      }
      if ((b.quantityAvailable ?? 0) <= 0) {
        throw new Error(`Đầu sách "${b.title}" đã hết sách có sẵn trên kệ.`);
      }
      booksToBorrow.push(b);
    }

    // 2. Tất cả writes
    for (const book of booksToBorrow) {
      const loanRef = newDocRef(COLLECTIONS.loans);
      const txRef = newTransactionRef();
      loanIds.push(loanRef.id);

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

      const bookRef = docRef(COLLECTIONS.books, book.id);
      tx.update(bookRef, {
        ...after,
        totalBorrowCount: (book.totalBorrowCount ?? 0) + 1,
        updatedAt: serverTimestamp(),
        lastTransactionId: txRef.id,
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
    }

    tx.update(borrowerRef, {
      currentBorrowCount: newTotalBorrowCount,
      updatedAt: serverTimestamp(),
    });
  });

  return loanIds;
}

/**
 * Mượn 1 cuốn sách (tương thích ngược)
 */
export async function borrowBook(input: BorrowInput, actor: Actor): Promise<string> {
  const ids = await borrowBooks(
    {
      bookIds: [input.bookId],
      borrowerId: input.borrowerId,
      borrowDate: input.borrowDate,
      dueDate: input.dueDate,
      note: input.note,
    },
    actor,
  );
  return ids[0];
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
    .sort((a, b) => toMillis(a.dueDate, 0) - toMillis(b.dueDate, 0));
}

function sortByBorrowDateDesc(list: Loan[]) {
  return list.sort((a, b) => toMillis(b.borrowDate, 0) - toMillis(a.borrowDate, 0));
}

export async function getLoansByBorrower(borrowerId: string): Promise<Loan[]> {
  const snap = await getDocs(query(col(COLLECTIONS.loans), where("borrowerId", "==", borrowerId), limit(500)));
  return sortByBorrowDateDesc(snap.docs.map((d) => snapToData<Loan>(d)));
}

export async function getLoansByBook(bookId: string): Promise<Loan[]> {
  const snap = await getDocs(query(col(COLLECTIONS.loans), where("bookId", "==", bookId), limit(500)));
  return sortByBorrowDateDesc(snap.docs.map((d) => snapToData<Loan>(d)));
}
