"use client";

import { Suspense, useMemo, useRef, useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BookCheck,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  RotateCcw,
  ScanBarcode,
  Search,
  ShieldAlert,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader, Tabs } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { Table, TBody, Td, Th, THead, Pagination } from "@/components/ui/Table";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/barcode/BarcodeScannerInput";
import { useAuth } from "@/hooks/useAuth";
import { useActiveLoans, useBooks, useBorrowers, useSettings } from "@/hooks/useRealtime";
import { useBookLookup } from "@/hooks/useBookLookup";
import { useTable } from "@/hooks/useTable";
import { borrowBook, getActiveLoansByBook, returnBook, type ReturnCondition } from "@/services/loan.service";
import { exportExcel, todayStamp } from "@/utils/excel";
import { addDays, formatDate, fromInputDate, overdueDays, toInputDate } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { matchesSearch } from "@/utils/text";
import type { Book, Borrower, Loan } from "@/types";

type CirculationTab = "borrow" | "return" | "loans";

function CirculationContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as CirculationTab) || "borrow";

  const [activeTab, setActiveTab] = useState<CirculationTab>(initialTab);
  const { actor } = useAuth();
  const { data: books } = useBooks();
  const { data: borrowers } = useBorrowers();
  const { data: activeLoans, loading: loadingLoans } = useActiveLoans();
  const { data: settings } = useSettings();
  const lookupBook = useBookLookup();

  useEffect(() => {
    if (searchParams.get("tab")) {
      const t = searchParams.get("tab");
      if (t === "overdue" || t === "loans") setActiveTab("loans");
      else if (t === "return") setActiveTab("return");
      else if (t === "borrow") setActiveTab("borrow");
    }
  }, [searchParams]);

  // ==========================================
  // TAB 1: MƯỢN SÁCH (BORROW)
  // ==========================================
  const borrowScannerRef = useRef<BarcodeScannerInputHandle>(null);
  const [borrowBookItem, setBorrowBookItem] = useState<Book | null>(null);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState("");
  const [borrowerSearch, setBorrowerSearch] = useState("");
  const [borrowDate, setBorrowDate] = useState(toInputDate(new Date()));
  const [dueDate, setDueDate] = useState(toInputDate(addDays(new Date(), settings.defaultBorrowDays || 14)));
  const [borrowNote, setBorrowNote] = useState("");
  const [submittingBorrow, setSubmittingBorrow] = useState(false);

  useEffect(() => {
    // Cập nhật hạn trả mặc định khi settings tải xong
    if (settings.defaultBorrowDays) {
      setDueDate(toInputDate(addDays(new Date(), settings.defaultBorrowDays)));
    }
  }, [settings.defaultBorrowDays]);

  const handleScanBorrowBook = async (code: string) => {
    const b = await lookupBook(code);
    if (!b) {
      toast.error(`Không tìm thấy sách với mã "${code}"`);
      return false;
    }
    if (b.status === "locked") {
      toast.error(`Sách "${b.title}" đang bị KHÓA, không thể cho mượn`);
      return false;
    }
    if (b.quantityAvailable <= 0) {
      toast.error(`Đầu sách "${b.title}" đã HẾT sách có sẵn trên kệ (0/${b.quantityTotal})`);
      return false;
    }
    setBorrowBookItem(b);
    toast.success(`Đã chọn sách: ${b.title}`);
    return true;
  };

  const filteredBorrowers = useMemo(() => {
    if (!borrowerSearch.trim()) return borrowers.filter((b) => b.status === "active");
    return borrowers.filter(
      (b) =>
        b.status === "active" &&
        matchesSearch(`${b.fullName} ${b.borrowerCode} ${b.studentCode} ${b.className} ${b.faculty}`, borrowerSearch),
    );
  }, [borrowers, borrowerSearch]);

  const selectedBorrower = useMemo(() => {
    return borrowers.find((b) => b.id === selectedBorrowerId);
  }, [borrowers, selectedBorrowerId]);

  const handleExecuteBorrow = async (e: FormEvent) => {
    e.preventDefault();
    if (!borrowBookItem || !selectedBorrower || !actor) {
      toast.error("Vui lòng quét sách và chọn người mượn");
      return;
    }
    if (selectedBorrower.currentBorrowCount >= settings.maxBorrowBooks) {
      toast.error(`Người mượn đã đạt giới hạn tối đa ${settings.maxBorrowBooks} cuốn`);
      return;
    }
    const bDate = fromInputDate(borrowDate) || new Date();
    const dDate = fromInputDate(dueDate) || addDays(bDate, 14);
    if (dDate < bDate) {
      toast.error("Hạn trả không được trước ngày mượn");
      return;
    }

    setSubmittingBorrow(true);
    try {
      await borrowBook(
        {
          bookId: borrowBookItem.id,
          borrowerId: selectedBorrower.id,
          borrowDate: bDate,
          dueDate: dDate,
          note: borrowNote.trim(),
        },
        actor,
      );
      toast.success(`Cho mượn thành công cuốn "${borrowBookItem.title}" cho ${selectedBorrower.fullName}`);

      // Reset
      setBorrowBookItem(null);
      setSelectedBorrowerId("");
      setBorrowerSearch("");
      setBorrowNote("");
      borrowScannerRef.current?.focus();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmittingBorrow(false);
    }
  };

  // ==========================================
  // TAB 2: TRẢ SÁCH (RETURN)
  // ==========================================
  const returnScannerRef = useRef<BarcodeScannerInputHandle>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [matchingLoans, setMatchingLoans] = useState<Loan[]>([]);
  const [returnCondition, setReturnCondition] = useState<ReturnCondition>("normal");
  const [returnDate, setReturnDate] = useState(toInputDate(new Date()));
  const [returnNote, setReturnNote] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const handleScanReturnBook = async (code: string) => {
    const b = await lookupBook(code);
    if (!b) {
      toast.error(`Không tìm thấy sách với mã "${code}"`);
      return false;
    }
    const active = await getActiveLoansByBook(b.id);
    if (active.length === 0) {
      toast.warning(`Sách "${b.title}" hiện không có lượt mượn nào chưa trả`);
      return false;
    }
    if (active.length === 1) {
      setSelectedLoan(active[0]);
      setMatchingLoans([]);
      toast.success(`Tìm thấy phiếu mượn của: ${active[0].borrowerName}`);
    } else {
      setMatchingLoans(active);
      setSelectedLoan(null);
      toast.info(`Tìm thấy ${active.length} bạn đọc đang mượn cuốn sách này`);
    }
    return true;
  };

  const lateDays = useMemo(() => {
    if (!selectedLoan) return 0;
    const rDate = fromInputDate(returnDate) || new Date();
    return overdueDays(selectedLoan.dueDate, rDate);
  }, [selectedLoan, returnDate]);

  const handleExecuteReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !actor) return;
    const rDate = fromInputDate(returnDate) || new Date();

    setSubmittingReturn(true);
    try {
      await returnBook(
        {
          loanId: selectedLoan.id,
          condition: returnCondition,
          returnDate: rDate,
          note: returnNote.trim(),
        },
        actor,
      );
      toast.success(
        `Đã hoàn tất trả sách cho độc giả ${selectedLoan.borrowerName} (${
          returnCondition === "normal" ? "Bình thường" : returnCondition === "damaged" ? "Sách hư" : "Sách mất"
        })`,
      );

      setSelectedLoan(null);
      setMatchingLoans([]);
      setReturnCondition("normal");
      setReturnNote("");
      returnScannerRef.current?.focus();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmittingReturn(false);
    }
  };

  // ==========================================
  // TAB 3: DANH SÁCH ĐANG MƯỢN & QUÁ HẠN
  // ==========================================
  const [loanSearch, setLoanSearch] = useState("");
  const [loanStatusFilter, setLoanStatusFilter] = useState<"ALL" | "OVERDUE" | "NORMAL">("ALL");

  const enrichedLoans = useMemo(() => {
    return activeLoans.map((l) => ({
      ...l,
      isOverdue: overdueDays(l.dueDate) > 0,
      lateCount: overdueDays(l.dueDate),
    }));
  }, [activeLoans]);

  const filteredLoans = useMemo(() => {
    return enrichedLoans.filter((l) => {
      if (loanStatusFilter === "OVERDUE" && !l.isOverdue) return false;
      if (loanStatusFilter === "NORMAL" && l.isOverdue) return false;
      if (loanSearch.trim()) {
        const full = `${l.bookTitle} ${l.barcode} ${l.borrowerName} ${l.borrowerFaculty}`;
        if (!matchesSearch(full, loanSearch)) return false;
      }
      return true;
    });
  }, [enrichedLoans, loanStatusFilter, loanSearch]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageRows, sort, toggleSort, total } = useTable(
    filteredLoans,
    {
      pageSize: 15,
      initialSort: { key: "dueDate", dir: "asc" },
    },
  );

  const handleExportLoansExcel = () => {
    if (filteredLoans.length === 0) {
      toast.warning("Không có dữ liệu mượn để xuất");
      return;
    }
    const rows = filteredLoans.map((l, idx) => ({
      STT: idx + 1,
      "Tên sách": l.bookTitle,
      Barcode: l.barcode,
      "Người mượn": l.borrowerName,
      Khoa: l.borrowerFaculty,
      "Ngày mượn": formatDate(l.borrowDate),
      "Hạn trả": formatDate(l.dueDate),
      "Tình trạng": l.isOverdue ? `Quá hạn ${l.lateCount} ngày` : "Trong hạn",
      "Ghi chú": l.note,
    }));
    exportExcel(`Danh_sach_muon_${todayStamp()}`, [{ name: "Danh sach dang muon", rows }]);
    toast.success("Đã xuất danh sách mượn ra file Excel!");
  };

  const handleQuickReturnFromTable = (loan: Loan) => {
    setActiveTab("return");
    setSelectedLoan(loan);
    setMatchingLoans([]);
  };

  return (
    <AppShell>
      <PageHeader
        title="Lưu thông Mượn / Trả Sách"
        description="Xử lý nhanh phiếu mượn, trả sách tự động qua máy quét Barcode USB"
      />

      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v as CirculationTab)}
        tabs={[
          { value: "borrow", label: "Mượn sách (Quét Barcode)", icon: <ArrowUpRight className="h-4 w-4 text-blue-600" /> },
          { value: "return", label: "Trả sách (Quét Barcode)", icon: <ArrowDownLeft className="h-4 w-4 text-emerald-600" /> },
          {
            value: "loans",
            label: `Danh sách đang mượn (${activeLoans.length})`,
            icon: <Clock className="h-4 w-4 text-amber-600" />,
          },
        ]}
      />

      {/* ========================================================= */}
      {/* TAB 1: MƯỢN SÁCH */}
      {/* ========================================================= */}
      {activeTab === "borrow" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Cột trái: Quét Barcode Sách */}
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="1. Quét mã vạch sách"
                description="Hướng máy quét vào mã vạch sách hoặc gõ mã"
                icon={<ScanBarcode className="h-5 w-5 text-blue-600" />}
              />
              <CardBody className="space-y-4">
                <BarcodeScannerInput
                  ref={borrowScannerRef}
                  onScan={handleScanBorrowBook}
                  placeholder="Quét mã vạch sách cần cho mượn..."
                  keepFocus={!borrowBookItem}
                />

                {borrowBookItem ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm text-slate-900">{borrowBookItem.title}</p>
                        <p className="text-blue-700 font-mono">Mã: {borrowBookItem.bookCode} • Barcode: {borrowBookItem.barcode}</p>
                        <p className="text-slate-600">Tác giả: {borrowBookItem.author || "—"}</p>
                        <p className="text-slate-600">Vị trí kệ: {borrowBookItem.shelfLocation || "—"}</p>
                      </div>
                      <Badge color="green">Sẵn sàng ({borrowBookItem.quantityAvailable} cuốn)</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Vui lòng quét mã vạch trên cuốn sách để bắt đầu lập phiếu mượn.
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Cột phải: Chọn Người Mượn & Xác Nhận */}
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="2. Thông tin người mượn & Hạn trả"
                description="Tìm kiếm bạn đọc và thiết lập ngày trả sách"
                icon={<User className="h-5 w-5 text-indigo-600" />}
              />
              <CardBody>
                <form onSubmit={handleExecuteBorrow} className="space-y-4">
                  <div>
                    <Field label="Tìm người mượn (Tên, MSSV, Khoa...)">
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={borrowerSearch}
                          onChange={(e) => setBorrowerSearch(e.target.value)}
                          placeholder="Gõ tên hoặc MSSV để lọc..."
                          className="pl-9"
                        />
                      </div>
                    </Field>

                    <Field label="Chọn người mượn" required>
                      <Select
                        value={selectedBorrowerId}
                        onChange={(e) => setSelectedBorrowerId(e.target.value)}
                        required
                      >
                        <option value="">-- Chọn bạn đọc --</option>
                        {filteredBorrowers.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.fullName} ({b.studentCode || b.borrowerCode}) - {b.faculty || b.className} [Đang mượn: {b.currentBorrowCount}/{settings.maxBorrowBooks}]
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  {selectedBorrower && (
                    <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                      <p className="font-semibold text-slate-800">
                        {selectedBorrower.fullName} • MSSV/Mã: {selectedBorrower.studentCode || selectedBorrower.borrowerCode}
                      </p>
                      <p className="text-slate-600">Lớp: {selectedBorrower.className || "—"} • Khoa: {selectedBorrower.faculty || "—"}</p>
                      <p className="text-slate-600">
                        Đang mượn: <strong>{selectedBorrower.currentBorrowCount}</strong> / {settings.maxBorrowBooks} cuốn
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Ngày mượn" required>
                      <Input
                        type="date"
                        value={borrowDate}
                        onChange={(e) => setBorrowDate(e.target.value)}
                        required
                      />
                    </Field>
                    <Field label="Hạn trả" required>
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                      />
                    </Field>
                  </div>

                  <Field label="Ghi chú mượn">
                    <Input
                      value={borrowNote}
                      onChange={(e) => setBorrowNote(e.target.value)}
                      placeholder="Ghi chú thêm nếu có..."
                    />
                  </Field>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-full"
                      size="lg"
                      loading={submittingBorrow}
                      disabled={!borrowBookItem || !selectedBorrower}
                    >
                      Xác nhận cho mượn sách
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: TRẢ SÁCH */}
      {/* ========================================================= */}
      {activeTab === "return" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <Card>
              <CardHeader
                title="Quét mã vạch sách cần trả"
                description="Hệ thống sẽ tự động tra cứu phiếu mượn tương ứng"
                icon={<ScanBarcode className="h-5 w-5 text-emerald-600" />}
              />
              <CardBody className="space-y-4">
                <BarcodeScannerInput
                  ref={returnScannerRef}
                  onScan={handleScanReturnBook}
                  placeholder="Quét mã vạch sách để nhận lại..."
                  keepFocus={!selectedLoan}
                />

                {/* Trường hợp có nhiều người đang mượn cùng 1 đầu sách */}
                {matchingLoans.length > 1 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700">Chọn đúng bạn đọc trả cuốn sách này:</p>
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                      {matchingLoans.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setSelectedLoan(l);
                            setMatchingLoans([]);
                          }}
                          className="flex w-full items-center justify-between p-3 text-left hover:bg-blue-50 text-xs transition-colors"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">{l.borrowerName}</p>
                            <p className="text-slate-500">Mượn: {formatDate(l.borrowDate)} • Hạn trả: {formatDate(l.dueDate)}</p>
                          </div>
                          <Badge color={overdueDays(l.dueDate) > 0 ? "red" : "blue"}>Chọn phiếu này</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div>
            {selectedLoan ? (
              <Card className="border-emerald-300 ring-2 ring-emerald-500/20">
                <CardHeader
                  title="Thông tin Phiếu Mượn & Nhận Sách"
                  icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                />
                <CardBody>
                  <form onSubmit={handleExecuteReturn} className="space-y-4">
                    <div className="rounded-xl bg-slate-50 p-4 text-xs space-y-2">
                      <div>
                        <p className="text-slate-400">Cuốn sách:</p>
                        <p className="font-bold text-sm text-slate-900">{selectedLoan.bookTitle}</p>
                        <p className="text-slate-600 font-mono">{selectedLoan.barcode}</p>
                      </div>
                      <div className="border-t border-slate-200 pt-2">
                        <p className="text-slate-400">Người mượn:</p>
                        <p className="font-bold text-slate-800">{selectedLoan.borrowerName} ({selectedLoan.borrowerFaculty})</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
                        <div>
                          <span className="text-slate-400">Ngày mượn:</span> {formatDate(selectedLoan.borrowDate)}
                        </div>
                        <div>
                          <span className="text-slate-400">Hạn trả:</span> {formatDate(selectedLoan.dueDate)}
                        </div>
                      </div>

                      {lateDays > 0 ? (
                        <div className="rounded-lg bg-red-100 p-2 text-red-800 font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                          Sách đã quá hạn trả {lateDays} ngày!
                        </div>
                      ) : (
                        <div className="rounded-lg bg-emerald-100 p-2 text-emerald-800 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          Sách trả đúng hạn.
                        </div>
                      )}
                    </div>

                    <Field label="Tình trạng sách khi nhận lại" required>
                      <Select
                        value={returnCondition}
                        onChange={(e) => setReturnCondition(e.target.value as ReturnCondition)}
                        required
                      >
                        <option value="normal">Bình thường (Đưa trở lại kệ sẵn sàng mượn)</option>
                        <option value="damaged">Hư hỏng (Chuyển vào danh sách sách hư)</option>
                        <option value="lost">Báo mất (Chuyển vào danh sách sách mất)</option>
                      </Select>
                    </Field>

                    <Field label="Ngày thực tế nhận lại" required>
                      <Input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        required
                      />
                    </Field>

                    <Field label="Ghi chú">
                      <Input
                        value={returnNote}
                        onChange={(e) => setReturnNote(e.target.value)}
                        placeholder="Ghi chú biên bản, phí phạt hoặc hiện trạng sách..."
                      />
                    </Field>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedLoan(null);
                          returnScannerRef.current?.focus();
                        }}
                      >
                        Hủy
                      </Button>
                      <Button type="submit" variant="primary" loading={submittingReturn}>
                        Xác nhận hoàn tất trả sách
                      </Button>
                    </div>
                  </form>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardBody className="py-12 text-center text-slate-400">
                  <RotateCcw className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-sm font-medium">Chưa có phiếu mượn nào được chọn</p>
                  <p className="text-xs text-slate-400 mt-1">Quét mã vạch ở ô bên trái hoặc chọn từ danh sách đang mượn</p>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: DANH SÁCH ĐANG MƯỢN & QUÁ HẠN */}
      {/* ========================================================= */}
      {activeTab === "loans" && (
        <div className="space-y-4">
          <Card>
            <CardBody className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <div className="relative min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={loanSearch}
                      onChange={(e) => setLoanSearch(e.target.value)}
                      placeholder="Tìm theo tên sách, người mượn, khoa..."
                      className="pl-9"
                    />
                  </div>

                  <Select
                    value={loanStatusFilter}
                    onChange={(e) => setLoanStatusFilter(e.target.value as "ALL" | "OVERDUE" | "NORMAL")}
                    className="w-48"
                  >
                    <option value="ALL">Tất cả ({activeLoans.length})</option>
                    <option value="OVERDUE">Chỉ sách quá hạn ({activeLoans.filter((l) => overdueDays(l.dueDate) > 0).length})</option>
                    <option value="NORMAL">Trong hạn</option>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
                  onClick={handleExportLoansExcel}
                >
                  Xuất Excel
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            {loadingLoans && activeLoans.length === 0 ? (
              <LoadingState label="Đang tải danh sách mượn..." />
            ) : filteredLoans.length === 0 ? (
              <EmptyState title="Không có phiếu mượn nào thỏa mãn bộ lọc" />
            ) : (
              <>
                <Table>
                  <THead>
                    <tr>
                      <Th sortKey="bookTitle" sort={sort} onSort={toggleSort}>
                        Tên sách / Mã vạch
                      </Th>
                      <Th sortKey="borrowerName" sort={sort} onSort={toggleSort}>
                        Người mượn
                      </Th>
                      <Th sortKey="borrowDate" sort={sort} onSort={toggleSort}>
                        Ngày mượn
                      </Th>
                      <Th sortKey="dueDate" sort={sort} onSort={toggleSort}>
                        Hạn trả
                      </Th>
                      <Th>Tình trạng</Th>
                      <Th className="text-center">Thao tác</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {pageRows.map((loan) => (
                      <tr key={loan.id} className="hover:bg-slate-50">
                        <Td className="max-w-[240px]">
                          <p className="font-medium text-xs text-slate-900 line-clamp-1">{loan.bookTitle}</p>
                          <p className="font-mono text-[10px] text-blue-600">{loan.barcode}</p>
                        </Td>
                        <Td className="max-w-[180px]">
                          <p className="font-semibold text-xs text-slate-800">{loan.borrowerName}</p>
                          <p className="text-[10px] text-slate-500">{loan.borrowerFaculty}</p>
                        </Td>
                        <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(loan.borrowDate)}</Td>
                        <Td className="text-xs text-slate-500 whitespace-nowrap font-medium">{formatDate(loan.dueDate)}</Td>
                        <Td className="whitespace-nowrap">
                          {loan.isOverdue ? (
                            <Badge color="red" className="font-bold">
                              Trễ {loan.lateCount} ngày
                            </Badge>
                          ) : (
                            <Badge color="blue">Trong hạn</Badge>
                          )}
                        </Td>
                        <Td className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleQuickReturnFromTable(loan)}
                          >
                            Trả sách
                          </Button>
                        </Td>
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
        </div>
      )}
    </AppShell>
  );
}

export default function CirculationPage() {
  return (
    <Suspense fallback={<AppShell><LoadingState label="Đang tải mượn/trả..." /></AppShell>}>
      <CirculationContent />
    </Suspense>
  );
}
