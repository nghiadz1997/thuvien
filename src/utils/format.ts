import { Timestamp } from "firebase/firestore";
import type { TS } from "@/types";

const numberFmt = new Intl.NumberFormat("vi-VN");

export function formatNumber(n: number | null | undefined): string {
  return numberFmt.format(n ?? 0);
}

export type DateLike =
  | TS
  | Date
  | string
  | number
  | { seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number }
  | undefined;

export function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object") {
    if ("toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate();
    }
    const v = value as { seconds?: number; nanoseconds?: number; _seconds?: number; _nanoseconds?: number };
    const sec = typeof v.seconds === "number" ? v.seconds : typeof v._seconds === "number" ? v._seconds : null;
    if (sec !== null) {
      const ns = typeof v.nanoseconds === "number" ? v.nanoseconds : typeof v._nanoseconds === "number" ? v._nanoseconds : 0;
      const d = new Date(sec * 1000 + Math.floor(ns / 1_000_000));
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toMillis(value: DateLike, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object" && "toMillis" in value && typeof (value as { toMillis: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  const d = toDate(value);
  return d ? d.getTime() : fallback;
}

export function formatDate(value: TS | Date | string | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value: TS | Date | string | undefined): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** yyyy-mm-dd theo giờ địa phương (dùng cho input type=date) */
export function toInputDate(value: TS | Date | undefined): string {
  const d = toDate(value ?? null);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse yyyy-mm-dd thành Date địa phương (00:00) */
export function fromInputDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Số ngày trễ hạn (so với hạn trả, tính theo ngày) */
export function overdueDays(dueDate: TS | Date | undefined, ref: Date = new Date()): number {
  const due = toDate(dueDate ?? null);
  if (!due) return 0;
  const diff = startOfDay(ref).getTime() - startOfDay(due).getTime();
  return diff > 0 ? Math.floor(diff / 86_400_000) : 0;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `T${Number(m)}/${y.slice(2)}`;
}

/** Danh sách key tháng liên tiếp từ from -> to */
export function monthRange(from: Date, to: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  while (cur <= end && keys.length < 120) {
    keys.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}
