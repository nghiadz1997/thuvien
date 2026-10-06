import type { BookCounts } from "@/types";

export function countsOf(b: BookCounts): BookCounts {
  return {
    quantityTotal: b.quantityTotal ?? 0,
    quantityAvailable: b.quantityAvailable ?? 0,
    quantityBorrowed: b.quantityBorrowed ?? 0,
    quantityDamaged: b.quantityDamaged ?? 0,
    quantityLost: b.quantityLost ?? 0,
  };
}

/** Kiểm tra bất biến: total = available + borrowed + damaged + lost, không có số âm */
export function checkIntegrity(b: BookCounts): string | null {
  const c = countsOf(b);
  const values = Object.values(c);
  if (values.some((v) => !Number.isInteger(v))) return "Số lượng không phải số nguyên";
  if (values.some((v) => v < 0)) return "Có số lượng âm";
  const sum = c.quantityAvailable + c.quantityBorrowed + c.quantityDamaged + c.quantityLost;
  if (sum !== c.quantityTotal) return `Tổng (${c.quantityTotal}) ≠ còn + mượn + hư + mất (${sum})`;
  return null;
}

/** Áp dụng thay đổi và đảm bảo bất biến; ném lỗi nếu vi phạm */
export function applyDelta(b: BookCounts, delta: Partial<BookCounts>): BookCounts {
  const c = countsOf(b);
  const next: BookCounts = {
    quantityTotal: c.quantityTotal + (delta.quantityTotal ?? 0),
    quantityAvailable: c.quantityAvailable + (delta.quantityAvailable ?? 0),
    quantityBorrowed: c.quantityBorrowed + (delta.quantityBorrowed ?? 0),
    quantityDamaged: c.quantityDamaged + (delta.quantityDamaged ?? 0),
    quantityLost: c.quantityLost + (delta.quantityLost ?? 0),
  };
  if (next.quantityAvailable < 0) throw new Error("Không đủ sách có sẵn trong thư viện.");
  const err = checkIntegrity(next);
  if (err) throw new Error(`Dữ liệu số lượng không hợp lệ: ${err}`);
  return next;
}
