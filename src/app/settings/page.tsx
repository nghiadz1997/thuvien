"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  Database,
  Library,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useSettings, useBooks } from "@/hooks/useRealtime";
import { saveSettings } from "@/services/settings.service";
import { seedDemoData } from "@/services/seed.service";
import { errorMessage } from "@/utils/errors";
import type { Settings } from "@/types";

export default function SettingsPage() {
  const { can, actor } = useAuth();
  const { data: currentSettings, loading } = useSettings();
  const { data: books } = useBooks();

  const [form, setForm] = useState<Settings>(currentSettings);
  const [saving, setSaving] = useState(false);

  // Seed demo
  const [seedConfirm, setSeedConfirm] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState("");

  useEffect(() => {
    if (currentSettings) {
      setForm(currentSettings);
    }
  }, [currentSettings]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!can("settings:manage")) {
      toast.error("Chỉ Quản trị viên mới có quyền đổi cài đặt hệ thống");
      return;
    }
    setSaving(true);
    try {
      await saveSettings(form);
      toast.success("Lưu cấu hình hệ thống thành công!");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSeed = async () => {
    if (!actor) return;
    setSeeding(true);
    setSeedProgress("Đang khởi tạo...");
    try {
      await seedDemoData(actor, form.barcodePrefix, (msg) => setSeedProgress(msg));
      toast.success("Khởi tạo dữ liệu mẫu hoàn tất!");
      setSeedConfirm(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSeeding(false);
      setSeedProgress("");
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="Cài đặt Hệ thống"
        description="Thiết lập tham số hoạt động thư viện, quy định mượn trả và cấu trúc mã vạch"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Thông số nghiệp vụ thư viện"
              description="Các tham số này áp dụng cho toàn bộ quy trình mượn/trả và in tem"
              icon={<SettingsIcon className="h-5 w-5 text-blue-600" />}
            />
            <CardBody>
              <form onSubmit={handleSave} className="space-y-4">
                <Field label="Tên đơn vị chủ quản / Trường học" required>
                  <Input
                    value={form.schoolName}
                    onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))}
                    placeholder="TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN"
                    required
                  />
                </Field>

                <Field label="Tên thư viện hiển thị" required>
                  <Input
                    value={form.libraryName}
                    onChange={(e) => setForm((f) => ({ ...f, libraryName: e.target.value }))}
                    placeholder="Thư viện NSG"
                    required
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Tiền tố sinh mã vạch / Mã sách" required hint="Chỉ chữ in hoa, số và dấu gạch">
                    <Input
                      value={form.barcodePrefix}
                      onChange={(e) => setForm((f) => ({ ...f, barcodePrefix: e.target.value.toUpperCase() }))}
                      placeholder="NSG-BK"
                      required
                    />
                  </Field>

                  <Field label="Ngưỡng cảnh báo sắp hết sách (cuốn)" required>
                    <Input
                      type="number"
                      min={0}
                      value={form.lowStockThreshold}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 0 }))
                      }
                      required
                    />
                  </Field>

                  <Field label="Số sách tối đa 1 người được mượn" required>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={form.maxBorrowBooks}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, maxBorrowBooks: parseInt(e.target.value) || 1 }))
                      }
                      required
                    />
                  </Field>

                  <Field label="Thời gian mượn mặc định (ngày)" required>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={form.defaultBorrowDays}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, defaultBorrowDays: parseInt(e.target.value) || 14 }))
                      }
                      required
                    />
                  </Field>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <Button type="submit" variant="primary" icon={<Save className="h-4 w-4" />} loading={saving}>
                    Lưu cấu hình
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Khởi tạo dữ liệu mẫu cho hệ thống mới */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Logo & Nhận diện thương hiệu"
              description="Biểu trưng chính thức của trường"
              icon={<Building2 className="h-5 w-5 text-blue-600" />}
            />
            <CardBody className="flex flex-col items-center justify-center p-6 text-center">
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-50 p-2 shadow-sm border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Logo Cao Đẳng Bách Khoa Nam Sài Gòn"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="mt-3 text-xs font-bold text-slate-800 uppercase">
                {form.schoolName || "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN"}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hiển thị trên Sidebar, Màn hình đăng nhập, Tem in và Báo cáo
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Dữ liệu mẫu (Demo Data)"
              description="Dùng khi triển khai cơ sở dữ liệu trống để kiểm thử"
              icon={<Database className="h-5 w-5 text-indigo-600" />}
            />
            <CardBody className="space-y-3 text-xs text-slate-600">
              <p>
                Nếu thư viện của bạn vừa tạo mới trên Firebase và chưa có sách nào, bạn có thể nạp bộ dữ liệu mẫu gồm 12 đầu sách giáo trình, 8 độc giả và các phiếu mượn/trả thực tế để trải nghiệm đầy đủ Dashboard và các tính năng.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                  icon={<Sparkles className="h-4 w-4" />}
                  disabled={books.length > 0}
                  onClick={() => setSeedConfirm(true)}
                >
                  {books.length > 0 ? "Đã có dữ liệu sách trong hệ thống" : "Nạp dữ liệu mẫu vào Firestore"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Confirm Nạp Demo */}
      <ConfirmDialog
        open={seedConfirm}
        onClose={() => setSeedConfirm(false)}
        onConfirm={handleSeed}
        title="Khởi tạo dữ liệu mẫu"
        confirmText="Xác nhận nạp"
        loading={seeding}
        message={
          <div>
            <p>Hệ thống sẽ tạo tự động:</p>
            <ul className="mt-2 list-disc list-inside text-xs space-y-1 text-slate-700">
              <li>6 Thể loại chuyên ngành (CNTT, Cơ khí, Điện tử, Kinh tế...)</li>
              <li>12 Đầu sách và sinh mã vạch chuẩn</li>
              <li>8 Độc giả (Sinh viên, Giảng viên)</li>
              <li>Các phiếu mượn, trả và lịch sử biến động kho</li>
            </ul>
            {seedProgress && <p className="mt-3 font-semibold text-blue-600">{seedProgress}</p>}
          </div>
        }
      />
    </AppShell>
  );
}
