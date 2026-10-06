"use client";

import { Suspense, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  CheckCircle,
  Download,
  Edit,
  Eye,
  FileSpreadsheet,
  Filter,
  Lock,
  Plus,
  Printer,
  Search,
  Trash2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Table, TBody, Td, Th, THead, Pagination } from "@/components/ui/Table";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { BarcodeLabel } from "@/components/barcode/BarcodeLabel";
import { BarcodeSvg } from "@/components/barcode/BarcodeSvg";
import { DEFAULT_FACULTIES } from "@/lib/constants";
import { useBooks, useCategories, useSettings } from "@/hooks/useRealtime";
import { useTable } from "@/hooks/useTable";
import { useAuth } from "@/hooks/useAuth";
import { deleteBook, updateBook, type BookUpdateInput } from "@/services/book.service";
import { exportExcel, todayStamp } from "@/utils/excel";
import { formatDate, formatNumber, fromInputDate, toInputDate } from "@/utils/format";
import { matchesSearch } from "@/utils/text";
import { errorMessage } from "@/utils/errors";
import type { Book, BookStatus } from "@/types";

function BooksContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const { data: books, loading, error, retry } = useBooks();
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();
  const { can, actor } = useAuth();

  // Filters
  const [search, setSearch] = useState(initialQ);
  const [catFilter, setCatFilter] = useState("ALL");
  const [facultyFilter, setFacultyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [shelfFilter, setShelfFilter] = useState("ALL");

  useEffect(() => {
    if (initialQ) setSearch(initialQ);
  }, [initialQ]);

  // Unique shelves
  const shelfOptions = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.shelfLocation) set.add(b.shelfLocation.trim());
    });
    return Array.from(set).sort();
  }, [books]);

  // Filtered books
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      if (catFilter !== "ALL" && b.categoryId !== catFilter) return false;
      if (facultyFilter !== "ALL" && (b.faculty || "Khác") !== facultyFilter) return false;
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      if (shelfFilter !== "ALL" && b.shelfLocation !== shelfFilter) return false;
      if (search.trim()) {
        const full = `${b.title} ${b.author} ${b.bookCode} ${b.barcode} ${b.isbn} ${b.publisher} ${b.faculty || ""}`;
        if (!matchesSearch(full, search)) return false;
      }
      return true;
    });
  }, [books, catFilter, facultyFilter, statusFilter, shelfFilter, search]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  // Table pagination & sorting
  const { page, setPage, pageSize, setPageSize, totalPages, pageRows, sort, toggleSort, total } = useTable(
    filteredBooks,
    {
      pageSize: 20,
      initialSort: { key: "createdAt", dir: "desc" },
    },
  );

  // Edit State
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    author: string;
    categoryId: string;
    faculty: string;
    publisher: string;
    publishYear: string;
    isbn: string;
    shelfLocation: string;
    status: BookStatus;
    notes: string;
    dateAdded: string;
  }>({
    title: "",
    author: "",
    categoryId: "",
    faculty: "Khác / Toàn trường",
    publisher: "",
    publishYear: "",
    isbn: "",
    shelfLocation: "",
    status: "active",
    notes: "",
    dateAdded: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete State
  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Print Barcode State
  const [printingBook, setPrintingBook] = useState<Book | null>(null);
  const [printCopies, setPrintCopies] = useState(1);

  const openEdit = (b: Book) => {
    setEditingBook(b);
    setEditForm({
      title: b.title,
      author: b.author,
      categoryId: b.categoryId,
      faculty: b.faculty || "Khác",
      publisher: b.publisher,
      publishYear: b.publishYear ? String(b.publishYear) : "",
      isbn: b.isbn || "",
      shelfLocation: b.shelfLocation || "",
      status: b.status,
      notes: b.notes || "",
      dateAdded: toInputDate(b.dateAdded),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingBook || !actor) return;
    if (!editForm.title.trim()) {
      toast.error("Vui lòng nhập tên sách");
      return;
    }
    setSavingEdit(true);
    try {
      const changes: BookUpdateInput = {
        title: editForm.title.trim(),
        author: editForm.author.trim(),
        categoryId: editForm.categoryId,
        faculty: editForm.faculty.trim() || "Khác",
        publisher: editForm.publisher.trim(),
        publishYear: editForm.publishYear ? parseInt(editForm.publishYear) : null,
        isbn: editForm.isbn.trim(),
        shelfLocation: editForm.shelfLocation.trim(),
        status: editForm.status,
        notes: editForm.notes.trim(),
      };
      if (editForm.dateAdded) {
        const d = fromInputDate(editForm.dateAdded);
        if (d) changes.dateAdded = d;
      }
      await updateBook(editingBook.id, changes, actor);
      toast.success("Cập nhật thông tin sách thành công");
      setEditingBook(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBook || !actor) return;
    setDeleting(true);
    try {
      await deleteBook(deletingBook.id, actor);
      toast.success(`Đã xóa đầu sách ${deletingBook.bookCode}`);
      setDeletingBook(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredBooks.length === 0) {
      toast.warning("Không có dữ liệu để xuất Excel");
      return;
    }
    const rows = filteredBooks.map((b, idx) => ({
      STT: idx + 1,
      "Mã sách": b.bookCode,
      Barcode: b.barcode,
      "Tên sách": b.title,
      "Tác giả": b.author,
      "Thể loại": categoryMap.get(b.categoryId) || "Chưa phân loại",
      Khoa: b.faculty || "Khác / Toàn trường",
      NXB: b.publisher,
      "Năm XB": b.publishYear || "",
      ISBN: b.isbn || "",
      "Ngày nhập": formatDate(b.dateAdded),
      "Tổng số": b.quantityTotal,
      "Còn lại": b.quantityAvailable,
      "Đang mượn": b.quantityBorrowed,
      Hư: b.quantityDamaged,
      Mất: b.quantityLost,
      "Vị trí kệ": b.shelfLocation,
      "Trạng thái": b.status === "active" ? "Hoạt động" : "Khóa",
      "Ghi chú": b.notes,
    }));
    exportExcel(`Danh_sach_sach_${todayStamp()}`, [{ name: "Danh sách sách", rows }]);
    toast.success("Đã xuất file Excel thành công!");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell>
      <PageHeader
        title="Quản lý sách"
        description={`Tổng cộng ${formatNumber(books.length)} đầu sách (${formatNumber(books.reduce((s, b) => s + (b.quantityTotal || 0), 0))} cuốn)`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
              onClick={handleExportExcel}
            >
              Xuất Excel
            </Button>
            {can("book:write") && (
              <Link href="/import">
                <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />}>
                  Nhập sách mới
                </Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Filter Toolbar */}
      <Card className="mb-4">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên, mã, barcode, tác giả, ISBN, khoa..."
                className="pl-9"
              />
            </div>

            <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="ALL">Tất cả thể loại</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Select value={facultyFilter} onChange={(e) => setFacultyFilter(e.target.value)}>
              <option value="ALL">Tất cả khoa / đơn vị</option>
              {DEFAULT_FACULTIES.map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </Select>

            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Bị khóa</option>
            </Select>

            <Select value={shelfFilter} onChange={(e) => setShelfFilter(e.target.value)}>
              <option value="ALL">Tất cả vị trí kệ</option>
              {shelfOptions.map((sh) => (
                <option key={sh} value={sh}>
                  Kệ {sh}
                </option>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Main Table */}
      <Card>
        {loading && books.length === 0 ? (
          <LoadingState label="Đang tải danh sách sách..." />
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : filteredBooks.length === 0 ? (
          <EmptyState
            title="Không tìm thấy sách phù hợp"
            description="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc phía trên"
          />
        ) : (
          <>
            <Table>
              <THead>
                <tr>
                  <Th sortKey="bookCode" sort={sort} onSort={toggleSort}>
                    Mã sách
                  </Th>
                  <Th sortKey="title" sort={sort} onSort={toggleSort}>
                    Tên sách
                  </Th>
                  <Th sortKey="author" sort={sort} onSort={toggleSort}>
                    Tác giả
                  </Th>
                  <Th>Thể loại</Th>
                  <Th>Khoa</Th>
                  <Th className="text-right" sortKey="quantityTotal" sort={sort} onSort={toggleSort}>
                    Tổng
                  </Th>
                  <Th className="text-right" sortKey="quantityAvailable" sort={sort} onSort={toggleSort}>
                    Còn
                  </Th>
                  <Th className="text-right" sortKey="quantityBorrowed" sort={sort} onSort={toggleSort}>
                    Mượn
                  </Th>
                  <Th className="text-right">Hư/Mất</Th>
                  <Th>Kệ</Th>
                  <Th>Trạng thái</Th>
                  <Th className="text-center">Thao tác</Th>
                </tr>
              </THead>
              <TBody>
                {pageRows.map((b) => {
                  const catName = categoryMap.get(b.categoryId) || "—";
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <Td>
                        <div className="font-mono text-xs font-semibold text-blue-600">
                          <Link href={`/books/${b.id}`} className="hover:underline">
                            {b.bookCode}
                          </Link>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{b.barcode}</div>
                      </Td>
                      <Td className="max-w-[220px]">
                        <Link
                          href={`/books/${b.id}`}
                          className="font-medium text-slate-900 hover:text-blue-600 line-clamp-2 text-xs"
                        >
                          {b.title}
                        </Link>
                        {b.publisher && (
                          <span className="text-[10px] text-slate-400">
                            {b.publisher} {b.publishYear ? `(${b.publishYear})` : ""}
                          </span>
                        )}
                      </Td>
                      <Td className="text-xs text-slate-600 max-w-[120px] truncate">{b.author || "—"}</Td>
                      <Td className="text-xs text-slate-600 whitespace-nowrap">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">{catName}</span>
                      </Td>
                      <Td className="text-xs whitespace-nowrap">
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                          {b.faculty || "Khác / Toàn trường"}
                        </span>
                      </Td>
                      <Td className="text-right font-bold text-xs text-slate-900">{b.quantityTotal}</Td>
                      <Td className="text-right font-bold text-xs">
                        <span className={b.quantityAvailable > 0 ? "text-emerald-600" : "text-red-600"}>
                          {b.quantityAvailable}
                        </span>
                      </Td>
                      <Td className="text-right font-medium text-xs text-amber-600">{b.quantityBorrowed}</Td>
                      <Td className="text-right text-xs text-slate-500 whitespace-nowrap">
                        {b.quantityDamaged || b.quantityLost ? (
                          <span className="text-red-600 font-semibold">
                            {b.quantityDamaged}h / {b.quantityLost}m
                          </span>
                        ) : (
                          "0"
                        )}
                      </Td>
                      <Td className="text-xs text-slate-600 whitespace-nowrap">
                        <span className="font-mono">{b.shelfLocation || "—"}</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge color={b.status === "active" ? "green" : "red"}>
                          {b.status === "active" ? "Hoạt động" : "Khóa"}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/books/${b.id}`}>
                            <button
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                              title="Xem chi tiết"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </Link>
                          <button
                            onClick={() => {
                              setPrintingBook(b);
                              setPrintCopies(1);
                            }}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                            title="In tem mã vạch"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {can("book:write") && (
                            <button
                              onClick={() => openEdit(b)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-amber-600"
                              title="Sửa thông tin"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {can("book:delete") && (
                            <button
                              onClick={() => setDeletingBook(b)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                              title="Xóa sách"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
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

      {/* Modal Sửa Sách */}
      <Modal
        open={Boolean(editingBook)}
        onClose={() => setEditingBook(null)}
        title={`Chỉnh sửa: ${editingBook?.bookCode}`}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingBook(null)} disabled={savingEdit}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} loading={savingEdit}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tên sách" required className="sm:col-span-2">
            <Input
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Nhập tên sách..."
              required
            />
          </Field>

          <Field label="Tác giả">
            <Input
              value={editForm.author}
              onChange={(e) => setEditForm((f) => ({ ...f, author: e.target.value }))}
              placeholder="Tác giả / Dịch giả..."
            />
          </Field>

          <Field label="Thể loại">
            <Select
              value={editForm.categoryId}
              onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">Chưa phân loại</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Khoa / Đơn vị chuyên môn">
            <Select
              value={editForm.faculty}
              onChange={(e) => setEditForm((f) => ({ ...f, faculty: e.target.value }))}
            >
              {DEFAULT_FACULTIES.map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Nhà xuất bản">
            <Input
              value={editForm.publisher}
              onChange={(e) => setEditForm((f) => ({ ...f, publisher: e.target.value }))}
              placeholder="Ví dụ: NXB Giáo dục..."
            />
          </Field>

          <Field label="Năm xuất bản">
            <Input
              type="number"
              value={editForm.publishYear}
              onChange={(e) => setEditForm((f) => ({ ...f, publishYear: e.target.value }))}
              placeholder="2026"
            />
          </Field>

          <Field label="ISBN">
            <Input
              value={editForm.isbn}
              onChange={(e) => setEditForm((f) => ({ ...f, isbn: e.target.value }))}
              placeholder="978-..."
            />
          </Field>

          <Field label="Vị trí kệ">
            <Input
              value={editForm.shelfLocation}
              onChange={(e) => setEditForm((f) => ({ ...f, shelfLocation: e.target.value }))}
              placeholder="Kệ K1-T2..."
            />
          </Field>

          <Field label="Ngày nhập">
            <Input
              type="date"
              value={editForm.dateAdded}
              onChange={(e) => setEditForm((f) => ({ ...f, dateAdded: e.target.value }))}
            />
          </Field>

          <Field label="Trạng thái">
            <Select
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as BookStatus }))}
            >
              <option value="active">Đang hoạt động (Cho mượn bình thường)</option>
              <option value="locked">Khóa (Tạm ngừng cho mượn)</option>
            </Select>
          </Field>

          <Field label="Ghi chú" className="sm:col-span-2">
            <Textarea
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Ghi chú tình trạng, đặc điểm..."
            />
          </Field>
        </div>
      </Modal>

      {/* Confirm Xóa Sách */}
      <ConfirmDialog
        open={Boolean(deletingBook)}
        onClose={() => setDeletingBook(null)}
        onConfirm={handleDelete}
        title="Xác nhận xóa đầu sách"
        danger
        loading={deleting}
        confirmText="Xác nhận xóa"
        message={
          <div>
            <p>
              Bạn có chắc chắn muốn xóa đầu sách <strong>{deletingBook?.title}</strong> ({deletingBook?.bookCode})?
            </p>
            <p className="mt-2 text-xs text-red-600">
              * Hệ thống sẽ kiểm tra và từ chối xóa nếu sách đang có phiếu mượn chưa hoàn tất.
            </p>
          </div>
        }
      />

      {/* Modal In Tem Mã Vạch Code 128 */}
      <Modal
        open={Boolean(printingBook)}
        onClose={() => setPrintingBook(null)}
        title="In tem mã vạch Code 128"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setPrintingBook(null)}>
              Đóng
            </Button>
            <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={handlePrint}>
              In tem ngay
            </Button>
          </>
        }
      >
        {printingBook && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Field label="Số lượng bản tem cần in" className="w-40">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={printCopies}
                  onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </Field>
              <p className="text-xs text-slate-500 pt-5">
                Kích thước tem chuẩn 60mm x 35mm phù hợp dán gáy hoặc bìa sách.
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">
                Bản xem trước tem in
              </p>
              <div className="flex justify-center">
                <BarcodeLabel
                  schoolName={settings.schoolName}
                  title={printingBook.title}
                  bookCode={printingBook.bookCode}
                  barcode={printingBook.barcode}
                />
              </div>
            </div>

            {/* Vùng in thực tế (ẩn trên màn hình, xuất hiện khi in) */}
            <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-4 print:z-50">
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: printCopies }).map((_, i) => (
                  <BarcodeLabel
                    key={i}
                    schoolName={settings.schoolName}
                    title={printingBook.title}
                    bookCode={printingBook.bookCode}
                    barcode={printingBook.barcode}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

export default function BooksPage() {
  return (
    <Suspense fallback={<AppShell><LoadingState label="Đang tải sách..." /></AppShell>}>
      <BooksContent />
    </Suspense>
  );
}
