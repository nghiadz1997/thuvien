"use client";

import JsBarcode from "jsbarcode";

export interface PrintLabelData {
  schoolName: string;
  title: string;
  bookCode: string;
  barcode: string;
  copies?: number;
}

/**
 * In riêng tem mã vạch qua iframe cách ly 100% — KHÔNG in giao diện web xung quanh
 */
export function printIsolatedBarcodeLabels({
  schoolName = "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
  title,
  bookCode,
  barcode,
  copies = 1,
}: PrintLabelData) {
  const displayCode = bookCode || barcode;

  // Tạo một canvas tạm thời để sinh ảnh Barcode Code 128
  const canvas = document.createElement("canvas");
  try {
    JsBarcode(canvas, barcode || displayCode, {
      format: "CODE128",
      height: 48,
      width: 1.8,
      fontSize: 12,
      displayValue: false,
      margin: 2,
    });
  } catch (e) {
    console.error("Barcode generation error:", e);
  }
  const barcodeDataUrl = canvas.toDataURL("image/png");

  // Tạo iframe ẩn để in
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const labelsHtml = Array.from({ length: copies })
    .map(
      () => `
      <div class="label-card">
        <div class="school-name">${schoolName}</div>
        <div class="book-title">${title}</div>
        <div class="book-code">Mã: ${displayCode}</div>
        <div class="barcode-wrapper">
          <img class="barcode-img" src="${barcodeDataUrl}" alt="${displayCode}" />
        </div>
        <div class="barcode-text">${barcode || displayCode}</div>
      </div>
    `,
    )
    .join("");

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>In Tem Mã Vạch - ${displayCode}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: auto;
            margin: 4mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #fff;
            color: #000;
            display: flex;
            flex-wrap: wrap;
            gap: 6mm;
            padding: 4mm;
            justify-content: flex-start;
          }
          .label-card {
            width: 58mm;
            height: 36mm;
            border: 1px solid #94a3b8;
            border-radius: 4mm;
            padding: 2.5mm 3mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            text-align: center;
            background: #ffffff;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .school-name {
            font-size: 7pt;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: -0.2px;
            color: #1e293b;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.1;
          }
          .book-title {
            font-size: 8.5pt;
            font-weight: 900;
            text-transform: uppercase;
            color: #0f172a;
            width: 100%;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.15;
            margin: 1mm 0 0.5mm 0;
          }
          .book-code {
            font-size: 6.5pt;
            color: #475569;
            font-weight: 500;
            line-height: 1;
          }
          .barcode-wrapper {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0.5mm 0;
          }
          .barcode-img {
            max-width: 95%;
            height: 11mm;
            object-fit: contain;
          }
          .barcode-text {
            font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
            font-size: 7.5pt;
            font-weight: 700;
            letter-spacing: 1px;
            color: #0f172a;
            line-height: 1;
          }
        </style>
      </head>
      <body>
        ${labelsHtml}
      </body>
    </html>
  `);
  doc.close();

  // Đợi hình ảnh tải xong rồi kích hoạt in
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1500);
  }, 300);
}

/**
 * Tải ảnh tem dạng PNG chất lượng cao (300 DPI) để lưu vào máy
 */
export function downloadLabelImage({
  schoolName = "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
  title,
  bookCode,
  barcode,
}: PrintLabelData) {
  const displayCode = bookCode || barcode;

  // Render ra Canvas độ phân giải cao
  const width = 480;
  const height = 300;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Nền trắng + bo góc + viền
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const radius = 20;
  ctx.roundRect(4, 4, width - 8, height - 8, radius);
  ctx.stroke();

  // Dòng 1: Tên Trường
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(schoolName.toUpperCase(), width / 2, 38);

  // Dòng 2: Tên Sách
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  let displayTitle = title.toUpperCase();
  if (displayTitle.length > 36) displayTitle = displayTitle.slice(0, 34) + "...";
  ctx.fillText(displayTitle, width / 2, 68);

  // Dòng 3: Mã sách
  ctx.fillStyle = "#64748b";
  ctx.font = "500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`Mã: ${displayCode}`, width / 2, 92);

  // Dòng 4: Vẽ Barcode lên canvas
  const barcodeCanvas = document.createElement("canvas");
  try {
    JsBarcode(barcodeCanvas, barcode || displayCode, {
      format: "CODE128",
      height: 90,
      width: 2.5,
      fontSize: 14,
      displayValue: false,
      margin: 0,
    });
    ctx.drawImage(barcodeCanvas, (width - barcodeCanvas.width) / 2, 110);
  } catch (err) {
    console.error("Barcode drawing error:", err);
  }

  // Dòng 5: Mã text
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 17px ui-monospace, 'Cascadia Mono', Consolas, monospace";
  ctx.fillText(barcode || displayCode, width / 2, 260);

  // Tạo link tải file
  const link = document.createElement("a");
  link.download = `Tem_Barcode_${displayCode}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
