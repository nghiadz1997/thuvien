"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { LoadingState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { status, profile, error } = useAuth();
  const router = useRouter();

  // Chuyển hướng an toàn bên trong useEffect khi đã xác nhận đăng xuất
  useEffect(() => {
    if (status === "signed-out") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingState label="Đang tải dữ liệu thư viện..." />
      </div>
    );
  }

  if (status === "unconfigured") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 mb-4">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Chưa cấu hình Firebase</h2>
          <p className="mt-2 text-sm text-slate-600">
            Hệ thống chưa tìm thấy thông tin cấu hình Firebase trong biến môi trường.
          </p>
          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-left font-mono text-xs text-slate-700 space-y-1">
            <p className="font-semibold font-sans text-slate-800">Hướng dẫn nhanh:</p>
            <p>1. Sao chép file <span className="text-blue-600 font-bold">.env.example</span> thành <span className="text-blue-600 font-bold">.env.local</span></p>
            <p>2. Điền thông tin Firebase Project của bạn</p>
            <p>3. Khởi động lại ứng dụng: <span className="text-blue-600 font-bold">npm run dev</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingState label="Chuyển hướng đến trang đăng nhập..." />
      </div>
    );
  }

  if (status === "disabled") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 mb-4">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Tài khoản bị tạm khóa</h2>
          <p className="mt-2 text-sm text-slate-600">
            Tài khoản của bạn đã bị quản trị viên vô hiệu hóa. Vui lòng liên hệ người quản trị thư viện để được mở khóa.
          </p>
          <div className="mt-6">
            <Link href="/login">
              <Button variant="outline">Quay lại trang Đăng nhập</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col lg:pl-64">
        <Header onMenu={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
