"use client";

import { BarcodeSvg } from "./BarcodeSvg";
import { QRCodeSvg } from "./QRCodeSvg";

export type LabelType = "barcode" | "qrcode" | "combo";

/**
 * Tem mã sách: Tên trường / Tên sách / Mã sách / Barcode hoặc Mã QR
 * Hỗ trợ in Barcode 1D, QR Code 2D (cho điện thoại), hoặc Combo cả 2.
 */
export function BarcodeLabel({
  schoolName,
  title,
  bookCode,
  barcode,
  type = "barcode",
}: {
  schoolName: string;
  title: string;
  bookCode: string;
  barcode: string;
  type?: LabelType;
}) {
  return (
    <div className="barcode-label flex flex-col items-center justify-between overflow-hidden rounded border border-slate-300 bg-white px-2 py-1.5 text-center text-black">
      <p className="w-full truncate text-[8px] font-bold uppercase leading-tight">{schoolName}</p>
      <p className="line-clamp-1 w-full text-[10px] font-semibold leading-tight">{title}</p>
      <p className="text-[8px] leading-tight">Mã: {bookCode}</p>

      {type === "qrcode" ? (
        <div className="my-1 flex items-center justify-center">
          <QRCodeSvg value={barcode} size={54} />
        </div>
      ) : type === "combo" ? (
        <div className="my-1 flex items-center justify-center gap-2 w-full">
          <QRCodeSvg value={barcode} size={42} />
          <div className="flex-1 flex flex-col items-center">
            <BarcodeSvg value={barcode} height={26} width={1.0} fontSize={8} displayValue={false} className="h-[28px] max-w-full" />
            <p className="font-mono text-[8px] font-semibold tracking-tight">{barcode}</p>
          </div>
        </div>
      ) : (
        <BarcodeSvg value={barcode} height={34} width={1.15} fontSize={10} displayValue={false} className="h-[38px] max-w-full" />
      )}

      {type !== "combo" && (
        <p className="font-mono text-[9px] font-semibold leading-tight tracking-wider">{barcode}</p>
      )}
    </div>
  );
}
