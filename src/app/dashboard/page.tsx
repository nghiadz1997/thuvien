"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BookCheck,
  BookCopy,
  BookMarked,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Layers,
  PackageCheck,
  PackagePlus,
  PlusCircle,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard, Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TBody, Td, Th, THead } from "@/components/ui/Table";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useActiveLoans, useBooks, useCategories, useSettings } from "@/hooks/useRealtime";
import { useAsync } from "@/hooks/useAsync";
import { getRecentTransactions, getTransactionsInRange } from "@/services/transaction.service";
import {
  computeCategoryStats,
  computeMonthlySeries,
  computeStockSummary,
  lowStockBooks,
  newestBooks,
  overdueLoans,
  topBorrowedAllTime,
} from "@/services/report.service";
import { formatDate, formatDateTime, formatNumber, monthLabel, monthRange } from "@/utils/format";
import { TRANSACTION_COLORS, TRANSACTION_LABELS } from "@/lib/constants";
import type { Transaction } from "@/types";

const PIE_COLORS = ["#2563eb", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

export default function DashboardPage() {
  const { data: books, loading: loadingBooks, error: errorBooks, retry: retryBooks } = useBooks();
  const { data: categories, loading: loadingCats } = useCategories();
  const { data: loans, loading: loadingLoans } = useActiveLoans();
  const { data: settings } = useSettings();

  // Lấy dữ liệu giao dịch 6 tháng gần nhất để vẽ biểu đồ và tính số nhập tháng
  const { startDate, endDate, months } = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
    return { startDate: start, endDate: end, months: monthRange(start, end) };
  }, []);

  const { data: periodTx, loading: loadingTx } = useAsync<Transaction[]>(
    () => getTransactionsInRange(startDate, endDate, 3000),
    [startDate.getTime(), endDate.getTime()],
  );

  const { data: recentTx, loading: loadingRecent } = useAsync<Transaction[]>(() => getRecentTransactions(8), []);

  // Tính toán số liệu thống kê
  const summary = useMemo(() => {
    return computeStockSummary(books, loans, periodTx || []);
  }, [books, loans, periodTx]);

  const monthlySeries = useMemo(() => {
    const series = computeMonthlySeries(periodTx || [], months);
    return series.map((s) => ({
      ...s,
      label: monthLabel(s.month),
    }));
  }, [periodTx, months]);

  const categoryStats = useMemo(() => {
    return computeCategoryStats(books, categories, periodTx || []);
  }, [books, categories, periodTx]);

  const top10Books = useMemo(() => {
    return topBorrowedAllTime(books, 10);
  }, [books]);

  const listOverdue = useMemo(() => {
    return overdueLoans(loans);
  }, [loans]);

  const listLowStock = useMemo(() => {
    return lowStockBooks(books, settings, 6);
  }, [books, settings]);

  const listNewest = useMemo(() => {
    return newestBooks(books, 6);
  }, [books]);

  if (errorBooks) {
    return (
      <AppShell>
        <ErrorState message={errorBooks} onRetry={retryBooks} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Tổng quan thư viện"
        description="Số liệu hoạt động thực tế thời gian thực từ hệ thống cơ sở dữ liệu"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/import">
              <Button variant="primary" icon={<PlusCircle className="h-4 w-4" />}>
                Nhập sách mới
              </Button>
            </Link>
            <Link href="/circulation">
              <Button variant="outline" icon={<BookCheck className="h-4 w-4" />}>
                Mượn / Trả sách
              </Button>
            </Link>
          </div>
        }
      />

      {/* Cảnh báo dữ liệu bất thường nếu có */}
      {summary.anomalies.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Cảnh báo tính toàn vẹn dữ liệu ({summary.anomalies.length} đầu sách)
          </div>
          <p className="mt-1 text-xs text-red-700">
            Một số đầu sách có tổng số lượng không khớp với (còn + mượn + hư + mất):
          </p>
          <ul className="mt-2 list-inside list-disc text-xs space-y-0.5">
            {summary.anomalies.slice(0, 3).map((a) => (
              <li key={a.book.id}>
                <strong>{a.book.title}</strong> ({a.book.bookCode}): {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 8 Card Thống Kê Chính */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Tổng đầu sách"
          value={formatNumber(summary.titles)}
          icon={<BookMarked className="h-5 w-5" />}
          tone="indigo"
          hint="Đầu sách khác nhau"
        />
        <StatCard
          label="Tổng số cuốn sách"
          value={formatNumber(summary.total)}
          icon={<BookCopy className="h-5 w-5" />}
          tone="blue"
          hint="Bao gồm toàn bộ trong kho"
        />
        <StatCard
          label="Sách hiện còn"
          value={formatNumber(summary.available)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
          hint="Sẵn sàng cho mượn trên kệ"
        />
        <StatCard
          label="Đang cho mượn"
          value={formatNumber(summary.borrowed)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="amber"
          hint="Độc giả đang giữ"
        />
        <StatCard
          label="Sách quá hạn"
          value={formatNumber(summary.overdue)}
          icon={<Clock className="h-5 w-5" />}
          tone="red"
          hint="Chưa hoàn trả đúng hẹn"
        />
        <StatCard
          label="Sách bị hư"
          value={formatNumber(summary.damaged)}
          icon={<AlertCircle className="h-5 w-5" />}
          tone="orange"
          hint="Chờ sửa chữa / thanh lý"
        />
        <StatCard
          label="Sách bị mất"
          value={formatNumber(summary.lost)}
          icon={<XCircle className="h-5 w-5" />}
          tone="slate"
          hint="Đã báo mất / xử lý"
        />
        <StatCard
          label="Mới nhập gần đây"
          value={formatNumber(summary.newThisMonth)}
          icon={<PackagePlus className="h-5 w-5" />}
          tone="cyan"
          hint="Cuốn sách nhập thêm"
        />
      </div>

      {/* Hàng biểu đồ 1: Mượn / Trả / Nhập theo tháng & Sách theo thể loại */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Biểu đồ Lưu thông Sách (6 Tháng Gần Nhất)"
            description="Số lượt mượn, lượt trả và số lượng sách nhập theo từng tháng"
            icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          />
          <CardBody>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySeries} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                  <Line type="monotone" dataKey="borrow" name="Lượt mượn" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="return" name="Lượt trả" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="import" name="Số cuốn nhập" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Sách theo Thể loại"
            description="Phân bố số lượng cuốn theo từng thể loại"
            icon={<Layers className="h-5 w-5 text-indigo-600" />}
          />
          <CardBody>
            {categoryStats.length === 0 ? (
              <EmptyState title="Chưa có thể loại nào" />
            ) : (
              <div className="h-72 w-full flex flex-col items-center justify-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={categoryStats.slice(0, 6)}
                      dataKey="copies"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {categoryStats.slice(0, 6).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: unknown) => [formatNumber(Number(val)) + " cuốn", "Số lượng"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 w-full space-y-1 overflow-y-auto max-h-24 pr-1 text-xs">
                  {categoryStats.slice(0, 6).map((cat, idx) => (
                    <div key={cat.categoryId} className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="font-semibold text-slate-800 tabular-nums">{formatNumber(cat.copies)} cuốn</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Hàng biểu đồ 2: Top 10 Sách Được Mượn Nhiều Nhất */}
      <div className="mt-6">
        <Card>
          <CardHeader
            title="Top 10 Sách Được Mượn Nhiều Nhất"
            description="Thống kê tổng số lượt mượn tích lũy của từng đầu sách"
            icon={<Sparkles className="h-5 w-5 text-amber-500" />}
          />
          <CardBody>
            {top10Books.length === 0 ? (
              <EmptyState title="Chưa có dữ liệu mượn sách" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10Books} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="title"
                      stroke="#64748b"
                      fontSize={11}
                      interval={0}
                      tick={({ x, y, payload }) => (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={12} textAnchor="end" fill="#64748b" transform="rotate(-20)" fontSize={10}>
                            {payload.value.length > 18 ? payload.value.slice(0, 16) + "..." : payload.value}
                          </text>
                        </g>
                      )}
                    />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      formatter={(val: unknown) => [formatNumber(Number(val)) + " lượt mượn", "Tổng lượt mượn"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={45} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Các bảng tóm tắt: Giao dịch gần nhất, Sách quá hạn, Sách sắp hết, Sách mới thêm */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bảng: Giao dịch gần nhất */}
        <Card>
          <CardHeader
            title="Giao dịch Gần nhất"
            description="Các hoạt động mượn, trả, nhập kho vừa diễn ra"
            icon={<History className="h-5 w-5 text-blue-600" />}
            actions={
              <Link href="/transactions">
                <Button variant="ghost" size="sm">
                  Xem tất cả
                </Button>
              </Link>
            }
          />
          <div className="overflow-x-auto">
            {recentTx && recentTx.length > 0 ? (
              <Table>
                <THead>
                  <tr>
                    <Th>Thời gian</Th>
                    <Th>Loại</Th>
                    <Th>Tên sách</Th>
                    <Th>Người thực hiện</Th>
                  </tr>
                </THead>
                <TBody>
                  {recentTx.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(tx.createdAt)}</Td>
                      <Td>
                        <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TRANSACTION_COLORS[tx.type] || "bg-slate-100 text-slate-700"}`}>
                          {TRANSACTION_LABELS[tx.type] || tx.type}
                        </span>
                      </Td>
                      <Td className="font-medium text-slate-800 text-xs max-w-[180px] truncate">
                        {tx.bookTitle || "—"}
                      </Td>
                      <Td className="text-xs text-slate-600 truncate max-w-[120px]">{tx.createdByName || tx.borrowerName || "—"}</Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            ) : (
              <EmptyState title="Chưa có giao dịch nào" />
            )}
          </div>
        </Card>

        {/* Bảng: Sách quá hạn */}
        <Card>
          <CardHeader
            title="Sách Đang Quá Hạn"
            description="Các bạn đọc chưa hoàn trả sách theo đúng thời hạn"
            icon={<Clock className="h-5 w-5 text-red-600" />}
            actions={
              <Link href="/circulation?tab=overdue">
                <Button variant="ghost" size="sm">
                  Xử lý trả sách
                </Button>
              </Link>
            }
          />
          <div className="overflow-x-auto">
            {listOverdue.length > 0 ? (
              <Table>
                <THead>
                  <tr>
                    <Th>Người mượn</Th>
                    <Th>Tên sách</Th>
                    <Th>Hạn trả</Th>
                    <Th>Trễ hạn</Th>
                  </tr>
                </THead>
                <TBody>
                  {listOverdue.slice(0, 6).map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50">
                      <Td className="font-medium text-slate-800 text-xs">{loan.borrowerName}</Td>
                      <Td className="text-xs text-slate-600 max-w-[160px] truncate">{loan.bookTitle}</Td>
                      <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(loan.dueDate)}</Td>
                      <Td>
                        <Badge color="red" className="font-semibold">
                          Trễ {loan.lateDays} ngày
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            ) : (
              <div className="p-6 text-center text-sm text-slate-500">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-1" />
                Không có sách nào đang bị quá hạn!
              </div>
            )}
          </div>
        </Card>

        {/* Bảng: Sách sắp hết trong kho */}
        <Card>
          <CardHeader
            title="Sách Sắp Hết Trên Kệ"
            description={`Số lượng sách có sẵn ≤ ${settings.lowStockThreshold} cuốn`}
            icon={<AlertCircle className="h-5 w-5 text-orange-600" />}
            actions={
              <Link href="/import">
                <Button variant="ghost" size="sm">
                  Nhập bổ sung
                </Button>
              </Link>
            }
          />
          <div className="overflow-x-auto">
            {listLowStock.length > 0 ? (
              <Table>
                <THead>
                  <tr>
                    <Th>Mã sách</Th>
                    <Th>Tên sách</Th>
                    <Th>Kệ</Th>
                    <Th className="text-right">Còn lại</Th>
                  </tr>
                </THead>
                <TBody>
                  {listLowStock.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <Td className="font-mono text-xs text-blue-600">{b.bookCode}</Td>
                      <Td className="font-medium text-slate-800 text-xs max-w-[180px] truncate">{b.title}</Td>
                      <Td className="text-xs text-slate-500">{b.shelfLocation || "—"}</Td>
                      <Td className="text-right">
                        <Badge color={b.quantityAvailable === 0 ? "red" : "amber"}>
                          {b.quantityAvailable} / {b.quantityTotal}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            ) : (
              <div className="p-6 text-center text-sm text-slate-500">
                Tất cả sách đều đảm bảo đủ số lượng trong kho.
              </div>
            )}
          </div>
        </Card>

        {/* Bảng: Sách mới thêm */}
        <Card>
          <CardHeader
            title="Sách Mới Thêm Vào Thư Viện"
            description="Các đầu sách vừa được đăng ký vào hệ thống"
            icon={<BookOpen className="h-5 w-5 text-emerald-600" />}
            actions={
              <Link href="/books">
                <Button variant="ghost" size="sm">
                  Xem tất cả sách
                </Button>
              </Link>
            }
          />
          <div className="overflow-x-auto">
            {listNewest.length > 0 ? (
              <Table>
                <THead>
                  <tr>
                    <Th>Mã sách</Th>
                    <Th>Tên sách</Th>
                    <Th>Tác giả</Th>
                    <Th className="text-right">Tổng cuốn</Th>
                  </tr>
                </THead>
                <TBody>
                  {listNewest.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <Td className="font-mono text-xs text-blue-600">{b.bookCode}</Td>
                      <Td className="font-medium text-slate-800 text-xs max-w-[180px] truncate">{b.title}</Td>
                      <Td className="text-xs text-slate-500 truncate max-w-[120px]">{b.author || "—"}</Td>
                      <Td className="text-right font-semibold text-xs text-slate-800">{b.quantityTotal}</Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            ) : (
              <EmptyState title="Chưa có đầu sách nào" />
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
