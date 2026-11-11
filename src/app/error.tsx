"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Application error boundary:", error);
  }, [error]);

  const handleClearCacheAndReload = () => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("thuvien_"));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore storage errors
    }
    window.location.href = "/";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Không thể tải trang</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          Đã xảy ra sự cố khi hiển thị nội dung. Bạn có thể thử tải lại hoặc xóa bộ nhớ đệm cục bộ.
        </p>
        {error?.message && (
          <p className="mt-3 rounded-lg bg-slate-100 p-2.5 text-left font-mono text-xs text-slate-600 break-words">
            {error.message}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </button>
          <button
            type="button"
            onClick={handleClearCacheAndReload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Trash2 className="h-4 w-4" />
            Xóa cache & tải lại
          </button>
        </div>
      </div>
    </div>
  );
}
