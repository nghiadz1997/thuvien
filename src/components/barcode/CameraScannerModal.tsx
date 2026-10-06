"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight, RefreshCw, X, CheckCircle2, Zap } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { beepSuccess, beepError } from "@/utils/sound";

export interface CameraScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => Promise<boolean | void> | boolean | void;
  title?: string;
  continuous?: boolean;
}

export function CameraScannerModal({
  open,
  onClose,
  onScan,
  title = "Quét mã QR / Barcode bằng Camera",
  continuous = false,
}: CameraScannerModalProps) {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerDivId = "reader-camera-scanner-view";
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => undefined);
      }
      scannerRef.current = null;
      setLastScanned(null);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;

    async function initCamera() {
      try {
        setErrorMsg(null);
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (!devices || devices.length === 0) {
          setErrorMsg("Không tìm thấy camera trên thiết bị của bạn.");
          return;
        }

        setCameras(devices);
        // Ưu tiên camera sau (back / environment)
        const backCam = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment"),
        );
        const activeId = backCam?.id || devices[devices.length - 1].id;
        setSelectedCameraId(activeId);

        startScanning(activeId);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg("Không thể truy cập camera. Vui lòng cấp quyền sử dụng camera trong trình duyệt.");
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => undefined);
      }
      scannerRef.current = null;
    };
  }, [open]);

  const startScanning = async (cameraId: string) => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }

      const scanner = new Html5Qrcode(readerDivId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });

      scannerRef.current = scanner;

      await scanner.start(
        cameraId,
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
        },
        async (decodedText) => {
          if (cooldownRef.current) return;
          const code = decodedText.trim();
          if (!code) return;

          cooldownRef.current = true;
          setLastScanned(code);
          setScanCount((c) => c + 1);

          // Rung nhẹ điện thoại (Haptic feedback) nếu thiết bị hỗ trợ
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(80);
          }

          try {
            beepSuccess();
            await onScan(code);
            if (!continuous) {
              onClose();
            }
          } catch {
            beepError();
          } finally {
            setTimeout(() => {
              cooldownRef.current = false;
            }, 1200);
          }
        },
        () => {
          // ignore frame parse misses
        },
      );

      // Kiểm tra hỗ trợ đèn pin (Torch)
      try {
        const capabilities = (scanner as any).getRunningTrackCapabilities?.();
        setHasTorch(Boolean(capabilities?.torch));
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      console.warn("Lỗi khởi động camera:", err);
      setErrorMsg("Không thể bật camera này. Hãy thử chọn camera khác.");
    }
  };

  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    const currIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currIndex + 1) % cameras.length;
    const nextCam = cameras[nextIndex];
    setSelectedCameraId(nextCam.id);
    await startScanning(nextCam.id);
  };

  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch {
      // Torch toggle failed
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            {continuous && scanCount > 0 ? (
              <span className="font-semibold text-emerald-600">Đã quét: {scanCount} lần</span>
            ) : (
              <span>Hướng camera vào mã QR hoặc Barcode</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-700">
            <p className="font-semibold">{errorMsg}</p>
            <p className="mt-1 text-slate-500">
              Hãy đảm bảo bạn đang mở website qua giao thức <strong>HTTPS</strong> hoặc <strong>localhost</strong> và đã cấp quyền truy cập Camera.
            </p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-black aspect-square max-w-sm mx-auto shadow-inner flex items-center justify-center">
            <div id={readerDivId} className="w-full h-full" />

            {/* Khung ngắm quét động */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-60 w-60 rounded-2xl border-2 border-dashed border-blue-400/80 bg-blue-500/5 shadow-2xl flex items-center justify-center">
                <div className="absolute inset-x-4 top-1/2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
              </div>
            </div>

            {/* Nút điều khiển nhanh trên camera */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {hasTorch && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={`rounded-full p-2.5 backdrop-blur-md transition-colors ${
                    torchOn ? "bg-amber-400 text-slate-900" : "bg-black/50 text-white hover:bg-black/70"
                  }`}
                  title="Bật/Tắt đèn Flash"
                >
                  <Zap className="h-4 w-4" />
                </button>
              )}
              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="rounded-full bg-black/50 p-2.5 text-white backdrop-blur-md hover:bg-black/70 transition-colors"
                  title="Đổi camera"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Thông báo quét thành công */}
            {lastScanned && (
              <div className="absolute bottom-3 inset-x-3 rounded-xl bg-slate-900/90 p-2 text-center text-white backdrop-blur-md border border-emerald-500/50 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-xs font-bold truncate">{lastScanned}</span>
              </div>
            )}
          </div>
        )}

        <div className="text-center text-[11px] text-slate-500">
          💡 Tương thích tốt với cả <strong>Mã QR (2D)</strong> và <strong>Mã vạch Barcode (1D)</strong> trên điện thoại.
        </div>
      </div>
    </Modal>
  );
}
