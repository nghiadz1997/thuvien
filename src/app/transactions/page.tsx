"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Form";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Table, TBody, Td, Th, THead, Pagination } from "@/components/ui/Table";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { useAuth } from "@/hooks/useAuth";
import { useTable } from "@/hooks/useTable";
import { useAsync } from "@/hooks/useAsync";
import { deleteTransaction, getTransactionsInRange } from "@/services/transaction.service";
import { TRANSACTION_COLORS, TRANSACTION_LABELS } from "@/lib/constants";
import { exportExcel, todayStamp } from "@/utils/excel";
import { endOfDay, formatDateTime, formatDate, fromInputDate, startOfDay, toInputDate } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { matchesSearch } from "@/utils/text";
import type { Transaction, TransactionType } from "@/types";

export default function TransactionsPage() {
  const { can } = useAuth();

  // Date range presets
  const today = new Date();
  const [fromDateStr, setFromDateStr] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDateStr, setToDateStr] = useState(toInputDate(today));
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const fromDate = useMemo(() => startOfDay(fromInputDate(fromDateStr) || new Date()), [fromDateStr]);
  const toDate = useMemo(() => endOfDay(fromInputDate(toDateStr) || new Date()), [toDateStr]);

  const { data: rawTransactions, loading, error, reload } = useAsync<Transaction[]>(
    () => getTransactionsInRange(fromDate, toDate, 5000),
    [fromDate.getTime(), toDate.getTime()],
  );

  const transactions = rawTransactions || [];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      if (search.trim()) {
        const full = `${t.bookTitle} ${t.barcode} ${t.borrowerName} ${t.createdByName} ${t.note}`;
        if (!matchesSearch(full, search)) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, search]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageRows, sort, toggleSort, total } = useTable(
    filteredTransactions,
    {
      pageSize: 20,
      initialSort: { key: "createdAt", dir: "desc" },
    },
  );

  // Admin delete state
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingTx) return;
    setDeleting(true);
    try {
      await deleteTransaction(deletingTx.id);
      toast.success("Đã xóa bản ghi giao dịch");
      setDeletingTx(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      toast.warning("Không có giao dịch để xuất");
      return;
    }
    const rows = filteredTransactions.map((t, idx) => ({
      STT: idx + 1,
      "Thời gian": formatDateTime(t.createdAt),
      "Loại giao dịch": TRANSACTION_LABELS[t.type] || t.type,
      "Tên sách": t.bookTitle,
      "Mã vạch (Barcode)": t.barcode,
      "Số lượng": t.quantity,
      "Tồn trước GD": t.beforeQuantity,
      "Tồn sau GD": t.afterQuantity,
      "Người mượn": t.borrowerName,
      "Người thực hiện": t.createdByName,
      "Ghi chú": t.note,
    }));
    exportExcel(`Lich_su_giao_dich_${todayStamp()}`, [{ name: "Giao dich", rows }]);
    toast.success("Đã xuất lịch sử giao dịch ra Excel!");
  };

  return (
    <AppShell>
      <PageHeader
        title="Lịch sử Giao dịch & Biến động Kho"
        description="Lưu vết toàn bộ hoạt động xuất, nhập, mượn, trả, hư hao và kiểm kê sách"
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
            onClick={handleExportExcel}
          >
            Xuất Excel
          </Button>
        }
      />

      {/* Toolbar lọc */}
      <Card className="mb-4">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm sách, barcode, thủ thư, bạn đọc..."
                className="pl-9"
              />
            </div>

            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="ALL">Tất cả loại giao dịch</option>
              {Object.entries(TRANSACTION_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>

            <Field label="Từ ngày" className="!mb-0">
              <Input
                type="date"
                value={fromDateStr}
                onChange={(e) => setFromDateStr(e.target.value)}
              />
            </Field>

            <Field label="Đến ngày" className="!mb-0">
              <Input
                type="date"
                value={toDateStr}
                onChange={(e) => setToDateStr(e.target.value)}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Bảng Dữ Liệu */}
      <Card>
        {loading && transactions.length === 0 ? (
          <LoadingState label="Đang tải lịch sử giao dịch..." />
        ) : filteredTransactions.length === 0 ? (
          <EmptyState title="Không tìm thấy giao dịch nào trong khoảng thời gian này" />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <Th sortKey="createdAt" sort={sort} onSort={toggleSort}>
                    Thời gian
                  </Th>
                  <Th>Loại giao dịch</Th>
                  <Th sortKey="bookTitle" sort={sort} onSort={toggleSort}>
                    Tên sách / Barcode
                  </Th>
                  <Th className="text-right" sortKey="quantity" sort={sort} onSort={toggleSort}>
                    SL
                  </Th>
                  <Th className="text-right">Tồn khả dụng</Th>
                  <Th>Độc giả / Khoa</Th>
                  <Th>Người thực hiện</Th>
                  <Th>Ghi chú</Th>
                  {can("transaction:delete") && <Th className="text-center">Xóa</Th>}
                </tr>
              </THead>
              <TBody>
                {pageRows.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(t.createdAt)}</Td>
                    <Td className="whitespace-nowrap">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                          TRANSACTION_COLORS[t.type] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {TRANSACTION_LABELS[t.type] || t.type}
                      </span>
                    </Td>
                    <Td className="max-w-[220px]">
                      <p className="font-semibold text-xs text-slate-900 line-clamp-1">{t.bookTitle}</p>
                      <p className="font-mono text-[10px] text-blue-600">{t.barcode}</p>
                    </Td>
                    <Td className="text-right font-bold text-xs text-slate-900">{t.quantity}</Td>
                    <Td className="text-right text-xs font-mono text-slate-600 whitespace-nowrap">
                      {t.beforeQuantity} → {t.afterQuantity}
                    </Td>
                    <Td className="max-w-[140px] text-xs">
                      {t.borrowerName ? (
                        <>
                          <p className="font-medium text-slate-800 truncate">{t.borrowerName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{t.borrowerFaculty}</p>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{t.createdByName || "—"}</Td>
                    <Td className="text-xs text-slate-500 max-w-[180px] truncate" title={t.note}>
                      {t.note || "—"}
                    </Td>
                    {can("transaction:delete") && (
                      <Td className="text-center">
                        <button
                          onClick={() => setDeletingTx(t)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                          title="Xóa nhật ký (Chỉ Admin)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Td>
                    )}
                  </tr>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}
      </Card>

      {/* Confirm Xóa Giao Dịch */}
      <ConfirmDialog
        open={Boolean(deletingTx)}
        onClose={() => setDeletingTx(null)}
        onConfirm={handleDelete}
        title="Xác nhận xóa bản ghi giao dịch"
        danger
        loading={deleting}
        confirmText="Xóa bản ghi"
        message="Hành động này chỉ xóa dòng lịch sử và không hoàn tác lại số lượng tồn kho của sách. Bạn có chắc muốn xóa?"
      />
    </AppShell>
  );
}
