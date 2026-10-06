"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  BookPlus,
  CheckCircle2,
  FileSpreadsheet,
  PackageCheck,
  PackagePlus,
  PlusCircle,
  Printer,
  QrCode,
  ScanBarcode,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader, Tabs } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { Table, TBody, Td, Th, THead } from "@/components/ui/Table";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/barcode/BarcodeScannerInput";
import { BarcodeLabel } from "@/components/barcode/BarcodeLabel";
import { DEFAULT_FACULTIES } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import { useBooks, useCategories, useSettings } from "@/hooks/useRealtime";
import { useBookLookup } from "@/hooks/useBookLookup";
import { createBook, importStock } from "@/services/book.service";
import { exportExcel, readExcel } from "@/utils/excel";
import { errorMessage } from "@/utils/errors";
import { toInputDate } from "@/utils/format";
import type { Book } from "@/types";

type ImportTab = "new" | "supplement" | "excel";

export default function ImportPage() {
  const router = useRouter();
  const { actor } = useAuth();
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();
  const lookupBook = useBookLookup();

  const [activeTab, setActiveTab] = useState<ImportTab>("new");

  // Tab 1: Form Thêm Đầu Sách Mới
  const [newForm, setNewForm] = useState({
    title: "",
    author: "",
    categoryId: "",
    faculty: "Khác / Toàn trường",
    publisher: "",
    publishYear: new Date().getFullYear().toString(),
    isbn: "",
    dateAdded: toInputDate(new Date()),
    quantity: 1,
    shelfLocation: "K1-T1",
    notes: "",
  });
  const [savingNew, setSavingNew] = useState(false);

  // In tem sau khi tạo
  const [createdBookForPrint, setCreatedBookForPrint] = useState<{
    title: string;
    bookCode: string;
    barcode: string;
  } | null>(null);

  // Tab 2: Nhập Bổ Sung Sách Cũ
  const scannerRef = useRef<BarcodeScannerInputHandle>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [suppQuantity, setSuppQuantity] = useState(1);
  const [suppNote, setSuppNote] = useState("");
  const [savingSupp, setSavingSupp] = useState(false);

  // Quét nhanh ISBN trên sách thật
  const handleScanIsbnNew = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return false;
    const existing = await lookupBook(trimmed);
    if (existing) {
      toast.warning(`Sách "${existing.title}" đã có trong thư viện (Mã: ${existing.bookCode})!`, {
        description: "Hệ thống đã tự động chuyển bạn sang tab Nhập bổ sung số lượng.",
        duration: 5000,
      });
      setActiveTab("supplement");
      setSelectedBook(existing);
      setSuppQuantity(1);
      return true;
    }
    setNewForm((prev) => ({ ...prev, isbn: trimmed }));
    toast.success(`Đã nhận diện mã ISBN: ${trimmed}`);
    return true;
  };

  // Tab 3: Nhập Excel Hàng Loạt
  const [excelRows, setExcelRows] = useState<
    {
      index: number;
      title: string;
      author: string;
      categoryName: string;
      faculty: string;
      publisher: string;
      publishYear: number | null;
      isbn: string;
      quantity: number;
      shelfLocation: string;
      valid: boolean;
      errorMsg?: string;
    }[]
  >([]);
  const [readingFile, setReadingFile] = useState(false);
  const [importingExcel, setImportingExcel] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Xử lý tạo mới
  const handleCreateNew = async (printAfter = false) => {
    if (!actor) return;
    if (!newForm.title.trim()) {
      toast.error("Vui lòng nhập tên sách");
      return;
    }
    if (newForm.quantity < 1) {
      toast.error("Số lượng nhập phải ≥ 1");
      return;
    }
    setSavingNew(true);
    try {
      const res = await createBook(
        {
          title: newForm.title.trim(),
          author: newForm.author.trim(),
          categoryId: newForm.categoryId,
          faculty: newForm.faculty.trim() || "Khác / Toàn trường",
          publisher: newForm.publisher.trim(),
          publishYear: newForm.publishYear ? parseInt(newForm.publishYear) : null,
          isbn: newForm.isbn.trim(),
          dateAdded: new Date(newForm.dateAdded),
          quantity: newForm.quantity,
          shelfLocation: newForm.shelfLocation.trim(),
          notes: newForm.notes.trim(),
        },
        actor,
        settings.barcodePrefix,
      );
      toast.success(`Đã tạo đầu sách thành công! Mã: ${res.bookCode}`);

      if (printAfter) {
        setCreatedBookForPrint({
          title: newForm.title.trim(),
          bookCode: res.bookCode,
          barcode: res.bookCode,
        });
      }

      // Reset form
      setNewForm({
        title: "",
        author: "",
        categoryId: categories[0]?.id || "",
        faculty: "CNTT-KTĐ",
        publisher: "",
        publishYear: new Date().getFullYear().toString(),
        isbn: "",
        dateAdded: toInputDate(new Date()),
        quantity: 1,
        shelfLocation: "K1-T1",
        notes: "",
      });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingNew(false);
    }
  };

  // Quét mã cho Tab Nhập bổ sung
  const handleScanSupplement = async (code: string) => {
    const b = await lookupBook(code);
    if (!b) {
      toast.error(`Không tìm thấy sách có mã "${code}"`);
      return false;
    }
    setSelectedBook(b);
    setSuppQuantity(1);
    toast.success(`Đã tìm thấy sách: ${b.title}`);
    return true;
  };

  // Lưu Nhập bổ sung
  const handleSaveSupplement = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !actor) return;
    if (suppQuantity < 1) {
      toast.error("Số lượng phải ≥ 1");
      return;
    }
    setSavingSupp(true);
    try {
      await importStock(selectedBook.id, suppQuantity, actor, suppNote.trim());
      toast.success(`Đã nhập bổ sung ${suppQuantity} cuốn cho sách "${selectedBook.title}"`);
      setSelectedBook(null);
      setSuppQuantity(1);
      setSuppNote("");
      scannerRef.current?.focus();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingSupp(false);
    }
  };

  // Tải file mẫu Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Tên sách": "Lập trình Web với React & Next.js",
        "Tác giả": "Nguyễn Văn A",
        "Thể loại": "Công nghệ thông tin",
        "Khoa": "CNTT-KTĐ",
        "Nhà xuất bản": "NXB Thông tin & Truyền thông",
        "Năm XB": 2026,
        ISBN: "978-604-80-1234-5",
        "Số lượng": 10,
        "Vị trí kệ": "K1-T1",
      },
      {
        "Tên sách": "Kinh tế học đại cương",
        "Tác giả": "Trần Thị B",
        "Thể loại": "Kinh tế",
        "Khoa": "KT-DL",
        "Nhà xuất bản": "NXB Tài chính",
        "Năm XB": 2025,
        ISBN: "978-604-80-5678-9",
        "Số lượng": 5,
        "Vị trí kệ": "K2-T3",
      },
    ];
    exportExcel("Mau_Nhap_Sach_Excel", [{ name: "Mau_Nhap_Sach", rows: templateData }]);
    toast.success("Đã tải xuống file mẫu Excel");
  };

  // Đọc file Excel người dùng tải lên
  const handleFileUpload = async (file: File) => {
    setReadingFile(true);
    try {
      const data = await readExcel(file);
      if (!data || data.length === 0) {
        toast.error("File Excel không có dữ liệu!");
        return;
      }

      const rows = data.map((raw, idx) => {
        const title = String(raw["Tên sách"] || raw["Ten sach"] || raw["title"] || "").trim();
        const author = String(raw["Tác giả"] || raw["Tac gia"] || raw["author"] || "").trim();
        const catName = String(raw["Thể loại"] || raw["The loai"] || raw["category"] || "").trim();
        const faculty = String(raw["Khoa"] || raw["khoa"] || raw["faculty"] || raw["Đơn vị"] || "Khác / Toàn trường").trim();
        const publisher = String(raw["Nhà xuất bản"] || raw["Nha xuat ban"] || raw["NXB"] || "").trim();
        const yearRaw = raw["Năm XB"] || raw["Nam XB"] || raw["year"];
        const year = yearRaw ? parseInt(String(yearRaw)) : null;
        const isbn = String(raw["ISBN"] || raw["isbn"] || "").trim();
        const qtyRaw = raw["Số lượng"] || raw["So luong"] || raw["quantity"];
        const quantity = parseInt(String(qtyRaw)) || 1;
        const shelf = String(raw["Vị trí kệ"] || raw["Vi tri ke"] || raw["shelf"] || "K1-T1").trim();

        const valid = Boolean(title && quantity >= 1);
        const errorMsg = !title
          ? "Thiếu tên sách"
          : quantity < 1
            ? "Số lượng phải ≥ 1"
            : undefined;

        return {
          index: idx + 1,
          title,
          author,
          categoryName: catName,
          faculty,
          publisher,
          publishYear: year,
          isbn,
          quantity,
          shelfLocation: shelf,
          valid,
          errorMsg,
        };
      });

      setExcelRows(rows);
      toast.info(`Đã đọc ${rows.length} dòng dữ liệu từ file Excel`);
    } catch (err) {
      toast.error(`Lỗi đọc file: ${errorMessage(err)}`);
    } finally {
      setReadingFile(false);
    }
  };

  // Thực hiện import Excel hàng loạt
  const handleExecuteImportExcel = async () => {
    if (!actor) return;
    const validRows = excelRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      toast.error("Không có dòng hợp lệ để nhập vào hệ thống");
      return;
    }

    setImportingExcel(true);
    setImportProgress({ current: 0, total: validRows.length });

    // Tạo map danh mục hoặc tạo mới nếu chưa có
    const catMap = new Map(categories.map((c) => [c.name.toLowerCase().trim(), c.id]));
    let successCount = 0;

    try {
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        let categoryId = "";
        if (row.categoryName) {
          categoryId = catMap.get(row.categoryName.toLowerCase().trim()) || "";
        }

        await createBook(
          {
            title: row.title,
            author: row.author,
            categoryId,
            faculty: row.faculty || "Khác / Toàn trường",
            publisher: row.publisher,
            publishYear: row.publishYear,
            isbn: row.isbn,
            dateAdded: new Date(),
            quantity: row.quantity,
            shelfLocation: row.shelfLocation,
            notes: "Import từ Excel",
          },
          actor,
          settings.barcodePrefix,
        );
        successCount++;
        setImportProgress({ current: i + 1, total: validRows.length });
      }

      toast.success(`Đã nhập thành công ${successCount} đầu sách vào hệ thống!`);
      setExcelRows([]);
      router.push("/books");
    } catch (err) {
      toast.error(`Lỗi trong quá trình nhập: ${errorMessage(err)}`);
    } finally {
      setImportingExcel(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Nhập sách vào thư viện"
        description="Thêm đầu sách mới, nhập bổ sung số lượng hoặc import danh sách hàng loạt từ file Excel"
      />

      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v as ImportTab)}
        tabs={[
          { value: "new", label: "Thêm đầu sách mới", icon: <PlusCircle className="h-4 w-4" /> },
          { value: "supplement", label: "Nhập bổ sung sách cũ (Barcode)", icon: <ScanBarcode className="h-4 w-4" /> },
          { value: "excel", label: "Nhập hàng loạt từ Excel", icon: <FileSpreadsheet className="h-4 w-4" /> },
        ]}
      />

      {/* TAB 1: THÊM ĐẦU SÁCH MỚI */}
      {activeTab === "new" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Box Quét nhanh ISBN sau bìa sách */}
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 shadow-sm">
              <CardBody className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <ScanBarcode className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-950">
                    ⚡ Quét nhanh mã vạch / ISBN sau bìa sách (Tự động điền)
                  </h3>
                </div>
                <p className="text-xs text-blue-700 mb-3">
                  Bắn máy quét mã vạch vào mã ISBN in sẵn sau bìa sách thật để tự động nhận diện mã. Nếu sách đã có trong thư viện, hệ thống sẽ tự chuyển sang chế độ <strong>Nhập bổ sung</strong>.
                </p>
                <BarcodeScannerInput
                  placeholder="Bắn súng quét USB vào mã vạch trên sách hoặc nhập ISBN rồi nhấn Enter..."
                  onScan={handleScanIsbnNew}
                  autoFocus
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Thông tin đầu sách mới"
                description="Hệ thống sẽ tự sinh mã sách và mã vạch Code 128 tự động"
                icon={<BookPlus className="h-5 w-5 text-blue-600" />}
              />
              <CardBody>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateNew(false);
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Tên sách" required className="sm:col-span-2">
                      <Input
                        value={newForm.title}
                        onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Ví dụ: Giáo trình Lập trình C..."
                        required
                      />
                    </Field>

                    <Field label="Tác giả">
                      <Input
                        value={newForm.author}
                        onChange={(e) => setNewForm((f) => ({ ...f, author: e.target.value }))}
                        placeholder="Tên tác giả, nhóm tác giả..."
                      />
                    </Field>

                    <Field label="Thể loại">
                      <Select
                        value={newForm.categoryId}
                        onChange={(e) => setNewForm((f) => ({ ...f, categoryId: e.target.value }))}
                      >
                        <option value="">Chưa phân loại</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Khoa / Đơn vị chuyên môn" required>
                      <Select
                        value={newForm.faculty}
                        onChange={(e) => setNewForm((f) => ({ ...f, faculty: e.target.value }))}
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
                        value={newForm.publisher}
                        onChange={(e) => setNewForm((f) => ({ ...f, publisher: e.target.value }))}
                        placeholder="Ví dụ: NXB Giáo dục, NXB Trẻ..."
                      />
                    </Field>

                    <Field label="Năm xuất bản">
                      <Input
                        type="number"
                        value={newForm.publishYear}
                        onChange={(e) => setNewForm((f) => ({ ...f, publishYear: e.target.value }))}
                        placeholder="2026"
                      />
                    </Field>

                    <Field label="Mã ISBN (Quét hoặc nhập tay)">
                      <div className="relative">
                        <Input
                          value={newForm.isbn}
                          onChange={(e) => setNewForm((f) => ({ ...f, isbn: e.target.value }))}
                          placeholder="Ví dụ: 9786048012345"
                        />
                        {newForm.isbn && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium">
                            ISBN
                          </span>
                        )}
                      </div>
                    </Field>

                    <Field label="Số lượng nhập" required>
                      <Input
                        type="number"
                        min={1}
                        value={newForm.quantity}
                        onChange={(e) => setNewForm((f) => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                        required
                      />
                    </Field>

                    <Field label="Vị trí kệ">
                      <Input
                        value={newForm.shelfLocation}
                        onChange={(e) => setNewForm((f) => ({ ...f, shelfLocation: e.target.value }))}
                        placeholder="Ví dụ: K1-T2 (Kệ 1, Tầng 2)"
                      />
                    </Field>

                    <Field label="Ngày nhập kho">
                      <Input
                        type="date"
                        value={newForm.dateAdded}
                        onChange={(e) => setNewForm((f) => ({ ...f, dateAdded: e.target.value }))}
                      />
                    </Field>

                    <Field label="Ghi chú" className="sm:col-span-2">
                      <Textarea
                        value={newForm.notes}
                        onChange={(e) => setNewForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Ghi chú thêm về nguồn sách, tình trạng..."
                      />
                    </Field>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setNewForm({
                          title: "",
                          author: "",
                          categoryId: "",
                          faculty: "Công nghệ thông tin",
                          publisher: "",
                          publishYear: new Date().getFullYear().toString(),
                          isbn: "",
                          dateAdded: toInputDate(new Date()),
                          quantity: 1,
                          shelfLocation: "K1-T1",
                          notes: "",
                        })
                      }
                    >
                      Hủy bỏ
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      icon={<Printer className="h-4 w-4" />}
                      loading={savingNew}
                      onClick={() => handleCreateNew(true)}
                    >
                      Lưu & In mã vạch
                    </Button>
                    <Button type="submit" variant="primary" loading={savingNew}>
                      Lưu đầu sách
                    </Button>
                  </div>
                </form>
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Quy tắc định dạng mã" icon={<QrCode className="h-5 w-5 text-indigo-600" />} />
              <CardBody className="text-xs text-slate-600 space-y-2">
                <p>
                  • Tiền tố mã sách: <strong>{settings.barcodePrefix}</strong>
                </p>
                <p>
                  • Cấu trúc mã tự sinh:{" "}
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600 font-mono">
                    {settings.barcodePrefix}-{new Date().getFullYear()}-000001
                  </code>
                </p>
                <p>• Mã vạch tạo chuẩn: <strong>Code 128 (Độ nét cao)</strong></p>
                <p className="text-slate-500">
                  Sau khi lưu, hệ thống tự động lưu trữ giao dịch (Transaction Log: CREATE_BOOK) và đưa sách vào danh mục.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: NHẬP BỔ SUNG SÁCH CŨ QUA MÁY QUÉT BARCODE */}
      {activeTab === "supplement" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <Card>
              <CardHeader
                title="Quét mã vạch sách cần nhập bổ sung"
                description="Sử dụng máy quét USB hoặc nhập thủ công"
                icon={<ScanBarcode className="h-5 w-5 text-blue-600" />}
              />
              <CardBody className="space-y-4">
                <BarcodeScannerInput
                  ref={scannerRef}
                  onScan={handleScanSupplement}
                  placeholder="Quét mã vạch sách cần nhập thêm..."
                  keepFocus={!selectedBook}
                />

                <div className="rounded-xl bg-blue-50 p-4 text-xs text-blue-800 space-y-1">
                  <p className="font-semibold flex items-center gap-1">
                    <Sparkles className="h-4 w-4 text-blue-600" /> Hướng dẫn thao tác nhanh:
                  </p>
                  <p>1. Cắm máy quét Barcode USB vào máy tính.</p>
                  <p>2. Hướng đầu đọc vào tem mã vạch của cuốn sách.</p>
                  <p>3. Hệ thống sẽ tự động tìm kiếm thông tin và điền vào form bên cạnh.</p>
                </div>
              </CardBody>
            </Card>
          </div>

          <div>
            {selectedBook ? (
              <Card className="border-blue-300 ring-2 ring-blue-500/20">
                <CardHeader
                  title="Thông tin sách & Số lượng nhập thêm"
                  icon={<PackageCheck className="h-5 w-5 text-emerald-600" />}
                />
                <CardBody>
                  <form onSubmit={handleSaveSupplement} className="space-y-4">
                    <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                      <p className="font-bold text-slate-900 text-sm">{selectedBook.title}</p>
                      <p className="text-slate-600 font-mono">Mã: {selectedBook.bookCode}</p>
                      <p className="text-slate-600">Tác giả: {selectedBook.author || "—"}</p>
                      <div className="flex gap-4 pt-1 font-semibold text-slate-800">
                        <span>Tổng hiện tại: {selectedBook.quantityTotal}</span>
                        <span>Đang có: {selectedBook.quantityAvailable}</span>
                      </div>
                    </div>

                    <Field label="Số lượng cuốn nhập thêm" required>
                      <Input
                        type="number"
                        min={1}
                        value={suppQuantity}
                        onChange={(e) => setSuppQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        required
                        autoFocus
                      />
                    </Field>

                    <Field label="Ghi chú nhập đợt này">
                      <Input
                        value={suppNote}
                        onChange={(e) => setSuppNote(e.target.value)}
                        placeholder="Ví dụ: Đợt bổ sung học kỳ 2..."
                      />
                    </Field>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedBook(null);
                          scannerRef.current?.focus();
                        }}
                      >
                        Hủy
                      </Button>
                      <Button type="submit" variant="primary" loading={savingSupp}>
                        Xác nhận nhập thêm
                      </Button>
                    </div>
                  </form>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardBody className="py-12 text-center text-slate-400">
                  <ScanBarcode className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                  <p className="text-sm font-medium">Chưa có sách nào được chọn</p>
                  <p className="text-xs text-slate-400 mt-1">Quét mã vạch ở ô bên trái để bắt đầu</p>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: IMPORT HÀNG LOẠT TỪ EXCEL */}
      {activeTab === "excel" && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Nhập danh sách sách từ file Excel (.xlsx)"
              description="Tải lên danh sách sách theo mẫu định dạng của thư viện"
              icon={<FileSpreadsheet className="h-5 w-5 text-emerald-600" />}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
                  onClick={handleDownloadTemplate}
                >
                  Tải file mẫu Excel
                </Button>
              }
            />
            <CardBody>
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:bg-slate-100/80 transition-colors">
                <UploadCloud className="h-10 w-10 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-700">Kéo thả file Excel vào đây hoặc chọn file từ máy</p>
                <p className="text-xs text-slate-400 mt-1">Chấp nhận file định dạng .xlsx, .xls</p>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="mt-4 cursor-pointer text-xs text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-700"
                />
              </div>
            </CardBody>
          </Card>

          {/* Bảng xem trước dữ liệu Excel */}
          {excelRows.length > 0 && (
            <Card>
              <CardHeader
                title={`Xem trước dữ liệu (${excelRows.length} dòng)`}
                description={`${excelRows.filter((r) => r.valid).length} dòng hợp lệ, ${excelRows.filter((r) => !r.valid).length} dòng lỗi`}
                actions={
                  <Button
                    variant="primary"
                    loading={importingExcel}
                    onClick={handleExecuteImportExcel}
                    disabled={excelRows.filter((r) => r.valid).length === 0}
                  >
                    {importingExcel
                      ? `Đang nhập (${importProgress.current}/${importProgress.total})...`
                      : `Xác nhận nhập ${excelRows.filter((r) => r.valid).length} sách`}
                  </Button>
                }
              />
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <tr>
                      <Th>STT</Th>
                      <Th>Trạng thái</Th>
                      <Th>Tên sách</Th>
                      <Th>Tác giả</Th>
                      <Th>Thể loại</Th>
                      <Th>Khoa</Th>
                      <Th className="text-right">SL</Th>
                      <Th>Kệ</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {excelRows.map((r) => (
                      <tr key={r.index} className={r.valid ? "hover:bg-slate-50" : "bg-red-50/60"}>
                        <Td className="text-xs text-slate-500">{r.index}</Td>
                        <Td>
                          {r.valid ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Hợp lệ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-semibold" title={r.errorMsg}>
                              <AlertCircle className="h-3.5 w-3.5" /> {r.errorMsg}
                            </span>
                          )}
                        </Td>
                        <Td className="font-medium text-xs text-slate-900">{r.title}</Td>
                        <Td className="text-xs text-slate-600">{r.author || "—"}</Td>
                        <Td className="text-xs text-slate-600">{r.categoryName || "—"}</Td>
                        <Td className="text-xs text-slate-600 font-medium">{r.faculty || "Khác / Toàn trường"}</Td>
                        <Td className="text-right font-bold text-xs text-slate-900">{r.quantity}</Td>
                        <Td className="text-xs text-slate-500">{r.shelfLocation}</Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Modal In Tem Khi Vừa Tạo */}
      <Modal
        open={Boolean(createdBookForPrint)}
        onClose={() => setCreatedBookForPrint(null)}
        title="Tạo sách thành công — In tem Barcode"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreatedBookForPrint(null)}>
              Đóng
            </Button>
            <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
              In tem ngay
            </Button>
          </>
        }
      >
        {createdBookForPrint && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Đầu sách mới đã được tạo với mã <strong>{createdBookForPrint.bookCode}</strong>. Bạn có thể in tem ngay để dán lên sách.
            </p>
            <div className="flex justify-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <BarcodeLabel
                schoolName={settings.schoolName}
                title={createdBookForPrint.title}
                bookCode={createdBookForPrint.bookCode}
                barcode={createdBookForPrint.barcode}
              />
            </div>
            <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:p-4 print:z-50">
              <BarcodeLabel
                schoolName={settings.schoolName}
                title={createdBookForPrint.title}
                bookCode={createdBookForPrint.bookCode}
                barcode={createdBookForPrint.barcode}
              />
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
