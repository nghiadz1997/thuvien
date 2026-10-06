"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  BookMarked,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  History,
  Info,
  Package,
  Printer,
  ShieldAlert,
  Sliders,
  Tag,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { PageHeader, InfoRow } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Table, TBody, Td, Th, THead } from "@/components/ui/Table";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { BarcodeLabel } from "@/components/barcode/BarcodeLabel";
import { BarcodeSvg } from "@/components/barcode/BarcodeSvg";
import { useAuth } from "@/hooks/useAuth";
import { useBooks, useCategories, useSettings } from "@/hooks/useRealtime";
import { useAsync } from "@/hooks/useAsync";
import { printIsolatedBarcodeLabels, downloadLabelImage, downloadStandaloneQRCode } from "@/utils/printLabel";
import {
  adjustStock,
  deleteBook,
  getBook,
  STOCK_ADJUST_OPTIONS,
  type StockAdjustKind,
} from "@/services/book.service";
import { getTransactionsByBook } from "@/services/transaction.service";
import { getLoansByBook } from "@/services/loan.service";
import { formatDate, formatDateTime, formatNumber } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { LOAN_STATUS_LABELS, TRANSACTION_COLORS, TRANSACTION_LABELS } from "@/lib/constants";
import type { Book, Loan, Transaction } from "@/types";

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: realtimeBooks } = useBooks();
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();
  const { can, actor } = useAuth();

  // Tìm trong realtime store trước, nếu chưa có thì tải từ getBook
  const realtimeBook = realtimeBooks.find((b) => b.id === id);

  const {
    data: fetchedBook,
    loading: loadingBook,
    error: errorBook,
    reload: reloadBook,
  } = useAsync<Book | null>(() => getBook(id), [id]);

  const book = realtimeBook || fetchedBook;

  // Lịch sử giao dịch của sách này
  const { data: transactions, loading: loadingTx, reload: reloadTx } = useAsync<Transaction[]>(
    () => getTransactionsByBook(id, 100),
    [id],
  );

  // Lịch sử mượn / trả của sách này
  const { data: loans, loading: loadingLoans, reload: reloadLoans } = useAsync<Loan[]>(
    () => getLoansByBook(id),
    [id],
  );

  // Modal Điều chỉnh kho
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustKind, setAdjustKind] = useState<StockAdjustKind>("available_to_damaged");
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustNote, setAdjustNote] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // In tem mã vạch
  const [printModal, setPrintModal] = useState(false);
  const [printCopies, setPrintCopies] = useState(1);
  const [printType, setPrintType] = useState<"combo" | "qrcode" | "barcode">("combo");

  // Xóa sách
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const categoryName = categories.find((c) => c.id === book?.categoryId)?.name || "Chưa phân loại";

  const handleAdjustStock = async () => {
    if (!book || !actor) return;
    if (adjustQty < 1) {
      toast.error("Số lượng phải ≥ 1");
      return;
    }
    setAdjusting(true);
    try {
      await adjustStock(book.id, adjustKind, adjustQty, adjustNote.trim(), actor);
      toast.success("Điều chỉnh kho thành công!");
      setAdjustOpen(false);
      setAdjustQty(1);
      setAdjustNote("");
      reloadBook();
      reloadTx();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAdjusting(false);
    }
  };

  const handleDelete = async () => {
    if (!book || !actor) return;
    setDeleting(true);
    try {
      await deleteBook(book.id, actor);
      toast.success("Đã xóa đầu sách thành công");
      router.replace("/books");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  if (loadingBook && !book) {
    return (
      <AppShell>
        <LoadingState label="Đang tải thông tin sách..." />
      </AppShell>
    );
  }

  if (errorBook || !book) {
    return (
      <AppShell>
        <ErrorState
          message={errorBook || "Không tìm thấy thông tin cuốn sách này."}
          onRetry={reloadBook}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          href="/books"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách sách
        </Link>
      </div>

      <PageHeader
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>{book.title}</span>
            <Badge color={book.status === "active" ? "green" : "red"}>
              {book.status === "active" ? "Đang hoạt động" : "Bị khóa"}
            </Badge>
          </div>
        }
        description={`Mã sách: ${book.bookCode} • Barcode: ${book.barcode}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Printer className="h-4 w-4" />}
              onClick={() => {
                setPrintCopies(1);
                setPrintModal(true);
              }}
            >
              In tem Barcode
            </Button>
            {can("book:write") && (
              <Button
                variant="primary"
                size="sm"
                icon={<Sliders className="h-4 w-4" />}
                onClick={() => setAdjustOpen(true)}
              >
                Điều chỉnh kho
              </Button>
            )}
            {can("book:delete") && (
              <Button
                variant="danger"
                size="sm"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setDeleteConfirm(true)}
              >
                Xóa
              </Button>
            )}
          </div>
        }
      />

      {/* 5 Card Số Lượng Tồn Kho */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        <StatCard
          label="Tổng số lượng"
          value={formatNumber(book.quantityTotal)}
          icon={<Package className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Hiện có sẵn"
          value={formatNumber(book.quantityAvailable)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          label="Đang cho mượn"
          value={formatNumber(book.quantityBorrowed)}
          icon={<Clock className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Bị hư"
          value={formatNumber(book.quantityDamaged)}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="orange"
        />
        <StatCard
          label="Bị mất"
          value={formatNumber(book.quantityLost)}
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cột trái: Thông tin chi tiết + Mã vạch */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader title="Thông tin chi tiết" icon={<Info className="h-5 w-5 text-blue-600" />} />
            <CardBody className="space-y-2">
              <InfoRow label="Mã sách">{book.bookCode}</InfoRow>
              <InfoRow label="Mã vạch (Barcode)">{book.barcode}</InfoRow>
              <InfoRow label="Tác giả">{book.author || "—"}</InfoRow>
              <InfoRow label="Thể loại">{categoryName}</InfoRow>
              <InfoRow label="Khoa / Đơn vị">{book.faculty || "Khác / Toàn trường"}</InfoRow>
              <InfoRow label="Nhà xuất bản">{book.publisher || "—"}</InfoRow>
              <InfoRow label="Năm xuất bản">{book.publishYear || "—"}</InfoRow>
              <InfoRow label="ISBN">{book.isbn || "—"}</InfoRow>
              <InfoRow label="Vị trí kệ">{book.shelfLocation || "—"}</InfoRow>
              <InfoRow label="Ngày nhập kho">{formatDate(book.dateAdded)}</InfoRow>
              <InfoRow label="Tổng lượt mượn">{book.totalBorrowCount || 0} lượt</InfoRow>
              {book.notes && (
                <div className="pt-2">
                  <p className="text-xs text-slate-400">Ghi chú:</p>
                  <p className="text-xs text-slate-700 mt-0.5 bg-slate-50 p-2 rounded">{book.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Mã vạch Code 128" icon={<Tag className="h-5 w-5 text-indigo-600" />} />
            <CardBody className="flex flex-col items-center justify-center p-4">
              <BarcodeSvg value={book.barcode} height={50} width={1.6} />
              <p className="mt-2 font-mono text-xs font-semibold text-slate-700">{book.barcode}</p>
            </CardBody>
          </Card>
        </div>

        {/* Cột phải: Lịch sử mượn trả & Lịch sử giao dịch */}
        <div className="space-y-6 lg:col-span-2">
          {/* Lịch sử mượn trả */}
          <Card>
            <CardHeader
              title="Lịch sử Mượn / Trả của sách này"
              description="Các độc giả từng mượn cuốn sách này"
              icon={<Users className="h-5 w-5 text-blue-600" />}
            />
            <div className="overflow-x-auto">
              {loadingLoans ? (
                <LoadingState label="Đang tải lịch sử mượn..." />
              ) : loans && loans.length > 0 ? (
                <Table>
                  <THead>
                    <tr>
                      <Th>Người mượn</Th>
                      <Th>Ngày mượn</Th>
                      <Th>Hạn trả</Th>
                      <Th>Ngày trả</Th>
                      <Th>Trạng thái</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {loans.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <Td className="font-medium text-xs text-slate-900">{l.borrowerName}</Td>
                        <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(l.borrowDate)}</Td>
                        <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(l.dueDate)}</Td>
                        <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(l.returnDate)}</Td>
                        <Td>
                          <Badge
                            color={
                              l.status === "returned"
                                ? "green"
                                : l.status === "borrowing"
                                  ? "amber"
                                  : "red"
                            }
                          >
                            {LOAN_STATUS_LABELS[l.status] || l.status}
                          </Badge>
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <EmptyState title="Chưa có lượt mượn nào" />
              )}
            </div>
          </Card>

          {/* Lịch sử giao dịch chi tiết */}
          <Card>
            <CardHeader
              title="Lịch sử Biến động Kho (Transaction Logs)"
              description="Mọi thay đổi về số lượng sách đều được ghi nhận tự động"
              icon={<History className="h-5 w-5 text-indigo-600" />}
            />
            <div className="overflow-x-auto">
              {loadingTx ? (
                <LoadingState label="Đang tải lịch sử giao dịch..." />
              ) : transactions && transactions.length > 0 ? (
                <Table>
                  <THead>
                    <tr>
                      <Th>Thời gian</Th>
                      <Th>Loại GD</Th>
                      <Th className="text-right">SL</Th>
                      <Th className="text-right">Còn trước → sau</Th>
                      <Th>Ghi chú</Th>
                      <Th>Người thực hiện</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(t.createdAt)}</Td>
                        <Td>
                          <span
                            className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                              TRANSACTION_COLORS[t.type] || "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {TRANSACTION_LABELS[t.type] || t.type}
                          </span>
                        </Td>
                        <Td className="text-right font-bold text-xs text-slate-800">{t.quantity}</Td>
                        <Td className="text-right text-xs font-mono text-slate-600 whitespace-nowrap">
                          {t.beforeQuantity} → {t.afterQuantity}
                        </Td>
                        <Td className="text-xs text-slate-600 max-w-[200px] truncate">{t.note || "—"}</Td>
                        <Td className="text-xs text-slate-500">{t.createdByName || "—"}</Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <EmptyState title="Chưa có nhật ký giao dịch nào" />
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Modal Điều chỉnh kho */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={`Điều chỉnh kho: ${book.title}`}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjusting}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleAdjustStock} loading={adjusting}>
              Xác nhận điều chỉnh
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Loại điều chỉnh" required>
            <Select
              value={adjustKind}
              onChange={(e) => setAdjustKind(e.target.value as StockAdjustKind)}
            >
              {STOCK_ADJUST_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Số lượng cuốn" required>
            <Input
              type="number"
              min={1}
              value={adjustQty}
              onChange={(e) => setAdjustQty(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
          </Field>

          <Field label="Lý do / Ghi chú">
            <Textarea
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="Nhập lý do điều chỉnh hoặc mã biên bản..."
            />
          </Field>
        </div>
      </Modal>

      {/* Modal In Tem Barcode */}
      <Modal
        open={printModal}
        onClose={() => setPrintModal(false)}
        title="In & Lưu tem nhãn sách (Barcode / QR Code)"
        size="md"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                icon={<Download className="h-4 w-4 text-emerald-600" />}
                onClick={async () => {
                  if (!book) return;
                  await downloadLabelImage({
                    schoolName: settings.schoolName || "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
                    title: book.title,
                    bookCode: book.bookCode,
                    barcode: book.barcode,
                    type: printType,
                  });
                  toast.success("Đã tải ảnh tem (PNG)!");
                }}
              >
                Lưu ảnh tem (PNG)
              </Button>
              <Button
                variant="outline"
                icon={<Download className="h-4 w-4 text-blue-600" />}
                onClick={async () => {
                  if (!book) return;
                  await downloadStandaloneQRCode({
                    title: book.title,
                    bookCode: book.bookCode,
                    barcode: book.barcode,
                  });
                  toast.success("Đã lưu riêng mã QR (PNG)!");
                }}
              >
                Lưu riêng mã QR
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setPrintModal(false)}>
                Đóng
              </Button>
              <Button
                variant="primary"
                icon={<Printer className="h-4 w-4" />}
                onClick={async () => {
                  if (!book) return;
                  await printIsolatedBarcodeLabels({
                    schoolName: settings.schoolName || "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
                    title: book.title,
                    bookCode: book.bookCode,
                    barcode: book.barcode,
                    copies: printCopies,
                    type: printType,
                  });
                }}
              >
                In tem ngay
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Số lượng tem cần in">
              <Input
                type="number"
                min={1}
                max={100}
                value={printCopies}
                onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </Field>

            <Field label="Định dạng tem in & lưu">
              <Select
                value={printType}
                onChange={(e) => setPrintType(e.target.value as "barcode" | "qrcode" | "combo")}
              >
                <option value="combo">⭐ Combo: QR Code + Barcode (Khuyên dùng)</option>
                <option value="qrcode">📱 Mã QR (Điện thoại quét nhanh nhất)</option>
                <option value="barcode">🏷️ Mã vạch Barcode 1D (Code 128)</option>
              </Select>
            </Field>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">
              Bản xem trước tem in
            </p>
            <div className="flex justify-center">
              <BarcodeLabel
                schoolName={settings.schoolName}
                title={book.title}
                bookCode={book.bookCode}
                barcode={book.barcode}
                type={printType}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm Xóa Sách */}
      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Xác nhận xóa sách"
        danger
        loading={deleting}
        confirmText="Xác nhận xóa"
        message={`Bạn có chắc muốn xóa đầu sách "${book.title}" (${book.bookCode})? Hành động này sẽ được ghi vào Transaction Log.`}
      />
    </AppShell>
  );
}
