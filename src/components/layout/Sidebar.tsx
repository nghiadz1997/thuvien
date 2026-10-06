"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FolderTree,
  History,
  LayoutDashboard,
  Library,
  PackagePlus,
  Settings,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useRealtime";
import type { Permission } from "@/lib/permissions";
import { cn } from "@/utils/cn";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  permission: Permission;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tổng quan", icon: <LayoutDashboard className="h-5 w-5" />, permission: "view" },
  { href: "/books", label: "Quản lý sách", icon: <BookOpen className="h-5 w-5" />, permission: "view" },
  { href: "/import", label: "Nhập sách", icon: <PackagePlus className="h-5 w-5" />, permission: "book:write" },
  { href: "/circulation", label: "Mượn / Trả", icon: <ArrowLeftRight className="h-5 w-5" />, permission: "circulation" },
  { href: "/inventory", label: "Kiểm kê", icon: <ClipboardCheck className="h-5 w-5" />, permission: "inventory" },
  { href: "/borrowers", label: "Người mượn", icon: <Users className="h-5 w-5" />, permission: "circulation" },
  { href: "/transactions", label: "Lịch sử giao dịch", icon: <History className="h-5 w-5" />, permission: "circulation" },
  { href: "/reports", label: "Báo cáo", icon: <BarChart3 className="h-5 w-5" />, permission: "report:view" },
  { href: "/categories", label: "Danh mục", icon: <FolderTree className="h-5 w-5" />, permission: "category:write" },
  { href: "/users", label: "Người dùng", icon: <UserCog className="h-5 w-5" />, permission: "user:manage" },
  { href: "/settings", label: "Cài đặt", icon: <Settings className="h-5 w-5" />, permission: "settings:manage" },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  const { data: settings } = useSettings();

  return (
    <>
      {/* overlay mobile/tablet */}
      <div
        className={cn("fixed inset-0 z-30 bg-slate-900/40 lg:hidden print:hidden", open ? "block" : "hidden")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 print:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-100 px-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5" onClick={onClose}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo Cao Đẳng Bách Khoa Nam Sài Gòn"
              className="h-10 w-10 shrink-0 object-contain drop-shadow-sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{settings.libraryName}</p>
              <p className="truncate text-[11px] text-slate-500 font-medium">Bách Khoa Nam Sài Gòn</p>
            </div>
          </Link>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Đóng menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV_ITEMS.filter((i) => can(i.permission)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <span className={active ? "text-blue-600" : "text-slate-400"}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 px-4 py-3 text-[11px] leading-snug text-slate-400">{settings.schoolName}</div>
      </aside>
    </>
  );
}
