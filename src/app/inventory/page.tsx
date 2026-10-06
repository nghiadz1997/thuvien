"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  Layers,
  Package,
  Plus,
  QrCode,
  RotateCcw,
  ScanBarcode,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { onSnapshot, collection, doc } from "firebase/firestore";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Table, TBody, Td, Th, THead } from "@/components/ui/Table";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { BarcodeScannerInput, type BarcodeScannerInputHandle } from "@/components/barcode/BarcodeScannerInput";
import { CameraScannerModal } from "@/components/barcode/CameraScannerModal";
import { useAuth } from "@/hooks/useAuth";
import { useBooks } from "@/hooks/useRealtime";
import { useBookLookup } from "@/hooks/useBookLookup";
import { useAsync } from "@/hooks/useAsync";
import {
  cancelInventorySession,
  completeInventorySession,
  computeInventory,
  createInventorySession,
  INVENTORY_ITEMS,
  recordInventoryScan,
  undoInventoryScan,
} from "@/services/inventory.service";
import { COLLECTIONS } from "@/lib/constants";
import { getDb } from "@/lib/firebase";
import { col, snapToData } from "@/lib/firestore";
import { exportExcel, todayStamp } from "@/utils/excel";
import { formatDate, formatDateTime, formatNumber } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import type { InventoryItem, InventorySession } from "@/types";

export default function InventoryPage() {
  const { actor, can } = useAuth();
  const { data: books } = useBooks();
  const lookupBook = useBookLookup();

  // Danh sách các đợt kiểm kê đã tạo
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Đợt kiểm kê đang hoạt động / được chọn
  const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
  const [scannedItems, setScannedItems] = useState<InventoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Modal tạo đợt mới
  const [createModal, setCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState(
    `Kiểm kê Thư viện Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
  );
  const [newSessionNote, setNewSessionNote] = useState("");
  const [creating, setCreating] = useState(false);

  // Modal hoàn tất
  const [completeConfirm, setCompleteConfirm] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Modal hủy đợt
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Modal Camera Quét liên tục trên điện thoại
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const scannerRef = useRef<BarcodeScannerInputHandle>(null);

  // Lắng nghe danh sách Sessions
  useEffect(() => {
    const unsub = onSnapshot(
      col(COLLECTIONS.inventorySessions),
      (snap) => {
        const list = snap.docs
          .map((d) => snapToData<InventorySession>(d))
          .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setSessions(list);
        setLoadingSessions(false);

        // Nếu chưa chọn phiên nào và có phiên đang in_progress, chọn phiên đó
        if (!activeSession) {
          const ongoing = list.find((s) => s.status === "in_progress");
          if (ongoing) setActiveSession(ongoing);
        }
      },
      (err) => {
        toast.error(`Lỗi tải đợt kiểm kê: ${errorMessage(err)}`);
        setLoadingSessions(false);
      },
    );
    return () => unsub();
  }, [activeSession]);

  // Lắng nghe các items của active session
  useEffect(() => {
    if (!activeSession) {
      setScannedItems([]);
      return;
    }
    setLoadingItems(true);
    const unsub = onSnapshot(
      collection(getDb(), COLLECTIONS.inventorySessions, activeSession.id, INVENTORY_ITEMS),
      (snap) => {
        const items = snap.docs.map((d) => snapToData<InventoryItem>(d));
        setScannedItems(items);
        setLoadingItems(false);
      },
      (err) => {
        toast.error(errorMessage(err));
        setLoadingItems(false);
      },
    );
    return () => unsub();
  }, [activeSession?.id]);

  // Tính toán kết quả so sánh thời gian thực
  const result = useMemo(() => {
    return computeInventory(books, scannedItems);
  }, [books, scannedItems]);

  // Bộ lọc bảng kết quả
  const [filterTab, setFilterTab] = useState<"ALL" | "MISSING" | "EXTRA" | "MATCH" | "UNKNOWN">("ALL");

  const displayedRows = useMemo(() => {
    switch (filterTab) {
      case "MISSING":
        return result.missing;
      case "EXTRA":
        return result.extra;
      case "MATCH":
        return result.rows.filter((r) => r.diff === 0 && r.known);
      case "UNKNOWN":
        return [];
      default:
        return result.rows;
    }
  }, [result, filterTab]);

  // Xử lý tạo phiên kiểm kê mới
  const handleCreateSession = async () => {
    if (!actor) return;
    if (!newSessionName.trim()) {
      toast.error("Vui lòng nhập tên đợt kiểm kê");
      return;
    }
    setCreating(true);
    try {
      const expectedTotal = books.reduce((s, b) => s + (b.quantityAvailable || 0), 0);
      const newId = await createInventorySession(newSessionName, newSessionNote, expectedTotal, actor);
      toast.success("Đã tạo đợt kiểm kê mới!");
      setCreateModal(false);
      const created = sessions.find((s) => s.id === newId) || {
        id: newId,
        name: newSessionName,
        note: newSessionNote,
        startDate: null,
        endDate: null,
        status: "in_progress",
        scannedCount: 0,
        expectedCount: expectedTotal,
        missingCount: 0,
        extraCount: 0,
        createdBy: actor.uid,
        createdByName: actor.name,
        createdAt: null,
      };
      setActiveSession(created);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // Quét mã vạch kiểm kê
  const handleScanInventory = async (code: string) => {
    if (!activeSession) return false;
    const b = await lookupBook(code);
    try {
      await recordInventoryScan(activeSession.id, code, b);
      if (b) {
        toast.success(`Đã ghi nhận: ${b.title}`, { duration: 1000 });
      } else {
        toast.warning(`Đã ghi nhận mã lạ chưa đăng ký: ${code}`, { duration: 1500 });
      }
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  };

  // Hoàn tất kiểm kê
  const handleCompleteSession = async () => {
    if (!activeSession || !actor) return;
    setCompleting(true);
    try {
      await completeInventorySession(activeSession.id, activeSession.name, books, scannedItems, actor);
      toast.success("Đã hoàn tất đợt kiểm kê và ghi nhận số liệu!");
      setCompleteConfirm(false);
      setActiveSession(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCompleting(false);
    }
  };

  // Hủy đợt kiểm kê
  const handleCancelSession = async () => {
    if (!activeSession) return;
    setCancelling(true);
    try {
      await cancelInventorySession(activeSession.id);
      toast.info("Đã hủy đợt kiểm kê");
      setCancelConfirm(false);
      setActiveSession(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  // Xuất Excel kết quả kiểm kê
  const handleExportInventoryExcel = () => {
    if (!activeSession) return;
    const rows = result.rows.map((r, idx) => ({
      STT: idx + 1,
      "Tên sách": r.title,
      Barcode: r.barcode,
      "Cần có trên kệ": r.expected,
      "Đã quét thực tế": r.scanned,
      "Chênh lệch": r.diff === 0 ? "Khớp" : r.diff > 0 ? `Dư +${r.diff}` : `Thiếu ${r.diff}`,
      "Đang cho mượn": r.borrowed,
      "Trạng thái": r.diff === 0 ? "Khớp" : r.diff > 0 ? "Dư sách" : "Thiếu sách",
    }));
    exportExcel(`Ket_qua_kiem_ke_${todayStamp()}`, [{ name: "Ket qua kiem ke", rows }]);
    toast.success("Đã xuất kết quả kiểm kê ra file Excel!");
  };

  return (
    <AppShell>
      <PageHeader
        title="Kiểm kê Thư viện"
        description="Quét mã vạch kiểm tra số lượng sách thực tế trên kệ so với dữ liệu hệ thống"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!activeSession && can("inventory") && (
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setCreateModal(true)}
              >
                Tạo đợt kiểm kê mới
              </Button>
            )}
            {activeSession && activeSession.status === "in_progress" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
                  onClick={handleExportInventoryExcel}
                >
                  Xuất Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelConfirm(true)}
                  className="text-red-600"
                >
                  Hủy đợt này
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  onClick={() => setCompleteConfirm(true)}
                >
                  Hoàn tất kiểm kê
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Trường hợp chưa chọn phiên kiểm kê hoặc đang xem danh sách các đợt */}
      {!activeSession ? (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Lịch sử các đợt kiểm kê"
              description="Xem lại số liệu các đợt kiểm kê đã thực hiện"
              icon={<History className="h-5 w-5 text-blue-600" />}
            />
            <div className="overflow-x-auto">
              {loadingSessions ? (
                <LoadingState label="Đang nạp danh sách đợt kiểm kê..." />
              ) : sessions.length === 0 ? (
                <EmptyState
                  title="Chưa có đợt kiểm kê nào"
                  description="Bấm 'Tạo đợt kiểm kê mới' để bắt đầu tiến hành kiểm kê thư viện"
                />
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <Th>Tên đợt kiểm kê</Th>
                      <Th>Thời gian bắt đầu</Th>
                      <Th>Thời gian kết thúc</Th>
                      <Th className="text-right">Sách cần có</Th>
                      <Th className="text-right">Đã quét</Th>
                      <Th className="text-right">Thiếu</Th>
                      <Th className="text-right">Dư</Th>
                      <Th>Trạng thái</Th>
                      <Th className="text-center">Thao tác</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <Td className="font-semibold text-xs text-slate-900">{s.name}</Td>
                        <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(s.startDate || s.createdAt)}</Td>
                        <Td className="text-xs text-slate-500 whitespace-nowrap">{s.endDate ? formatDateTime(s.endDate) : "—"}</Td>
                        <Td className="text-right font-medium text-xs">{s.expectedCount}</Td>
                        <Td className="text-right font-bold text-xs text-blue-600">{s.scannedCount}</Td>
                        <Td className="text-right font-semibold text-xs text-red-600">{s.missingCount || 0}</Td>
                        <Td className="text-right font-semibold text-xs text-amber-600">{s.extraCount || 0}</Td>
                        <Td>
                          <Badge color={s.status === "completed" ? "green" : s.status === "in_progress" ? "amber" : "slate"}>
                            {s.status === "completed" ? "Đã hoàn tất" : s.status === "in_progress" ? "Đang tiến hành" : "Đã hủy"}
                          </Badge>
                        </Td>
                        <Td className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveSession(s)}
                          >
                            {s.status === "in_progress" ? "Tiếp tục quét" : "Xem chi tiết"}
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      ) : (
        /* GIAO DIỆN QUÉT VÀ THEO DÕI ĐỢT KIỂM KÊ */
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-blue-50 p-4 rounded-xl border border-blue-200">
            <div>
              <button
                onClick={() => setActiveSession(null)}
                className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mb-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Quay lại danh sách đợt
              </button>
              <h2 className="text-lg font-bold text-blue-950">{activeSession.name}</h2>
              <p className="text-xs text-blue-700">
                Bắt đầu lúc: {formatDateTime(activeSession.startDate || activeSession.createdAt)} • Trạng thái:{" "}
                <strong>{activeSession.status === "in_progress" ? "Đang tiến hành" : "Đã kết thúc"}</strong>
              </p>
            </div>
          </div>

          {/* 5 Card Chỉ Số Kiểm Kê */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="Cần có trên kệ"
              value={formatNumber(result.expectedTotal)}
              icon={<Package className="h-5 w-5" />}
              tone="slate"
            />
            <StatCard
              label="Đã quét thực tế"
              value={formatNumber(result.scannedTotal)}
              icon={<ScanBarcode className="h-5 w-5" />}
              tone="blue"
            />
            <StatCard
              label="Chưa quét / Thiếu"
              value={formatNumber(result.missingTotal)}
              icon={<TrendingDown className="h-5 w-5" />}
              tone="red"
            />
            <StatCard
              label="Dư thừa"
              value={formatNumber(result.extraTotal)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="amber"
            />
            <StatCard
              label="Đang cho mượn"
              value={formatNumber(books.reduce((s, b) => s + (b.quantityBorrowed || 0), 0))}
              icon={<ClipboardCheck className="h-5 w-5" />}
              tone="emerald"
            />
          </div>

          {/* Vùng Quét Nhanh Liên Tục (Nếu đang in_progress) */}
          {activeSession.status === "in_progress" && (
            <Card className="border-blue-300 ring-2 ring-blue-500/20">
              <CardHeader
                title="Chế độ quét kiểm kê nhanh (QR & Barcode)"
                description="Quét -> Tiếng Bíp & Rung -> Tự ghi nhận -> Sẵn sàng quét cuốn tiếp theo mà không cần chạm chuột"
                icon={<ScanBarcode className="h-5 w-5 text-blue-600" />}
                actions={
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Camera className="h-4 w-4" />}
                    onClick={() => setCameraModalOpen(true)}
                  >
                    Mở Camera Điện Thoại
                  </Button>
                }
              />
              <CardBody className="space-y-3">
                <BarcodeScannerInput
                  ref={scannerRef}
                  onScan={handleScanInventory}
                  placeholder="Hướng máy quét hoặc camera vào mã QR / Barcode sách để kiểm kê..."
                  keepFocus={true}
                  duplicateCooldownMs={800}
                />
              </CardBody>
            </Card>
          )}

          {/* Bảng Chi Tiết Kết Quả Kiểm Kê */}
          <Card>
            <CardHeader
              title="Chi tiết đối soát theo đầu sách"
              description="Bảng so sánh số lượng sách thực tế và lý thuyết"
              actions={
                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setFilterTab("ALL")}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filterTab === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Tất cả ({result.rows.length})
                  </button>
                  <button
                    onClick={() => setFilterTab("MISSING")}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filterTab === "MISSING" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Thiếu ({result.missing.length})
                  </button>
                  <button
                    onClick={() => setFilterTab("EXTRA")}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filterTab === "EXTRA" ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Dư ({result.extra.length})
                  </button>
                  <button
                    onClick={() => setFilterTab("MATCH")}
                    className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                      filterTab === "MATCH" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Khớp ({result.rows.filter((r) => r.diff === 0 && r.known).length})
                  </button>
                </div>
              }
            />
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <Th>Tên sách / Barcode</Th>
                    <Th className="text-right">Cần có trên kệ</Th>
                    <Th className="text-right">Đã quét</Th>
                    <Th className="text-right">Đang mượn</Th>
                    <Th className="text-center">Kết quả</Th>
                  </tr>
                </THead>
                <TBody>
                  {displayedRows.map((r) => (
                    <tr key={r.bookId} className="hover:bg-slate-50">
                      <Td className="max-w-[280px]">
                        <p className="font-semibold text-xs text-slate-900 line-clamp-1">{r.title}</p>
                        <p className="font-mono text-[10px] text-blue-600">{r.barcode}</p>
                      </Td>
                      <Td className="text-right font-medium text-xs text-slate-700">{r.expected}</Td>
                      <Td className="text-right font-bold text-xs text-blue-700">{r.scanned}</Td>
                      <Td className="text-right text-xs text-slate-500">{r.borrowed}</Td>
                      <Td className="text-center">
                        {r.diff === 0 ? (
                          <Badge color="green">Khớp đủ</Badge>
                        ) : r.diff < 0 ? (
                          <Badge color="red">Thiếu {-r.diff} cuốn</Badge>
                        ) : (
                          <Badge color="amber">Dư +{r.diff} cuốn</Badge>
                        )}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Tạo Đợt Mới */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="Tạo đợt kiểm kê thư viện mới"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateModal(false)} disabled={creating}>
              Hủy
            </Button>
            <Button variant="primary" onClick={handleCreateSession} loading={creating}>
              Bắt đầu kiểm kê
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Tên đợt kiểm kê" required>
            <Input
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              placeholder="Ví dụ: Kiểm kê cuối năm 2026..."
              required
            />
          </Field>
          <Field label="Ghi chú kế hoạch">
            <Textarea
              value={newSessionNote}
              onChange={(e) => setNewSessionNote(e.target.value)}
              placeholder="Ghi chú các dãy kệ cần kiểm kê..."
            />
          </Field>
        </div>
      </Modal>

      {/* Modal Hoàn Tất Kiểm Kê */}
      <ConfirmDialog
        open={completeConfirm}
        onClose={() => setCompleteConfirm(false)}
        onConfirm={handleCompleteSession}
        title="Xác nhận hoàn tất đợt kiểm kê"
        confirmText="Hoàn tất và lưu kết quả"
        loading={completing}
        message={
          <div>
            <p>
              Bạn có chắc chắn muốn kết thúc đợt kiểm kê <strong>{activeSession?.name}</strong>?
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Hệ thống sẽ lưu trữ thống kê và ghi nhận Transaction Log (INVENTORY) cho các đầu sách có chênh lệch số lượng.
            </p>
          </div>
        }
      />

      {/* Modal Hủy Đợt Kiểm Kê */}
      <ConfirmDialog
        open={cancelConfirm}
        onClose={() => setCancelConfirm(false)}
        onConfirm={handleCancelSession}
        title="Hủy đợt kiểm kê"
        danger
        confirmText="Xác nhận hủy"
        loading={cancelling}
        message="Bạn có chắc chắn muốn hủy đợt kiểm kê này? Dữ liệu quét đợt này sẽ không được tính vào lịch sử hoàn thành."
      />

      {/* Camera Scanner Modal (Quét liên tục cho điện thoại) */}
      <CameraScannerModal
        open={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onScan={handleScanInventory}
        continuous={true}
        title={`Camera Kiểm Kê Sách (${activeSession?.name || "Đợt kiểm kê"})`}
      />

      {/* Floating Action Button trên giao diện điện thoại */}
      {activeSession?.status === "in_progress" && !cameraModalOpen && (
        <div className="fixed bottom-6 right-6 z-30 sm:hidden">
          <button
            type="button"
            onClick={() => setCameraModalOpen(true)}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-2xl active:scale-95 transition-transform ring-4 ring-blue-600/30"
          >
            <Camera className="h-5 w-5" />
            <span>Quét Camera</span>
          </button>
        </div>
      )}
    </AppShell>
  );
}
