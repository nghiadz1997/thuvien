import type { BorrowerType, LoanStatus, Role, Settings, TransactionType } from "@/types";

export const COLLECTIONS = {
  books: "books",
  categories: "categories",
  borrowers: "borrowers",
  loans: "loans",
  transactions: "transactions",
  inventorySessions: "inventorySessions",
  users: "users",
  settings: "settings",
  counters: "counters",
} as const;

export const DEFAULT_SETTINGS: Settings = {
  maxBorrowBooks: 5,
  defaultBorrowDays: 14,
  schoolName: "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
  libraryName: "Thư viện NSG",
  barcodePrefix: "NSG-BK",
  lowStockThreshold: 1,
};

export const DEFAULT_FACULTIES = [
  "Cơ khí",
  "CNTT-KTD",
  "Y Dược",
  "KT-DL",
  "CSSĐ-NDT",
  "GDDC",
  "Khác",
] as const;

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Quản trị viên",
  librarian: "Thủ thư",
  viewer: "Người xem",
};

export const BORROWER_TYPE_LABELS: Record<BorrowerType, string> = {
  student: "Sinh viên",
  lecturer: "Giảng viên",
  staff: "Nhân viên",
};

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  borrowing: "Đang mượn",
  returned: "Đã trả",
  damaged: "Trả - hư",
  lost: "Mất",
};

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  CREATE_BOOK: "Thêm sách",
  IMPORT: "Nhập sách",
  BORROW: "Mượn",
  RETURN: "Trả",
  DAMAGED: "Hư",
  LOST: "Mất",
  STOCK_ADJUSTMENT: "Điều chỉnh kho",
  INVENTORY: "Kiểm kê",
  UPDATE_BOOK: "Cập nhật sách",
};

export const TRANSACTION_COLORS: Record<TransactionType, string> = {
  CREATE_BOOK: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  IMPORT: "bg-blue-50 text-blue-700 ring-blue-200",
  BORROW: "bg-amber-50 text-amber-700 ring-amber-200",
  RETURN: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  DAMAGED: "bg-orange-50 text-orange-700 ring-orange-200",
  LOST: "bg-red-50 text-red-700 ring-red-200",
  STOCK_ADJUSTMENT: "bg-violet-50 text-violet-700 ring-violet-200",
  INVENTORY: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  UPDATE_BOOK: "bg-slate-100 text-slate-700 ring-slate-200",
};
