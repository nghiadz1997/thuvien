"use client";

import { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Edit,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  History,
  IdCard,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
  User,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader, InfoRow } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Form";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Table, TBody, Td, Th, THead, Pagination } from "@/components/ui/Table";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { useAuth } from "@/hooks/useAuth";
import { useBorrowers, useSettings } from "@/hooks/useRealtime";
import { useTable } from "@/hooks/useTable";
import { useAsync } from "@/hooks/useAsync";
import {
  createBorrower,
  deleteBorrower,
  updateBorrower,
  batchImportBorrowers,
  determineFacultyFromClass,
  normalizeFacultyName,
  type BorrowerInput,
} from "@/services/borrower.service";
import { getLoansByBorrower } from "@/services/loan.service";
import { BORROWER_TYPE_LABELS, DEFAULT_FACULTIES, LOAN_STATUS_LABELS } from "@/lib/constants";
import { exportExcel, readExcel, todayStamp } from "@/utils/excel";
import { formatDate } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { matchesSearch } from "@/utils/text";
import type { ActiveStatus, Borrower, BorrowerType, Loan } from "@/types";

export default function BorrowersPage() {
  const { can } = useAuth();
  const { data: borrowers, loading, error, retry } = useBorrowers();
  const { data: settings } = useSettings();

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [facultyFilter, setFacultyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredBorrowers = useMemo(() => {
    return borrowers.filter((b) => {
      if (typeFilter !== "ALL" && b.type !== typeFilter) return false;
      if (facultyFilter !== "ALL" && b.faculty !== facultyFilter) return false;
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      if (search.trim()) {
        const full = `${b.fullName} ${b.borrowerCode} ${b.studentCode || ""} ${b.className || ""} ${b.faculty || ""} ${b.email || ""} ${b.phone || ""} ${b.citizenId || ""} ${b.address || ""} ${b.birthPlace || ""}`;
        if (!matchesSearch(full, search)) return false;
      }
      return true;
    });
  }, [borrowers, typeFilter, facultyFilter, statusFilter, search]);

  const { page, setPage, pageSize, setPageSize, totalPages, pageRows, sort, toggleSort, total } = useTable(
    filteredBorrowers,
    {
      pageSize: 15,
      initialSort: { key: "createdAt", dir: "desc" },
    },
  );

  // Modal Thêm / Sửa
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  const [form, setForm] = useState<BorrowerInput>({
    fullName: "",
    type: "student",
    studentCode: "",
    className: "",
    faculty: "CNTT-KTĐ",
    gender: "Nam",
    dob: "",
    birthPlace: "",
    address: "",
    citizenId: "",
    email: "",
    phone: "",
    status: "active",
  });
  const [saving, setSaving] = useState(false);

  // Modal Import Excel / CSV
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<BorrowerInput[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [readingFile, setReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal Xem Chi Tiết & Lịch Sử Mượn
  const [viewingBorrower, setViewingBorrower] = useState<Borrower | null>(null);
  const { data: borrowerLoans, loading: loadingLoans } = useAsync<Loan[]>(
    () => (viewingBorrower ? getLoansByBorrower(viewingBorrower.id) : Promise.resolve([])),
    [viewingBorrower?.id],
    Boolean(viewingBorrower),
  );

  // Modal Xóa
  const [deletingBorrower, setDeletingBorrower] = useState<Borrower | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditingBorrower(null);
    setForm({
      fullName: "",
      type: "student",
      studentCode: "",
      className: "",
      faculty: "CNTT-KTĐ",
      gender: "Nam",
      dob: "",
      birthPlace: "",
      address: "",
      citizenId: "",
      email: "",
      phone: "",
      status: "active",
    });
    setModalOpen(true);
  };

  const openEdit = (b: Borrower) => {
    setEditingBorrower(b);
    setForm({
      fullName: b.fullName,
      type: b.type,
      studentCode: b.studentCode || "",
      className: b.className || "",
      faculty: b.faculty || "",
      gender: b.gender || "Nam",
      dob: b.dob || "",
      birthPlace: b.birthPlace || "",
      address: b.address || "",
      citizenId: b.citizenId || "",
      email: b.email || "",
      phone: b.phone || "",
      status: b.status,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      toast.error("Vui lòng nhập họ và tên");
      return;
    }
    setSaving(true);
    try {
      if (editingBorrower) {
        await updateBorrower(editingBorrower.id, editingBorrower.borrowerCode, form);
        toast.success("Cập nhật thông tin người mượn thành công");
      } else {
        const id = await createBorrower(form);
        toast.success("Thêm người mượn mới thành công");
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBorrower) return;
    setDeleting(true);
    try {
      await deleteBorrower(deletingBorrower);
      toast.success("Đã xóa người mượn");
      setDeletingBorrower(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // Tải file mẫu Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Mã SV": "1240110007",
        "Họ đệm": "Nguyễn Quốc",
        "Tên": "Thịnh",
        "Giới tính": "Nam",
        "Ngày sinh": "28/04/2006",
        "Nơi sinh": "TP. Hồ Chí Minh",
        "Hộ khẩu thường trú": "khu phố Kim Định, Cần Giuộc, Long An",
        "Số điện thoại": "0984632431",
        "Số Căn cước": "080206012296",
        "Lớp học": "CĐ24A-THUD",
        "Khoa": "CNTT-KTĐ",
        "Email": "thinh@gmail.com",
      },
      {
        "Mã SV": "1241310010",
        "Họ đệm": "Đoàn Thị Ngọc",
        "Tên": "Thơ",
        "Giới tính": "Nữ",
        "Ngày sinh": "09/12/2006",
        "Nơi sinh": "Long An",
        "Hộ khẩu thường trú": "68/4 ấp 4, xã Phước Tân Hưng, Châu Thành, Long An",
        "Số điện thoại": "0974431721",
        "Số Căn cước": "080306009118",
        "Lớp học": "CĐ24A-ĐD1",
        "Khoa": "Y Dược",
        "Email": "",
      },
    ];
    exportExcel(`Mau_Import_Nguoi_Muon_${todayStamp()}`, [{ name: "Nguoi muon", rows: templateData }]);
    toast.success("Đã tải file mẫu Excel import người mượn!");
  };

  // Đọc file Excel / CSV tải lên
  const handleFileSelect = async (file: File) => {
    setReadingFile(true);
    try {
      const data = await readExcel(file);
      if (!data || data.length === 0) {
        toast.error("File Excel / CSV không có dữ liệu!");
        return;
      }

      const rows: BorrowerInput[] = data
        .map((r) => {
          const studentCode = String(r["Mã SV"] || r["Ma SV"] || r["MSSV"] || r["studentCode"] || r["Mã cán bộ"] || "").trim();
          const hoDem = String(r["Họ đệm"] || r["Ho dem"] || r["Họ"] || "").trim();
          const ten = String(r["Tên"] || r["Ten"] || "").trim();
          let fullName = String(r["Họ và tên"] || r["Ho va ten"] || r["fullName"] || "").trim();
          if (!fullName && (hoDem || ten)) {
            fullName = `${hoDem} ${ten}`.trim();
          }

          const gender = String(r["Giới tính"] || r["Gioi tinh"] || r["gender"] || "").trim();
          const dob = String(r["Ngày sinh"] || r["Ngay sinh"] || r["dob"] || "").trim();
          const birthPlace = String(r["Nơi sinh"] || r["Noi sinh"] || r["birthPlace"] || "").trim();
          const address = String(r["Hộ khẩu thường trú"] || r["Ho khau thuong tru"] || r["Địa chỉ"] || r["address"] || "").trim();
          const phone = String(r["Số điện thoại"] || r["So dien thoai"] || r["SĐT"] || r["phone"] || "").trim();
          const citizenId = String(r["Số Căn cước"] || r["Số CCCD"] || r["CCCD"] || r["Số căn cước"] || r["citizenId"] || "").trim();
          const className = String(r["Lớp học"] || r["Lop hoc"] || r["Lớp"] || r["className"] || "").trim();
          let faculty = normalizeFacultyName(String(r["Khoa"] || r["khoa"] || r["faculty"] || r["Đơn vị"] || "").trim());
          if (!faculty) {
            faculty = determineFacultyFromClass(className);
          }
          const email = String(r["Email"] || r["email"] || "").trim();

          return {
            fullName,
            studentCode,
            className,
            faculty,
            gender,
            dob,
            birthPlace,
            address,
            phone,
            citizenId,
            email,
            type: "student" as BorrowerType,
            status: "active" as ActiveStatus,
          };
        })
        .filter((r) => r.fullName.length > 0);

      if (rows.length === 0) {
        toast.error("Không tìm thấy dòng dữ liệu sinh viên hợp lệ trong file!");
        return;
      }

      setImportPreview(rows);
      setImportModalOpen(true);
      toast.success(`Đã đọc ${rows.length} bản ghi người mượn từ file!`);
    } catch (err) {
      toast.error("Không thể đọc file: " + errorMessage(err));
    } finally {
      setReadingFile(false);
    }
  };

  // Thực hiện import
  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    setImportProgress({ done: 0, total: importPreview.length });
    try {
      const res = await batchImportBorrowers(importPreview, (done, total) => {
        setImportProgress({ done, total });
      });
      toast.success(`Import hoàn tất! Thêm mới: ${res.imported}, Cập nhật: ${res.updated}`);
      setImportModalOpen(false);
      setImportPreview([]);
    } catch (err) {
      toast.error("Lỗi khi import: " + errorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredBorrowers.length === 0) {
      toast.warning("Không có dữ liệu để xuất");
      return;
    }
    const rows = filteredBorrowers.map((b, idx) => ({
      STT: idx + 1,
      "Mã độc giả": b.borrowerCode,
      "Mã SV / Mã CB": b.studentCode || "",
      "Họ và tên": b.fullName,
      "Giới tính": b.gender || "",
      "Ngày sinh": b.dob || "",
      "Nơi sinh": b.birthPlace || "",
      "Lớp học": b.className || "",
      "Khoa": b.faculty || "",
      "Số điện thoại": b.phone || "",
      "Số Căn cước": b.citizenId || "",
      "Hộ khẩu thường trú": b.address || "",
      "Email": b.email || "",
      "Đang mượn": b.currentBorrowCount,
      "Trạng thái": b.status === "active" ? "Hoạt động" : "Khóa",
    }));
    exportExcel(`Danh_sach_nguoi_muon_${todayStamp()}`, [{ name: "Nguoi muon", rows }]);
    toast.success("Đã xuất danh sách người mượn ra Excel!");
  };

  return (
    <AppShell>
      <PageHeader
        title="Quản lý Người mượn"
        description={`Tổng số ${borrowers.length} bạn đọc (Sinh viên, Giảng viên, Nhân viên)`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              icon={<Upload className="h-4 w-4 text-blue-600" />}
              onClick={() => fileInputRef.current?.click()}
              loading={readingFile}
            >
              Nhập Excel / CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
              onClick={handleExportExcel}
            >
              Xuất Excel
            </Button>
            {can("borrower:write") && (
              <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
                Thêm người mượn
              </Button>
            )}
          </div>
        }
      />

      {/* Bộ lọc */}
      <Card className="mb-4">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên, mã SV, CCCD, SĐT, lớp..."
                className="pl-9"
              />
            </div>

            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="ALL">Tất cả đối tượng</option>
              <option value="student">Sinh viên</option>
              <option value="lecturer">Giảng viên</option>
              <option value="staff">Cán bộ / Nhân viên</option>
            </Select>

            <Select value={facultyFilter} onChange={(e) => setFacultyFilter(e.target.value)}>
              <option value="ALL">Tất cả Khoa / Viện</option>
              {DEFAULT_FACULTIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>

            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="disabled">Bị khóa</option>
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* Bảng Dữ Liệu */}
      <Card>
        {loading && borrowers.length === 0 ? (
          <LoadingState label="Đang tải danh sách người mượn..." />
        ) : filteredBorrowers.length === 0 ? (
          <EmptyState
            title="Không tìm thấy người mượn phù hợp"
            description="Bạn có thể bấm 'Nhập Excel / CSV' để nạp danh sách sinh viên tự động."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <Th sortKey="borrowerCode" sort={sort} onSort={toggleSort}>
                      Mã độc giả
                    </Th>
                    <Th sortKey="studentCode" sort={sort} onSort={toggleSort}>
                      Mã SV / Mã CB
                    </Th>
                    <Th sortKey="fullName" sort={sort} onSort={toggleSort}>
                      Họ và tên
                    </Th>
                    <Th>Giới tính</Th>
                    <Th>Ngày sinh</Th>
                    <Th>Lớp / Khoa</Th>
                    <Th>SĐT / CCCD</Th>
                    <Th className="text-right" sortKey="currentBorrowCount" sort={sort} onSort={toggleSort}>
                      Đang mượn
                    </Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-center">Thao tác</Th>
                  </tr>
                </THead>
                <TBody>
                  {pageRows.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <Td className="font-mono text-xs font-semibold text-blue-600">{b.borrowerCode}</Td>
                      <Td className="text-xs font-mono font-bold text-slate-800">{b.studentCode || "—"}</Td>
                      <Td className="font-medium text-xs text-slate-900">
                        <div>{b.fullName}</div>
                        {b.birthPlace && <div className="text-[10px] text-slate-400">Nơi sinh: {b.birthPlace}</div>}
                      </Td>
                      <Td className="text-xs text-slate-600">
                        {b.gender ? (
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${b.gender.toLowerCase() === "nữ" || b.gender.toLowerCase() === "nu" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>
                            {b.gender}
                          </span>
                        ) : "—"}
                      </Td>
                      <Td className="text-xs text-slate-600 font-mono">{b.dob || "—"}</Td>
                      <Td className="text-xs text-slate-600">
                        <div className="font-semibold text-slate-800">{b.className || "—"}</div>
                        <div className="text-[10px] text-slate-500">{b.faculty || "—"}</div>
                      </Td>
                      <Td className="text-xs text-slate-600">
                        <div>{b.phone ? <span className="font-mono">{b.phone}</span> : "—"}</div>
                        {b.citizenId && <div className="text-[10px] text-slate-400 font-mono">CCCD: {b.citizenId}</div>}
                      </Td>
                      <Td className="text-right font-bold text-xs">
                        <span className={b.currentBorrowCount > 0 ? "text-amber-600" : "text-slate-400"}>
                          {b.currentBorrowCount} / {settings.maxBorrowBooks}
                        </span>
                      </Td>
                      <Td>
                        <Badge color={b.status === "active" ? "green" : "red"}>
                          {b.status === "active" ? "Hoạt động" : "Khóa"}
                        </Badge>
                      </Td>
                      <Td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingBorrower(b)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                            title="Xem chi tiết hồ sơ & lịch sử"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {can("borrower:write") && (
                            <button
                              onClick={() => openEdit(b)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-amber-600"
                              title="Sửa thông tin"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          {can("borrower:delete") && (
                            <button
                              onClick={() => setDeletingBorrower(b)}
                              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                              title="Xóa độc giả"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </div>
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

      {/* Modal Preview & Import Excel / CSV */}
      <Modal
        open={importModalOpen}
        onClose={() => !importing && setImportModalOpen(false)}
        title={`Xác nhận Import ${importPreview.length} người mượn`}
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              Tải file mẫu Excel
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setImportModalOpen(false)} disabled={importing}>
                Hủy
              </Button>
              <Button variant="primary" onClick={handleExecuteImport} loading={importing}>
                {importing ? `Đang import (${importProgress.done}/${importProgress.total})...` : `Xác nhận Import ${importPreview.length} bản ghi`}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Hệ thống đã nhận diện các trường thông tin tự động: <strong>Mã SV, Họ tên, Giới tính, Ngày sinh, Nơi sinh, Hộ khẩu thường trú, SĐT, Số CCCD, Lớp học, Khoa</strong>. Nếu Mã SV đã tồn tại, hệ thống sẽ tự động cập nhật thông tin mới nhất.
          </p>

          <div className="overflow-x-auto max-h-80 rounded-lg border border-slate-200">
            <Table>
              <THead>
                <tr>
                  <Th>Mã SV</Th>
                  <Th>Họ và tên</Th>
                  <Th>Giới tính</Th>
                  <Th>Ngày sinh</Th>
                  <Th>Nơi sinh</Th>
                  <Th>Lớp học</Th>
                  <Th>Khoa</Th>
                  <Th>SĐT</Th>
                  <Th>CCCD</Th>
                  <Th>Hộ khẩu thường trú</Th>
                </tr>
              </THead>
              <TBody>
                {importPreview.slice(0, 50).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs font-bold text-blue-600">{r.studentCode || "—"}</Td>
                    <Td className="text-xs font-medium text-slate-900 whitespace-nowrap">{r.fullName}</Td>
                    <Td className="text-xs text-slate-600">{r.gender || "—"}</Td>
                    <Td className="text-xs font-mono text-slate-600 whitespace-nowrap">{r.dob || "—"}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{r.birthPlace || "—"}</Td>
                    <Td className="text-xs font-semibold text-slate-800 whitespace-nowrap">{r.className || "—"}</Td>
                    <Td className="text-xs text-slate-600 whitespace-nowrap">{r.faculty || "—"}</Td>
                    <Td className="text-xs font-mono text-slate-600 whitespace-nowrap">{r.phone || "—"}</Td>
                    <Td className="text-xs font-mono text-slate-600 whitespace-nowrap">{r.citizenId || "—"}</Td>
                    <Td className="text-xs text-slate-500 max-w-[200px] truncate" title={r.address}>{r.address || "—"}</Td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </div>
          {importPreview.length > 50 && (
            <p className="text-[11px] text-slate-400 italic text-center">
              (Hiển thị trước 50/{importPreview.length} bản ghi)
            </p>
          )}
        </div>
      </Modal>

      {/* Modal Thêm / Sửa Người Mượn */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBorrower ? `Sửa thông tin: ${editingBorrower.borrowerCode}` : "Thêm người mượn mới"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingBorrower ? "Lưu thay đổi" : "Thêm người mượn"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Mã SV / Mã Cán bộ">
            <Input
              value={form.studentCode}
              onChange={(e) => setForm((f) => ({ ...f, studentCode: e.target.value }))}
              placeholder="1240110007..."
            />
          </Field>

          <Field label="Họ và tên" required className="sm:col-span-2">
            <Input
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Nguyễn Văn A"
              required
            />
          </Field>

          <Field label="Giới tính">
            <Select
              value={form.gender || "Nam"}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
            >
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </Select>
          </Field>

          <Field label="Ngày sinh">
            <Input
              value={form.dob || ""}
              onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
              placeholder="DD/MM/YYYY (VD: 28/04/2006)"
            />
          </Field>

          <Field label="Nơi sinh">
            <Input
              value={form.birthPlace || ""}
              onChange={(e) => setForm((f) => ({ ...f, birthPlace: e.target.value }))}
              placeholder="TP. Hồ Chí Minh, Long An..."
            />
          </Field>

          <Field label="Số CCCD / Căn cước">
            <Input
              value={form.citizenId || ""}
              onChange={(e) => setForm((f) => ({ ...f, citizenId: e.target.value }))}
              placeholder="080206012296..."
            />
          </Field>

          <Field label="Số điện thoại">
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="0984632431..."
            />
          </Field>

          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </Field>

          <Field label="Lớp học">
            <Input
              value={form.className}
              onChange={(e) => {
                const c = e.target.value;
                setForm((f) => ({
                  ...f,
                  className: c,
                  faculty: determineFacultyFromClass(c),
                }));
              }}
              placeholder="CĐ24A-THUD..."
            />
          </Field>

          <Field label="Khoa / Phòng ban" className="sm:col-span-2">
            <Select
              value={form.faculty}
              onChange={(e) => setForm((f) => ({ ...f, faculty: e.target.value }))}
            >
              {DEFAULT_FACULTIES.map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Hộ khẩu thường trú" className="sm:col-span-3">
            <Input
              value={form.address || ""}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Số nhà, đường, xã/phường, quận/huyện, tỉnh/TP..."
            />
          </Field>

          <Field label="Phân loại đối tượng">
            <Select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as BorrowerType }))}
            >
              <option value="student">Sinh viên</option>
              <option value="lecturer">Giảng viên</option>
              <option value="staff">Cán bộ / Nhân viên</option>
            </Select>
          </Field>

          <Field label="Trạng thái" className="sm:col-span-2">
            <Select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ActiveStatus }))}
            >
              <option value="active">Đang hoạt động (Được mượn sách)</option>
              <option value="disabled">Khóa tài khoản (Chặn mượn sách)</option>
            </Select>
          </Field>
        </div>
      </Modal>

      {/* Modal Xem Chi Tiết Hồ Sơ Bạn Đọc */}
      <Modal
        open={Boolean(viewingBorrower)}
        onClose={() => setViewingBorrower(null)}
        title={`Hồ sơ bạn đọc: ${viewingBorrower?.fullName}`}
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setViewingBorrower(null)}>
            Đóng
          </Button>
        }
      >
        {viewingBorrower && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 rounded-xl bg-slate-50 p-4 text-xs">
              <div>
                <span className="text-slate-400">Mã độc giả:</span> <strong className="font-mono text-blue-600">{viewingBorrower.borrowerCode}</strong>
              </div>
              <div>
                <span className="text-slate-400">Mã SV / Mã CB:</span> <strong className="font-mono text-slate-900">{viewingBorrower.studentCode || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Giới tính:</span> <strong>{viewingBorrower.gender || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Ngày sinh:</span> <strong>{viewingBorrower.dob || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Nơi sinh:</span> <strong>{viewingBorrower.birthPlace || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Số CCCD:</span> <strong className="font-mono">{viewingBorrower.citizenId || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Lớp học:</span> <strong>{viewingBorrower.className || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Khoa / Đơn vị:</span> <strong>{viewingBorrower.faculty || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Số điện thoại:</span> <strong className="font-mono">{viewingBorrower.phone || "—"}</strong>
              </div>
              <div className="sm:col-span-3">
                <span className="text-slate-400">Hộ khẩu thường trú:</span> <strong>{viewingBorrower.address || "—"}</strong>
              </div>
              <div>
                <span className="text-slate-400">Số sách đang mượn:</span>{" "}
                <strong className="text-amber-600">{viewingBorrower.currentBorrowCount} cuốn</strong>
              </div>
              <div>
                <span className="text-slate-400">Trạng thái:</span>{" "}
                <Badge color={viewingBorrower.status === "active" ? "green" : "red"}>
                  {viewingBorrower.status === "active" ? "Hoạt động" : "Khóa"}
                </Badge>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Lịch sử các lần mượn sách
              </h4>
              <div className="overflow-x-auto max-h-60 rounded-lg border border-slate-200">
                {loadingLoans ? (
                  <LoadingState label="Đang tải lịch sử mượn..." />
                ) : borrowerLoans && borrowerLoans.length > 0 ? (
                  <Table>
                    <THead>
                      <tr>
                        <Th>Tên sách</Th>
                        <Th>Ngày mượn</Th>
                        <Th>Hạn trả</Th>
                        <Th>Ngày trả</Th>
                        <Th>Trạng thái</Th>
                      </tr>
                    </THead>
                    <TBody>
                      {borrowerLoans.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50">
                          <Td className="text-xs font-medium text-slate-900 max-w-[200px] truncate">{l.bookTitle}</Td>
                          <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(l.borrowDate)}</Td>
                          <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(l.dueDate)}</Td>
                          <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(l.returnDate)}</Td>
                          <Td>
                            <Badge
                              color={
                                l.status === "returned" ? "green" : l.status === "borrowing" ? "amber" : "red"
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
                  <div className="p-6 text-center text-xs text-slate-400">Bạn đọc này chưa từng mượn cuốn sách nào.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Xóa */}
      <ConfirmDialog
        open={Boolean(deletingBorrower)}
        onClose={() => setDeletingBorrower(null)}
        onConfirm={handleDelete}
        title="Xác nhận xóa độc giả"
        danger
        loading={deleting}
        confirmText="Xác nhận xóa"
        message={`Bạn có chắc muốn xóa bạn đọc "${deletingBorrower?.fullName}" (${deletingBorrower?.borrowerCode})?`}
      />
    </AppShell>
  );
}
