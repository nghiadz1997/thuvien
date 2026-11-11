"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  const handleReset = () => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("thuvien_"));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
    window.location.href = "/";
  };

  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a", margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              width: "100%",
              background: "#fff",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: "18px" }}>Không thể tải trang chủ</h2>
            <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#475569" }}>
              Hệ thống gặp sự cố bất ngờ. Vui lòng thử lại hoặc tải lại trang.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => retry()}
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  border: 0,
                  borderRadius: "8px",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  background: "#fff",
                  color: "#334155",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Xóa cache & tải lại
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
