"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  Repeat,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { LoadingState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/inventory", label: "Kiểm kê", icon: ClipboardCheck },
  { href: "/circulation", label: "Mượn trả", icon: Repeat },
  { href: "/books", label: "Kho sách", icon: BookOpen },
  { href: "/borrowers", label: "Bạn đọc", icon: Users },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { status, profile, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 pb-24 lg:pb-8">{children}</main>

        {/* Thanh Điều Hướng Đáy Màn Hình Dành Riêng Cho Điện Thoại (Mobile App Navigation Bar) */}
        <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.06)] lg:hidden">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center min-w-[60px] py-1 px-1.5 rounded-xl transition-all ${
                  isActive
                    ? "text-blue-600 font-bold scale-105"
                    : "text-slate-500 font-medium hover:text-slate-900 active:scale-95"
                }`}
              >
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive ? "bg-blue-50 text-blue-600" : "bg-transparent text-slate-500"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
