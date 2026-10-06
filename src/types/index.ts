import type { Timestamp } from "firebase/firestore";

/** Firestore Timestamp hoặc null khi serverTimestamp chưa được ghi xong */
export type TS = Timestamp | null;

export type Role = "admin" | "librarian" | "viewer";
export type ActiveStatus = "active" | "disabled";

export interface AppUser {
  id: string; // uid
  fullName: string;
  email: string;
  role: Role;
  status: ActiveStatus;
  createdAt: TS;
}

export type BookStatus = "active" | "locked";

export interface BookCounts {
  quantityTotal: number;
  quantityAvailable: number;
  quantityBorrowed: number;
  quantityDamaged: number;
  quantityLost: number;
}

export interface Book extends BookCounts {
  id: string;
  bookCode: string;
  barcode: string;
  title: string;
  author: string;
  categoryId: string;
  faculty: string;
  publisher: string;
  publishYear: number | null;
  isbn: string;
  dateAdded: TS;
  shelfLocation: string;
  coverUrl: string;
  status: BookStatus;
  notes: string;
  totalBorrowCount: number;
  lastTransactionId: string;
  searchText: string;
  createdAt: TS;
  updatedAt: TS;
  createdBy: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  status: ActiveStatus;
}

export type BorrowerType = "student" | "lecturer" | "staff";

export interface Borrower {
  id: string;
  borrowerCode: string;
  fullName: string;
  type: BorrowerType;
  studentCode: string;
  className: string;
  faculty: string;
  email: string;
  phone: string;
  gender?: string;
  dob?: string;
  birthPlace?: string;
  address?: string;
  citizenId?: string;
  status: ActiveStatus;
  currentBorrowCount: number;
  searchText: string;
  createdAt: TS;
  updatedAt: TS;
}

export type LoanStatus = "borrowing" | "returned" | "damaged" | "lost";

export interface Loan {
  id: string;
  borrowerId: string;
  borrowerName: string;
  borrowerFaculty: string;
  bookId: string;
  barcode: string;
  bookTitle: string;
  borrowDate: TS;
  dueDate: TS;
  returnDate: TS;
  status: LoanStatus;
  overdueDays: number;
  note: string;
  createdBy: string;
  createdAt: TS;
  updatedAt: TS;
}

export type TransactionType =
  | "CREATE_BOOK"
  | "IMPORT"
  | "BORROW"
  | "RETURN"
  | "DAMAGED"
  | "LOST"
  | "STOCK_ADJUSTMENT"
  | "INVENTORY"
  | "UPDATE_BOOK";

export interface Transaction {
  id: string;
  bookId: string;
  barcode: string;
  bookTitle: string;
  type: TransactionType;
  quantity: number;
  /** Số lượng sách còn trong thư viện (quantityAvailable) trước giao dịch */
  beforeQuantity: number;
  /** Số lượng sách còn trong thư viện (quantityAvailable) sau giao dịch */
  afterQuantity: number;
  before: BookCounts | null;
  after: BookCounts | null;
  borrowerId: string;
  borrowerName: string;
  borrowerFaculty: string;
  loanId: string;
  categoryId: string;
  note: string;
  createdBy: string;
  createdByName: string;
  createdAt: TS;
}

export type InventoryStatus = "in_progress" | "completed" | "cancelled";

export interface InventorySession {
  id: string;
  name: string;
  startDate: TS;
  endDate: TS;
  status: InventoryStatus;
  scannedCount: number;
  expectedCount: number;
  missingCount: number;
  extraCount: number;
  note: string;
  createdBy: string;
  createdByName: string;
  createdAt: TS;
}

export interface InventoryItem {
  id: string; // bookId hoặc "unknown_<barcode>"
  bookId: string;
  barcode: string;
  bookTitle: string;
  scannedCount: number;
  known: boolean;
  lastScannedAt: TS;
}

export interface Settings {
  maxBorrowBooks: number;
  defaultBorrowDays: number;
  schoolName: string;
  libraryName: string;
  barcodePrefix: string;
  lowStockThreshold: number;
}
