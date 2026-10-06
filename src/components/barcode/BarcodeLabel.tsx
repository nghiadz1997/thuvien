"use client";

import { BarcodeSvg } from "./BarcodeSvg";
import { QRCodeSvg } from "./QRCodeSvg";

export type LabelType = "barcode" | "qrcode" | "combo";

/**
 * Tem mã sách chuẩn hóa theo đúng mẫu in:
 * - Dòng 1: TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN
 * - Dòng 2: TÊN SÁCH (IN HOA ĐẬM)
 * - Dòng 3: Mã: NSG-BK-xxxx-xxxxxx
 * - Dòng 4: Barcode / QR Code
 * - Dòng 5: Mã text NSG-BK-xxxx-xxxxxx
 */
export function BarcodeLabel({
  schoolName = "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
  title,
  bookCode,
  barcode,
  type = "barcode",
}: {
  schoolName?: string;
  title: string;
  bookCode: string;
  barcode: string;
  type?: LabelType;
}) {
  const displayCode = bookCode || barcode;

  return (
    <div className="barcode-label w-[230px] h-[142px] max-w-[230px] max-h-[142px] flex flex-col items-center justify-between overflow-hidden rounded-xl border border-blue-200/90 bg-white p-2.5 text-center text-slate-900 shadow-sm print:shadow-none print:border-slate-400">
      {/* Dòng 1: Tên Trường */}
      <p className="w-full truncate text-[8.5px] font-bold uppercase tracking-tight text-slate-800 leading-tight">
        {schoolName}
      </p>

      {/* Dòng 2: Tên Sách In Hoa */}
      <p className="line-clamp-1 w-full text-[11px] font-extrabold uppercase tracking-tight text-slate-950 leading-tight mt-0.5">
        {title}
      </p>

      {/* Dòng 3: Mã sách */}
      <p className="text-[8.5px] text-slate-600 leading-tight font-medium">
        Mã: {displayCode}
      </p>

      {/* Dòng 4: Mã Barcode hoặc QR Code */}
      <div className="w-full flex items-center justify-center my-0.5">
        {type === "qrcode" ? (
          <QRCodeSvg value={barcode || displayCode} size={50} />
        ) : type === "combo" ? (
          <div className="flex items-center justify-center gap-2 w-full px-1">
            <QRCodeSvg value={barcode || displayCode} size={38} />
            <div className="flex-1 flex flex-col items-center overflow-hidden">
              <BarcodeSvg
                value={barcode || displayCode}
                height={26}
                width={1.05}
                fontSize={8}
                displayValue={false}
                className="h-[28px] max-w-full"
              />
            </div>
          </div>
        ) : (
          <BarcodeSvg
            value={barcode || displayCode}
            height={36}
            width={1.25}
            fontSize={9}
            displayValue={false}
            className="h-[36px] max-w-full"
          />
        )}
      </div>

      {/* Dòng 5: Mã text dưới mã vạch */}
      <p className="font-mono text-[9.5px] font-bold tracking-widest text-slate-950 leading-tight">
        {barcode || displayCode}
      </p>
    </div>
  );
}
