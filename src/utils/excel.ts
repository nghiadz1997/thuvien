import * as XLSX from "xlsx";

export interface SheetSpec {
  name: string;
  rows: Record<string, string | number | null | undefined>[];
  /** Độ rộng cột (ký tự) */
  widths?: number[];
}

/** Xuất 1 hoặc nhiều sheet ra file .xlsx (chạy hoàn toàn phía trình duyệt) */
export function exportExcel(filename: string, sheets: SheetSpec[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ "Không có dữ liệu": "" }]);
    const headers = Object.keys(s.rows[0] ?? {});
    ws["!cols"] = (s.widths ?? headers.map((h) => Math.max(12, h.length + 2))).map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/** Đọc sheet đầu tiên thành mảng object theo dòng tiêu đề */
export async function readExcel(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
}

export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
