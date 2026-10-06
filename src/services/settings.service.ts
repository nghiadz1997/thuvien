import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { COLLECTIONS, DEFAULT_SETTINGS } from "@/lib/constants";
import { getDb } from "@/lib/firebase";
import type { Settings } from "@/types";

export async function getSettings(): Promise<Settings> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.settings, "general"));
  return { ...DEFAULT_SETTINGS, ...(snap.exists() ? (snap.data() as Partial<Settings>) : {}) };
}

export async function saveSettings(s: Settings) {
  if (!Number.isInteger(s.maxBorrowBooks) || s.maxBorrowBooks < 1) throw new Error("Số sách mượn tối đa phải ≥ 1.");
  if (!Number.isInteger(s.defaultBorrowDays) || s.defaultBorrowDays < 1) throw new Error("Số ngày mượn mặc định phải ≥ 1.");
  if (!/^[A-Z0-9-]{2,20}$/.test(s.barcodePrefix)) {
    throw new Error("Tiền tố mã vạch chỉ gồm chữ in hoa, số, dấu gạch ngang (2–20 ký tự).");
  }
  await setDoc(doc(getDb(), COLLECTIONS.settings, "general"), {
    maxBorrowBooks: s.maxBorrowBooks,
    defaultBorrowDays: s.defaultBorrowDays,
    schoolName: s.schoolName.trim(),
    libraryName: s.libraryName.trim(),
    barcodePrefix: s.barcodePrefix,
    lowStockThreshold: Math.max(0, Math.floor(s.lowStockThreshold)),
  });
}

/** Kiểm tra hệ thống đã có admin đầu tiên hay chưa */
export async function isBootstrapped(): Promise<boolean> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.settings, "bootstrap"));
  return snap.exists();
}

/**
 * Khởi tạo admin đầu tiên: user đã đăng nhập (được tạo trong Firebase Console)
 * tự nhận quyền admin. Security Rules chỉ cho phép khi settings/bootstrap CHƯA tồn tại.
 */
export async function bootstrapFirstAdmin(uid: string, email: string, fullName: string) {
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, COLLECTIONS.users, uid), {
    fullName: fullName.trim() || email,
    email,
    role: "admin",
    status: "active",
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, COLLECTIONS.settings, "bootstrap"), { adminUid: uid, createdAt: serverTimestamp() });
  batch.set(doc(db, COLLECTIONS.settings, "general"), DEFAULT_SETTINGS);
  await batch.commit();
}
