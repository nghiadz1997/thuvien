/** Bỏ dấu tiếng Việt + lowercase để tìm kiếm không phân biệt dấu */
export function normalizeText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Kiểm tra mọi từ khóa đều có mặt trong chuỗi đã chuẩn hóa */
export function matchesSearch(haystack: string, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const h = normalizeText(haystack);
  return q.split(" ").every((token) => h.includes(token));
}

export function buildSearchText(...parts: (string | number | null | undefined)[]): string {
  return normalizeText(parts.filter((p) => p !== null && p !== undefined && p !== "").join(" "));
}

export function padNumber(n: number, width: number): string {
  return String(n).padStart(width, "0");
}
