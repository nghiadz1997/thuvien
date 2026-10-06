"use client";

import { BarcodeSvg } from "./BarcodeSvg";

/**
 * Tem mã vạch: Tên trường / Tên sách / Mã sách / Barcode Code 128 / mã dạng text
 * Kích thước tem ~ 60mm x 35mm
 */
export function BarcodeLabel({
  schoolName,
  title,
  bookCode,
  barcode,
}: {
  schoolName: string;
  title: string;
  bookCode: string;
  barcode: string;
}) {
  return (
    <div className="barcode-label flex flex-col items-center justify-between overflow-hidden rounded border border-slate-300 bg-white px-2 py-1.5 text-center text-black">
      <p className="w-full truncate text-[8px] font-bold uppercase leading-tight">{schoolName}</p>
      <p className="line-clamp-1 w-full text-[10px] font-semibold leading-tight">{title}</p>
      <p className="text-[8px] leading-tight">Mã sách: {bookCode}</p>
      <BarcodeSvg value={barcode} height={34} width={1.15} fontSize={10} displayValue={false} className="h-[38px] max-w-full" />
      <p className="font-mono text-[9px] font-semibold leading-tight tracking-wider">{barcode}</p>
    </div>
  );
}
