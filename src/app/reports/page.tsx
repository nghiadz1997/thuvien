"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Package,
  Printer,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Form";
import { Table, TBody, Td, Th, THead } from "@/components/ui/Table";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { useActiveLoans, useBooks, useCategories, useSettings } from "@/hooks/useRealtime";
import { useAsync } from "@/hooks/useAsync";
import { getTransactionsInRange } from "@/services/transaction.service";
import {
  computeBookFacultyStats,
  computeCategoryStats,
  computeFacultyStats,
  computeMonthlySeries,
  computeStockSummary,
  leastBorrowedInPeriod,
  sumImported,
  topBorrowedInPeriod,
} from "@/services/report.service";
import { exportExcel, todayStamp } from "@/utils/excel";
import { endOfDay, formatDate, formatNumber, fromInputDate, monthLabel, monthRange, startOfDay, toInputDate } from "@/utils/format";
import type { Transaction } from "@/types";

type PeriodPreset = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

export default function ReportsPage() {
  const { data: books, loading: loadingBooks } = useBooks();
  const { data: categories } = useCategories();
  const { data: loans } = useActiveLoans();
  const { data: settings } = useSettings();

  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [customFrom, setCustomFrom] = useState(toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(toInputDate(new Date()));

  // Tính ngày bắt đầu và kết thúc theo preset
  const { fromDate, toDate, labelRange } = useMemo(() => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date();

    if (preset === "last_month") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === "this_quarter") {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      end = new Date();
    } else if (preset === "this_year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date();
    } else if (preset === "custom") {
      start = fromInputDate(customFrom) || new Date();
      end = fromInputDate(customTo) || new Date();
    }

    return {
      fromDate: startOfDay(start),
      toDate: endOfDay(end),
      labelRange: `${formatDate(start)} đến ${formatDate(end)}`,
    };
  }, [preset, customFrom, customTo]);

  // Lấy dữ liệu giao dịch trong kỳ
  const { data: periodTx, loading: loadingTx } = useAsync<Transaction[]>(
    () => getTransactionsInRange(fromDate, toDate, 5000),
    [fromDate.getTime(), toDate.getTime()],
  );

  const transactions = periodTx || [];

  // Thống kê tổng quan
  const summary = useMemo(() => {
    return computeStockSummary(books, loans, transactions);
  }, [books, loans, transactions]);

  const borrowsCount = useMemo(() => {
    return transactions.filter((t) => t.type === "BORROW").length;
  }, [transactions]);

  const returnsCount = useMemo(() => {
    return transactions.filter((t) => t.type === "RETURN" || ((t.type === "DAMAGED" || t.type === "LOST") && t.loanId)).length;
  }, [transactions]);

  const importedCount = useMemo(() => {
    return sumImported(transactions);
  }, [transactions]);

  // Báo cáo theo thể loại
  const catStats = useMemo(() => {
    return computeCategoryStats(books, categories, transactions);
  }, [books, categories, transactions]);

  // Báo cáo sách theo khoa
  const bookFacultyStats = useMemo(() => {
    return computeBookFacultyStats(books);
  }, [books]);

  // Top mượn nhiều nhất trong kỳ
  const topBooks = useMemo(() => {
    return topBorrowedInPeriod(transactions, books, 10);
  }, [transactions, books]);

  // Sách ít mượn trong kỳ
  const leastBooks = useMemo(() => {
    return leastBorrowedInPeriod(transactions, books, 10);
  }, [transactions, books]);

  // Thống kê mượn theo khoa của bạn đọc
  const facultyStats = useMemo(() => {
    return computeFacultyStats(transactions);
  }, [transactions]);

  // Xuất Excel tổng hợp
  const handleExportExcel = () => {
    const sheetTongQuan = [
      { "Chỉ số": "Tổng số đầu sách", "Giá trị": summary.titles },
      { "Chỉ số": "Tổng số cuốn sách trong kho", "Giá trị": summary.total },
      { "Chỉ số": "Số sách hiện có sẵn", "Giá trị": summary.available },
      { "Chỉ số": "Số sách đang cho mượn", "Giá trị": summary.borrowed },
      { "Chỉ số": "Số sách quá hạn", "Giá trị": summary.overdue },
      { "Chỉ số": "Số sách bị hư", "Giá trị": summary.damaged },
      { "Chỉ số": "Số sách bị mất", "Giá trị": summary.lost },
      { "Chỉ số": "Số lượt mượn trong kỳ", "Giá trị": borrowsCount },
      { "Chỉ số": "Số lượt trả trong kỳ", "Giá trị": returnsCount },
      { "Chỉ số": "Số cuốn nhập mới trong kỳ", "Giá trị": importedCount },
    ];

    const sheetTheLoai = catStats.map((c) => ({
      "Thể loại": c.name,
      "Số đầu sách": c.titles,
      "Tổng số cuốn": c.copies,
      "Khả dụng": c.available,
      "Đang mượn": c.borrowed,
      "Lượt mượn trong kỳ": c.borrowsInPeriod,
    }));

    const sheetSachTheoKhoa = bookFacultyStats.map((f) => ({
      "Khoa / Đơn vị": f.faculty,
      "Số đầu sách": f.titles,
      "Tổng số cuốn": f.copies,
      "Có sẵn": f.available,
      "Đang mượn": f.borrowed,
      "Hư hỏng / Mất": f.damaged + f.lost,
    }));

    const sheetTopMuon = topBooks.map((b, idx) => ({
      Top: idx + 1,
      "Tên sách": b.title,
      Barcode: b.barcode,
      "Lượt mượn trong kỳ": b.count,
    }));

    const sheetKhoaDocGia = facultyStats.map((f) => ({
      "Khoa / Phòng ban": f.faculty,
      "Số lượt mượn": f.borrows,
      "Số độc giả tham gia": f.borrowers,
    }));

    exportExcel(`Bao_cao_thu_vien_${todayStamp()}`, [
      { name: "Tong quan", rows: sheetTongQuan },
      { name: "Theo the loai", rows: sheetTheLoai },
      { name: "Sach theo Khoa", rows: sheetSachTheoKhoa },
      { name: "Top muon nhieu", rows: sheetTopMuon },
      { name: "Ban doc theo Khoa", rows: sheetKhoaDocGia },
    ]);
    toast.success("Đã xuất file báo cáo Excel toàn diện!");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell>
      <div className="print:hidden">
        <PageHeader
          title="Báo cáo & Thống kê Thư viện"
          description={`Khoảng thời gian: ${labelRange}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Printer className="h-4 w-4" />}
                onClick={handlePrint}
              >
                In báo cáo (PDF)
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<FileSpreadsheet className="h-4 w-4" />}
                onClick={handleExportExcel}
              >
                Xuất Excel toàn diện
              </Button>
            </div>
          }
        />

        {/* Toolbar Chọn Kỳ Báo Cáo */}
        <Card className="mb-6">
          <CardBody className="p-4">
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Kỳ báo cáo" className="w-48">
                <Select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value as PeriodPreset)}
                >
                  <option value="this_month">Tháng này</option>
                  <option value="last_month">Tháng trước</option>
                  <option value="this_quarter">Quý này</option>
                  <option value="this_year">Năm nay</option>
                  <option value="custom">Tùy chọn khoảng ngày</option>
                </Select>
              </Field>

              {preset === "custom" && (
                <>
                  <Field label="Từ ngày">
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </Field>
                  <Field label="Đến ngày">
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </Field>
                </>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* VÙNG NỘI DUNG BÁO CÁO (HIỂN THỊ CẢ TRÊN MÀN HÌNH & KHI IN) */}
      <div className="space-y-6 print:space-y-4">
        {/* Tiêu đề in */}
        <div className="hidden print:block text-center border-b pb-4 mb-4">
          <p className="text-xs font-bold uppercase">{settings.schoolName}</p>
          <h1 className="text-xl font-bold uppercase mt-1">BÁO CÁO HOẠT ĐỘNG THƯ VIỆN</h1>
          <p className="text-xs text-slate-600 mt-0.5">Thời gian: {labelRange}</p>
        </div>

        {/* Thống Kê Tổng Quan Trong Kỳ */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Lượt mượn trong kỳ"
            value={formatNumber(borrowsCount)}
            icon={<TrendingUp className="h-5 w-5" />}
            tone="blue"
          />
          <StatCard
            label="Lượt trả trong kỳ"
            value={formatNumber(returnsCount)}
            icon={<TrendingDown className="h-5 w-5" />}
            tone="emerald"
          />
          <StatCard
            label="Sách nhập mới trong kỳ"
            value={formatNumber(importedCount)}
            icon={<Package className="h-5 w-5" />}
            tone="cyan"
          />
          <StatCard
            label="Sách đang mượn hiện tại"
            value={formatNumber(summary.borrowed)}
            icon={<BarChart3 className="h-5 w-5" />}
            tone="amber"
          />
        </div>

        {/* Bảng: Báo Cáo Theo Thể Loại */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="1. Báo cáo Sách theo Thể loại"
              description="Phân bổ đầu sách và cuốn theo thể loại chuyên môn"
              icon={<Layers className="h-5 w-5 text-blue-600" />}
            />
            <div className="overflow-x-auto max-h-[360px]">
              <Table>
                <THead>
                  <tr>
                    <Th>Thể loại</Th>
                    <Th className="text-right">Đầu sách</Th>
                    <Th className="text-right">Tổng cuốn</Th>
                    <Th className="text-right">Có sẵn</Th>
                    <Th className="text-right">Đang mượn</Th>
                  </tr>
                </THead>
                <TBody>
                  {catStats.map((c) => (
                    <tr key={c.categoryId} className="hover:bg-slate-50">
                      <Td className="font-semibold text-xs text-slate-900">{c.name}</Td>
                      <Td className="text-right text-xs text-slate-600">{c.titles}</Td>
                      <Td className="text-right font-bold text-xs text-slate-900">{c.copies}</Td>
                      <Td className="text-right font-semibold text-xs text-emerald-600">{c.available}</Td>
                      <Td className="text-right font-semibold text-xs text-amber-600">{c.borrowed}</Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>

          {/* Bảng: Báo Cáo Sách Theo Khoa */}
          <Card>
            <CardHeader
              title="2. Báo cáo Sách theo Khoa / Đơn vị"
              description="Số lượng đầu sách và tài liệu phân bổ theo từng Khoa"
              icon={<GraduationCap className="h-5 w-5 text-purple-600" />}
            />
            <div className="overflow-x-auto max-h-[360px]">
              <Table>
                <THead>
                  <tr>
                    <Th>Khoa / Đơn vị</Th>
                    <Th className="text-right">Đầu sách</Th>
                    <Th className="text-right">Tổng cuốn</Th>
                    <Th className="text-right">Có sẵn</Th>
                    <Th className="text-right">Đang mượn</Th>
                  </tr>
                </THead>
                <TBody>
                  {bookFacultyStats.map((f) => (
                    <tr key={f.faculty} className="hover:bg-slate-50">
                      <Td className="font-semibold text-xs text-slate-900">{f.faculty}</Td>
                      <Td className="text-right text-xs text-slate-600">{f.titles}</Td>
                      <Td className="text-right font-bold text-xs text-slate-900">{f.copies}</Td>
                      <Td className="text-right font-semibold text-xs text-emerald-600">{f.available}</Td>
                      <Td className="text-right font-semibold text-xs text-amber-600">{f.borrowed}</Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Hàng 2: Top Sách Mượn Nhiều & Sách Ít Mượn */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top mượn */}
          <Card>
            <CardHeader
              title="2. Top Sách Được Mượn Nhiều Nhất Trong Kỳ"
              icon={<Sparkles className="h-5 w-5 text-amber-500" />}
            />
            <div className="overflow-x-auto">
              {topBooks.length > 0 ? (
                <Table>
                  <THead>
                    <tr>
                      <Th>Top</Th>
                      <Th>Tên sách</Th>
                      <Th className="text-right">Số lượt mượn</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {topBooks.map((b, idx) => (
                      <tr key={b.bookId} className="hover:bg-slate-50">
                        <Td className="font-bold text-xs text-slate-500">#{idx + 1}</Td>
                        <Td className="text-xs font-semibold text-slate-900 max-w-[220px] truncate">{b.title}</Td>
                        <Td className="text-right font-bold text-xs text-blue-600">{b.count} lượt</Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <EmptyState title="Không có lượt mượn nào trong kỳ này" />
              )}
            </div>
          </Card>

          {/* Báo cáo theo Khoa */}
          <Card>
            <CardHeader
              title="3. Thống kê Mượn Sách theo Khoa / Đơn vị"
              icon={<GraduationCap className="h-5 w-5 text-indigo-600" />}
            />
            <div className="overflow-x-auto">
              {facultyStats.length > 0 ? (
                <Table>
                  <THead>
                    <tr>
                      <Th>Khoa / Phòng ban</Th>
                      <Th className="text-right">Số độc giả</Th>
                      <Th className="text-right">Tổng lượt mượn</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {facultyStats.map((f) => (
                      <tr key={f.faculty} className="hover:bg-slate-50">
                        <Td className="font-semibold text-xs text-slate-900">{f.faculty}</Td>
                        <Td className="text-right text-xs text-slate-600">{f.borrowers} bạn đọc</Td>
                        <Td className="text-right font-bold text-xs text-indigo-600">{f.borrows} lượt</Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <EmptyState title="Chưa có dữ liệu mượn theo khoa" />
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
