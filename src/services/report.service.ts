import type { Book, Category, Loan, Settings, Transaction } from "@/types";
import { monthKey, overdueDays, toDate } from "@/utils/format";
import { checkIntegrity } from "@/utils/integrity";

/**
 * Report service — các hàm tính toán thuần túy từ dữ liệu Firestore thật
 * (books, loans, transactions). Không có dữ liệu giả.
 */

export interface StockSummary {
  titles: number;
  total: number;
  available: number;
  borrowed: number;
  overdue: number;
  damaged: number;
  lost: number;
  newThisMonth: number;
  anomalies: { book: Book; message: string }[];
}

export function isOverdue(loan: Loan, ref = new Date()) {
  return loan.status === "borrowing" && overdueDays(loan.dueDate, ref) > 0;
}

export function computeStockSummary(books: Book[], activeLoans: Loan[], monthTransactions: Transaction[] = []): StockSummary {
  const s: StockSummary = { titles: books.length, total: 0, available: 0, borrowed: 0, overdue: 0, damaged: 0, lost: 0, newThisMonth: 0, anomalies: [] };
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  for (const b of books) {
    s.total += b.quantityTotal ?? 0;
    s.available += b.quantityAvailable ?? 0;
    s.borrowed += b.quantityBorrowed ?? 0;
    s.damaged += b.quantityDamaged ?? 0;
    s.lost += b.quantityLost ?? 0;
    const err = checkIntegrity(b);
    if (err) s.anomalies.push({ book: b, message: err });

    if (monthTransactions.length === 0) {
      const addedDate = toDate(b.dateAdded || b.createdAt);
      if (addedDate && monthKey(addedDate) === currentMonthKey) {
        s.newThisMonth += b.quantityTotal ?? 0;
      }
    }
  }
  s.overdue = activeLoans.filter((l) => isOverdue(l)).length;
  if (monthTransactions.length > 0) {
    s.newThisMonth = sumImported(monthTransactions);
  }
  return s;
}

export function sumImported(transactions: Transaction[]) {
  return transactions
    .filter((t) => t.type === "IMPORT" || t.type === "CREATE_BOOK")
    .reduce((sum, t) => sum + (t.quantity ?? 0), 0);
}

function isReturnTx(t: Transaction) {
  return t.type === "RETURN" || ((t.type === "DAMAGED" || t.type === "LOST") && Boolean(t.loanId));
}

export interface MonthlyPoint {
  month: string;
  borrow: number;
  return: number;
  import: number;
}

export function computeMonthlySeries(transactions: Transaction[], months: string[]): MonthlyPoint[] {
  const map = new Map<string, MonthlyPoint>(months.map((m) => [m, { month: m, borrow: 0, return: 0, import: 0 }]));
  for (const t of transactions) {
    const d = toDate(t.createdAt);
    if (!d) continue;
    const p = map.get(monthKey(d));
    if (!p) continue;
    if (t.type === "BORROW") p.borrow += 1;
    else if (isReturnTx(t)) p.return += 1;
    else if (t.type === "IMPORT" || t.type === "CREATE_BOOK") p.import += t.quantity ?? 0;
  }
  return months.map((m) => map.get(m)!);
}

export interface CategoryStat {
  categoryId: string;
  name: string;
  titles: number;
  copies: number;
  available: number;
  borrowed: number;
  damaged: number;
  lost: number;
  borrowsInPeriod: number;
}

export function computeCategoryStats(books: Book[], categories: Category[], transactions: Transaction[] = []): CategoryStat[] {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const map = new Map<string, CategoryStat>();
  const get = (id: string) => {
    const key = id || "_none";
    let s = map.get(key);
    if (!s) {
      s = { categoryId: key, name: names.get(id) ?? "Chưa phân loại", titles: 0, copies: 0, available: 0, borrowed: 0, damaged: 0, lost: 0, borrowsInPeriod: 0 };
      map.set(key, s);
    }
    return s;
  };
  for (const b of books) {
    const s = get(b.categoryId);
    s.titles += 1;
    s.copies += b.quantityTotal ?? 0;
    s.available += b.quantityAvailable ?? 0;
    s.borrowed += b.quantityBorrowed ?? 0;
    s.damaged += b.quantityDamaged ?? 0;
    s.lost += b.quantityLost ?? 0;
  }
  for (const t of transactions) if (t.type === "BORROW") get(t.categoryId).borrowsInPeriod += 1;
  return [...map.values()].sort((a, b) => b.copies - a.copies);
}

export interface BookBorrowStat {
  bookId: string;
  title: string;
  barcode: string;
  count: number;
}

export function topBorrowedAllTime(books: Book[], n = 10): BookBorrowStat[] {
  return [...books]
    .filter((b) => (b.totalBorrowCount ?? 0) > 0)
    .sort((a, b) => (b.totalBorrowCount ?? 0) - (a.totalBorrowCount ?? 0))
    .slice(0, n)
    .map((b) => ({ bookId: b.id, title: b.title, barcode: b.barcode, count: b.totalBorrowCount ?? 0 }));
}

function borrowCountsInPeriod(transactions: Transaction[]) {
  const map = new Map<string, number>();
  for (const t of transactions) if (t.type === "BORROW") map.set(t.bookId, (map.get(t.bookId) ?? 0) + 1);
  return map;
}

export function topBorrowedInPeriod(transactions: Transaction[], books: Book[], n = 10): BookBorrowStat[] {
  const counts = borrowCountsInPeriod(transactions);
  const bookMap = new Map(books.map((b) => [b.id, b]));
  const titles = new Map(transactions.map((t) => [t.bookId, t.bookTitle]));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([bookId, count]) => ({
      bookId,
      count,
      title: bookMap.get(bookId)?.title ?? titles.get(bookId) ?? "(đã xóa)",
      barcode: bookMap.get(bookId)?.barcode ?? "",
    }));
}

export function leastBorrowedInPeriod(transactions: Transaction[], books: Book[], n = 10): BookBorrowStat[] {
  const counts = borrowCountsInPeriod(transactions);
  return books
    .filter((b) => (b.quantityTotal ?? 0) > 0)
    .map((b) => ({ bookId: b.id, title: b.title, barcode: b.barcode, count: counts.get(b.id) ?? 0 }))
    .sort((a, b) => a.count - b.count || a.title.localeCompare(b.title, "vi"))
    .slice(0, n);
}

export interface FacultyStat {
  faculty: string;
  borrows: number;
  borrowers: number;
}

export function computeFacultyStats(transactions: Transaction[]): FacultyStat[] {
  const map = new Map<string, { borrows: number; set: Set<string> }>();
  for (const t of transactions) {
    if (t.type !== "BORROW") continue;
    const key = t.borrowerFaculty || "Không rõ khoa";
    const s = map.get(key) ?? { borrows: 0, set: new Set<string>() };
    s.borrows += 1;
    if (t.borrowerId) s.set.add(t.borrowerId);
    map.set(key, s);
  }
  return [...map.entries()]
    .map(([faculty, s]) => ({ faculty, borrows: s.borrows, borrowers: s.set.size }))
    .sort((a, b) => b.borrows - a.borrows);
}

export interface BookFacultyStat {
  faculty: string;
  titles: number;
  copies: number;
  available: number;
  borrowed: number;
  damaged: number;
  lost: number;
}

export function computeBookFacultyStats(books: Book[]): BookFacultyStat[] {
  const map = new Map<string, BookFacultyStat>();
  for (const b of books) {
    const f = b.faculty || "Khác";
    let s = map.get(f);
    if (!s) {
      s = { faculty: f, titles: 0, copies: 0, available: 0, borrowed: 0, damaged: 0, lost: 0 };
      map.set(f, s);
    }
    s.titles += 1;
    s.copies += b.quantityTotal ?? 0;
    s.available += b.quantityAvailable ?? 0;
    s.borrowed += b.quantityBorrowed ?? 0;
    s.damaged += b.quantityDamaged ?? 0;
    s.lost += b.quantityLost ?? 0;
  }
  return [...map.values()].sort((a, b) => b.copies - a.copies);
}

export function lowStockBooks(books: Book[], settings: Settings, n = 10): Book[] {
  return books
    .filter((b) => b.status !== "locked" && (b.quantityAvailable ?? 0) <= settings.lowStockThreshold)
    .sort((a, b) => (a.quantityAvailable ?? 0) - (b.quantityAvailable ?? 0))
    .slice(0, n);
}

export function overdueLoans(activeLoans: Loan[]): (Loan & { lateDays: number })[] {
  return activeLoans
    .map((l) => ({ ...l, lateDays: overdueDays(l.dueDate) }))
    .filter((l) => l.lateDays > 0)
    .sort((a, b) => b.lateDays - a.lateDays);
}

export function newestBooks(books: Book[], n = 8): Book[] {
  return [...books].sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now())).slice(0, n);
}
