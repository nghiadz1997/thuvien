"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, KeyRound, LogOut, Menu, Search, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/constants";
import { logout } from "@/services/auth.service";
import { errorMessage } from "@/utils/errors";

export function Header({ onMenu }: { onMenu: () => void }) {
  const { profile } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const v = q.trim();
    router.push(v ? `/books?q=${encodeURIComponent(v)}` : "/books");
  };

  const onLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur print:hidden sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Mở menu">
        <Menu className="h-5 w-5" />
      </button>
      <form onSubmit={onSearch} className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm sách: tên, mã, barcode, tác giả, ISBN..."
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </form>
      <div className="flex-1 sm:hidden" />
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {(profile?.fullName || profile?.email || "?").charAt(0).toUpperCase()}
          </div>
          <div className="hidden text-left md:block">
            <p className="max-w-[160px] truncate text-sm font-medium text-slate-800">{profile?.fullName || profile?.email}</p>
            <p className="text-[11px] text-slate-500">{profile ? ROLE_LABELS[profile.role] : ""}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <div className="border-b border-slate-100 px-4 py-2.5 md:hidden">
              <p className="truncate text-sm font-medium">{profile?.fullName}</p>
              <p className="text-xs text-slate-500">{profile ? ROLE_LABELS[profile.role] : ""}</p>
            </div>
            <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <UserCircle2 className="h-4 w-4" /> Thông tin tài khoản
            </Link>
            <Link href="/profile#password" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <KeyRound className="h-4 w-4" /> Đổi mật khẩu
            </Link>
            <button onClick={onLogout} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
