"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export interface QRCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
  darkColor?: string;
  lightColor?: string;
}

/** Vẽ mã QR dạng SVG / Canvas sắc nét */
export function QRCodeSvg({
  value,
  size = 128,
  className,
  darkColor = "#0f172a",
  lightColor = "#ffffff",
}: QRCodeSvgProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      errorCorrectionLevel: "M",
    }).catch((err) => {
      console.warn("QR generation error:", err);
    });
  }, [value, size, darkColor, lightColor]);

  if (!value) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
