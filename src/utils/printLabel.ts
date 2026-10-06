"use client";

import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export type LabelType = "barcode" | "qrcode" | "combo";

export interface PrintLabelData {
  schoolName?: string;
  title: string;
  bookCode: string;
  barcode: string;
  copies?: number;
  type?: LabelType;
}

/**
 * In riêng tem (Barcode / QR Code / Combo) qua iframe cách ly 100% — KHÔNG in giao diện web xung quanh
 */
export async function printIsolatedBarcodeLabels({
  schoolName = "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
  title,
  bookCode,
  barcode,
  copies = 1,
  type = "barcode",
}: PrintLabelData) {
  const displayCode = bookCode || barcode;

  let barcodeDataUrl = "";
  let qrDataUrl = "";

  // Sinh ảnh Barcode 1D nếu cần
  if (type === "barcode" || type === "combo") {
    try {
      const barcodeCanvas = document.createElement("canvas");
      JsBarcode(barcodeCanvas, barcode || displayCode, {
        format: "CODE128",
        height: type === "combo" ? 42 : 48,
        width: type === "combo" ? 1.5 : 1.8,
        fontSize: 12,
        displayValue: false,
        margin: 2,
      });
      barcodeDataUrl = barcodeCanvas.toDataURL("image/png");
    } catch (e) {
      console.error("Barcode generation error:", e);
    }
  }

  // Sinh ảnh QR Code 2D nếu cần
  if (type === "qrcode" || type === "combo") {
    try {
      qrDataUrl = await QRCode.toDataURL(barcode || displayCode, {
        width: type === "combo" ? 120 : 160,
        margin: 1,
        errorCorrectionLevel: "M",
      });
    } catch (e) {
      console.error("QR Code generation error:", e);
    }
  }

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

  // Render HTML của phần thân tem theo loại
  const renderBody = () => {
    if (type === "qrcode") {
      return `
        <div class="code-container qr-center">
          <img class="qr-img" src="${qrDataUrl}" alt="${displayCode}" />
        </div>
      `;
    }
    if (type === "combo") {
      return `
        <div class="code-container combo-box">
          <img class="qr-img-combo" src="${qrDataUrl}" alt="${displayCode}" />
          <img class="barcode-img-combo" src="${barcodeDataUrl}" alt="${displayCode}" />
        </div>
      `;
    }
    return `
      <div class="code-container barcode-center">
        <img class="barcode-img" src="${barcodeDataUrl}" alt="${displayCode}" />
      </div>
    `;
  };

  const labelsHtml = Array.from({ length: copies })
    .map(
      () => `
      <div class="label-card">
        <div class="school-name">${schoolName}</div>
        <div class="book-title">${title}</div>
        <div class="book-code">Mã: ${displayCode}</div>
        ${renderBody()}
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
        <title>In Tem - ${displayCode}</title>
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
            margin: 0.5mm 0;
          }
          .book-code {
            font-size: 6.5pt;
            color: #475569;
            font-weight: 500;
            line-height: 1;
          }
          .code-container {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0.5mm 0;
          }
          .qr-center .qr-img {
            height: 13mm;
            width: 13mm;
            object-fit: contain;
          }
          .barcode-center .barcode-img {
            max-width: 95%;
            height: 11mm;
            object-fit: contain;
          }
          .combo-box {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 2mm;
            width: 100%;
          }
          .combo-box .qr-img-combo {
            height: 11mm;
            width: 11mm;
            object-fit: contain;
          }
          .combo-box .barcode-img-combo {
            height: 9mm;
            max-width: 38mm;
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
  }, 350);
}

/**
 * Tải ảnh tem (Barcode / QR Code / Combo) dạng PNG chất lượng cao (300 DPI) để lưu vào máy
 */
export async function downloadLabelImage({
  schoolName = "TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN",
  title,
  bookCode,
  barcode,
  type = "barcode",
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

  // Helper load image async
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  if (type === "qrcode") {
    // Vẽ chỉ mã QR
    try {
      const qrDataUrl = await QRCode.toDataURL(barcode || displayCode, {
        width: 140,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, (width - 130) / 2, 105, 130, 130);
    } catch (e) {
      console.error("QR drawing error:", e);
    }
  } else if (type === "combo") {
    // Vẽ Combo: QR bên trái, Barcode bên phải
    try {
      // QR Code
      const qrDataUrl = await QRCode.toDataURL(barcode || displayCode, {
        width: 120,
        margin: 1,
        errorCorrectionLevel: "M",
      });
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, 45, 110, 115, 115);

      // Barcode
      const barcodeCanvas = document.createElement("canvas");
      JsBarcode(barcodeCanvas, barcode || displayCode, {
        format: "CODE128",
        height: 75,
        width: 1.8,
        fontSize: 12,
        displayValue: false,
        margin: 0,
      });
      ctx.drawImage(barcodeCanvas, 175, 130, 260, 75);
    } catch (e) {
      console.error("Combo drawing error:", e);
    }
  } else {
    // Vẽ Barcode 1D tiêu chuẩn
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
  }

  // Dòng 5: Mã text
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 17px ui-monospace, 'Cascadia Mono', Consolas, monospace";
  ctx.textAlign = "center";
  ctx.fillText(barcode || displayCode, width / 2, 262);

  // Tạo link tải file
  const prefix = type === "qrcode" ? "Tem_QRCode" : type === "combo" ? "Tem_Combo" : "Tem_Barcode";
  const link = document.createElement("a");
  link.download = `${prefix}_${displayCode}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function downloadStandaloneQRCode({
  title,
  bookCode,
  barcode,
}: {
  title?: string;
  bookCode: string;
  barcode?: string;
}) {
  const displayCode = bookCode || barcode || "CODE";
  const targetText = barcode || bookCode || displayCode;
  const qrDataUrl: string = await new Promise((resolve, reject) => {
    QRCode.toDataURL(
      targetText,
      {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "H",
      },
      (err, url) => {
        if (err) reject(err);
        else resolve(url);
      },
    );
  });

  const link = document.createElement("a");
  link.download = `QRCode_${displayCode}.png`;
  link.href = qrDataUrl;
  link.click();
}
