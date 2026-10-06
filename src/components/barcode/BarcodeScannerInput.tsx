"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { beepError, beepSuccess, beepWarning } from "@/utils/sound";

export interface BarcodeScannerInputHandle {
  focus: () => void;
  clear: () => void;
}

export interface BarcodeScannerInputProps {
  /**
   * Xử lý mã quét được. Trả về `false` nếu mã không hợp lệ / không tìm thấy (beep lỗi),
   * `true` hoặc `void` nếu thành công (beep thành công). Ném lỗi → beep lỗi + toast.
   */
  onScan: (code: string) => Promise<boolean | void> | boolean | void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  /** Tự lấy lại focus khi người dùng bấm ra vùng trống (không phải ô nhập khác) */
  keepFocus?: boolean;
  /** Chặn quét lặp cùng 1 mã trong khoảng thời gian (ms) */
  duplicateCooldownMs?: number;
  /** Tự gửi khi máy quét không gửi Enter (nhận diện gõ rất nhanh rồi dừng) */
  autoSubmitWithoutEnter?: boolean;
  disabled?: boolean;
  sound?: boolean;
  size?: "md" | "lg";
  className?: string;
}

const FAST_KEY_INTERVAL_MS = 35; // máy quét HID gõ < 35ms/ký tự, người gõ tay thường > 80ms
const IDLE_SUBMIT_MS = 120; // debounce: sau 120ms không có ký tự mới thì coi như quét xong
const MIN_CODE_LENGTH = 3;

/**
 * Ô nhập dùng chung cho máy quét mã vạch USB dạng Keyboard HID.
 * - Tự focus, xử lý khi nhận Enter (hoặc tự nhận diện khi máy quét không gửi Enter)
 * - Chống quét trùng quá nhanh, khóa khi đang xử lý
 * - Beep + toast, tự focus lại sau khi xử lý
 * - Vẫn cho phép nhập tay rồi bấm Enter
 */
export const BarcodeScannerInput = forwardRef<BarcodeScannerInputHandle, BarcodeScannerInputProps>(function BarcodeScannerInput(
  {
    onScan,
    placeholder = "Quét mã vạch hoặc nhập mã rồi nhấn Enter...",
    label,
    autoFocus = true,
    keepFocus = false,
    duplicateCooldownMs = 1500,
    autoSubmitWithoutEnter = true,
    disabled,
    sound = true,
    size = "lg",
    className,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [processing, setProcessing] = useState(false);
  const [focused, setFocused] = useState(false);
  const processingRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const keyTimesRef = useRef<number[]>([]);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const focus = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useImperativeHandle(ref, () => ({ focus, clear: () => setValue("") }), [focus]);

  useEffect(() => {
    if (autoFocus && !disabled) focus();
  }, [autoFocus, disabled, focus]);

  // Giữ focus: khi bấm vào vùng không phải ô nhập/nút → focus lại ô quét
  useEffect(() => {
    if (!keepFocus || disabled) return;
    const onPointerUp = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("input, textarea, select, button, a, [role=dialog], [contenteditable=true], label")) return;
      if (window.getSelection()?.toString()) return;
      focus();
    };
    document.addEventListener("pointerup", onPointerUp);
    return () => document.removeEventListener("pointerup", onPointerUp);
  }, [keepFocus, disabled, focus]);

  useEffect(() => () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const submit = useCallback(
    async (raw: string) => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      keyTimesRef.current = [];
      const code = raw.replace(/[\r\n\t]/g, "").trim();
      setValue("");
      if (!code || processingRef.current) return;

      const now = Date.now();
      if (code === lastScanRef.current.code && now - lastScanRef.current.at < duplicateCooldownMs) {
        if (sound) beepWarning();
        toast.warning(`Vừa quét mã ${code} — bỏ qua quét trùng`, { id: "scan-dup", duration: 1500 });
        focus();
        return;
      }
      lastScanRef.current = { code, at: now };

      processingRef.current = true;
      setProcessing(true);
      try {
        const result = await onScanRef.current(code);
        if (result === false) {
          if (sound) beepError();
          // cho phép quét lại ngay mã lỗi sau khi sửa
          lastScanRef.current = { code: "", at: 0 };
        } else if (sound) beepSuccess();
      } catch (err) {
        if (sound) beepError();
        toast.error(errorMessage(err));
        lastScanRef.current = { code: "", at: 0 };
      } finally {
        processingRef.current = false;
        setProcessing(false);
        focus();
      }
    },
    [duplicateCooldownMs, focus, sound],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit(e.currentTarget.value);
      return;
    }
    if (e.key.length === 1) {
      const times = keyTimesRef.current;
      const now = performance.now();
      if (times.length && now - times[times.length - 1] > 500) times.length = 0;
      times.push(now);
    }
  };

  const onChange = (v: string) => {
    setValue(v);
    if (!autoSubmitWithoutEnter) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      const times = keyTimesRef.current;
      if (times.length < MIN_CODE_LENGTH) return;
      const avg = (times[times.length - 1] - times[0]) / (times.length - 1);
      if (avg <= FAST_KEY_INTERVAL_MS && inputRef.current) void submit(inputRef.current.value);
    }, IDLE_SUBMIT_MS);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && <p className="mb-1 text-sm font-medium text-slate-700">{label}</p>}
      <div
        className={cn(
          "relative flex items-center rounded-xl border-2 bg-white transition-colors",
          focused ? "border-blue-500 ring-4 ring-blue-500/10" : "border-slate-300",
          disabled && "opacity-60",
        )}
      >
        <span className={cn("pl-3", focused ? "text-blue-600" : "text-slate-400")}>
          {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanBarcode className="h-5 w-5" />}
        </span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          aria-label={label ?? "Ô quét mã vạch"}
          className={cn(
            "w-full bg-transparent px-3 font-mono tracking-wide text-slate-900 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none",
            size === "lg" ? "h-12 text-base" : "h-10 text-sm",
          )}
        />
        <span
          className={cn(
            "mr-3 hidden items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex",
            focused ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", focused ? "bg-emerald-500" : "bg-slate-400")} />
          {processing ? "Đang xử lý" : focused ? "Sẵn sàng quét" : "Bấm để quét"}
        </span>
      </div>
    </div>
  );
});
