"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Library,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isBootstrapped } from "@/services/settings.service";
import { login, resetPassword } from "@/services/auth.service";
import { errorMessage } from "@/utils/errors";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { isFirebaseConfigured } from "@/lib/firebase";

export default function LoginPage() {
  const { status } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  // Bootstrap state
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);

  // Load saved credentials preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedEmail = localStorage.getItem("thuvien_saved_email");
        const savedRemember = localStorage.getItem("thuvien_remember_me");
        if (savedEmail) setEmail(savedEmail);
        if (savedRemember !== null) setRememberMe(savedRemember === "true");
      } catch {
        // Ignore localStorage read errors
      }
    }
  }, []);

  useEffect(() => {
    if (status === "ready") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  useEffect(() => {
    if (isFirebaseConfigured) {
      isBootstrapped()
        .then((b) => setBootstrapped(b))
        .catch(() => setBootstrapped(true)); // if rules deny read, assume already bootstrapped
    }
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Vui lòng nhập đầy đủ Email và Mật khẩu");
      return;
    }
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem("thuvien_saved_email", email.trim());
          localStorage.setItem("thuvien_remember_me", "true");
        } else {
          localStorage.removeItem("thuvien_saved_email");
          localStorage.setItem("thuvien_remember_me", "false");
        }
      }

      await login(email, password, rememberMe);
      toast.success("Đăng nhập thành công! Đang chuyển hướng...");
      router.push("/dashboard");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Vui lòng nhập Email cần lấy lại mật khẩu");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      toast.success("Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư!");
      setResetMode(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (status === "unconfigured") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl text-center">
          <Library className="mx-auto h-12 w-12 text-blue-600 mb-2" />
          <h1 className="text-xl font-bold text-slate-800">Quản Lý Thư Viện NSG</h1>
          <p className="mt-2 text-sm text-slate-500">Firebase chưa được cấu hình. Vui lòng tạo file .env.local theo mẫu .env.example.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 text-center text-white">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-lg mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo Cao Đẳng Bách Khoa Nam Sài Gòn"
              className="h-full w-full object-contain"
            />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
            TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Hệ Thống Quản Lý Thư Viện</h1>
          <p className="mt-1 text-xs text-blue-100">Đăng nhập tài khoản cán bộ / thủ thư</p>
        </div>

        <div className="p-6 sm:p-8">
          {resetMode ? (
            /* Chế độ quên mật khẩu */
            <form onSubmit={handleResetPassword} className="space-y-4">
              <h2 className="text-base font-semibold text-slate-800">Quên mật khẩu</h2>
              <p className="text-xs text-slate-500">
                Nhập email tài khoản của bạn để nhận liên kết đặt lại mật khẩu từ Firebase.
              </p>

              <Field label="Email" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="thuthu@caodangnamsaigon.edu.vn"
                    className="pl-9"
                    required
                  />
                </div>
              </Field>

              <div className="flex flex-col gap-2 pt-2">
                <Button type="submit" loading={loading} className="w-full" variant="primary">
                  Gửi email khôi phục
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setResetMode(false)}
                  className="w-full text-slate-600"
                >
                  Quay lại đăng nhập
                </Button>
              </div>
            </form>
          ) : (
            /* Form Đăng nhập chính */
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="Email đăng nhập" required>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@thuvien.local"
                    className="pl-9"
                    required
                    autoComplete="email"
                  />
                </div>
              </Field>

              <Field label="Mật khẩu" required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>

                <button
                  type="button"
                  onClick={() => setResetMode(true)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>

              <Button type="submit" loading={loading} className="w-full mt-2" size="lg" variant="primary">
                Đăng nhập
              </Button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
            Hệ thống Quản lý Thư viện Nội bộ • Phiên bản 2026
          </div>
        </div>
      </div>
    </div>
  );
}
