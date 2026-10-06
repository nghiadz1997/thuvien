"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/** Vẽ mã vạch Code 128 dạng SVG (in sắc nét) */
export function BarcodeSvg({
  value,
  height = 50,
  width = 1.6,
  fontSize = 12,
  displayValue = true,
  className,
}: {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height,
        width,
        fontSize,
        displayValue,
        margin: 4,
        textMargin: 2,
        font: "monospace",
      });
    } catch {
      // giá trị không hợp lệ với Code 128
    }
  }, [value, height, width, fontSize, displayValue]);
  return <svg ref={ref} className={className} />;
}
