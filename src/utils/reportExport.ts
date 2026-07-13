import logoPdf from "@/assets/image/logo-icone-salaone.jpeg";

export interface ReportColumn<TRow> {
  header: string;
  getValue: (row: TRow) => string | number | null | undefined;
  align?: "left" | "right" | "center";
}

function escapeCsv(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizePdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value: unknown) {
  return sanitizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

async function loadLogoForPdf() {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = logoPdf;
  await image.decode();

  const canvas = document.createElement("canvas");
  const maxWidth = 180;
  const ratio = image.naturalWidth > 0 ? maxWidth / image.naturalWidth : 1;
  canvas.width = maxWidth;
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixelCount = canvas.width * canvas.height;
  const rgbBytes = new Uint8Array(pixelCount * 3);
  const alphaBytes = new Uint8Array(pixelCount);
  let hasAlpha = false;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const sourceIndex = pixelIndex * 4;
    const targetIndex = pixelIndex * 3;
    rgbBytes[targetIndex] = imageData.data[sourceIndex];
    rgbBytes[targetIndex + 1] = imageData.data[sourceIndex + 1];
    rgbBytes[targetIndex + 2] = imageData.data[sourceIndex + 2];
    alphaBytes[pixelIndex] = imageData.data[sourceIndex + 3];
    if (alphaBytes[pixelIndex] < 255) hasAlpha = true;
  }

  return {
    rgbBytes,
    alphaBytes,
    hasAlpha,
    width: canvas.width,
    height: canvas.height,
  };
}

export function downloadCsvReport<TRow>(
  filename: string,
  columns: ReportColumn<TRow>[],
  rows: TRow[],
) {
  const header = columns.map((column) => column.header);
  const csvRows = rows.map((row) => columns.map((column) => column.getValue(row)));
  const csv = [header, ...csvRows]
    .map((line) => line.map(escapeCsv).join(";"))
    .join("\n");

  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

async function createPdfReportBlob<TRow>(params: {
  title: string;
  subtitle?: string;
  columns: ReportColumn<TRow>[];
  rows: TRow[];
  summary?: Array<[string, string | number]>;
}) {
  const encoder = new TextEncoder();
  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 32;
  const topY = 535;
  const bottomY = 48;
  const contentWidth = pageWidth - marginX * 2;
  const pages: string[] = [];
  let content = "";
  let y = topY;
  let tableHeaderColumns: Array<ReportColumn<TRow> & { width: number }> | null = null;
  const logo = await loadLogoForPdf().catch(() => null);

  function pushPage() {
    if (content) pages.push(content);
    content = "";
    y = topY;
  }

  function ensureSpace(height: number) {
    if (y - height < bottomY) pushPage();
  }

  function setFill(gray: number) {
    content += `${gray} g\n`;
  }

  function setStroke(gray: number) {
    content += `${gray} G\n`;
  }

  function lineWidth(width: number) {
    content += `${width} w\n`;
  }

  function rect(x: number, yy: number, width: number, height: number, fill = false) {
    content += `${x} ${yy} ${width} ${height} re ${fill ? "f" : "S"}\n`;
  }

  function approximateTextWidth(value: unknown, size: number) {
    return sanitizePdfText(value).length * size * 0.46;
  }

  function textAt(value: unknown, x: number, yy: number, size = 9, bold = false) {
    const font = bold ? "F2" : "F1";
    content += `BT /${font} ${size} Tf 1 0 0 1 ${x} ${yy} Tm (${escapePdfText(value)}) Tj ET\n`;
  }

  function textAtCentered(value: unknown, centerX: number, yy: number, size = 9, bold = false) {
    textAt(value, centerX - approximateTextWidth(value, size) / 2, yy, size, bold);
  }

  function text(value: unknown, x: number, size = 9, bold = false) {
    textAt(value, x, y, size, bold);
  }

  function wrapTextByWidth(value: unknown, width: number, size: number) {
    const maxChars = Math.max(8, Math.floor(width / (size * 0.48)));
    const words = sanitizePdfText(value).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";

    words.forEach((word) => {
      if (word.length > maxChars) {
        if (current) {
          lines.push(current);
          current = "";
        }
        for (let index = 0; index < word.length; index += maxChars) {
          lines.push(word.slice(index, index + maxChars));
        }
        return;
      }

      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxChars) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    });

    if (current) lines.push(current);
    return lines.length ? lines : [""];
  }

  function clampLines(lines: string[], maxLines: number) {
    if (lines.length <= maxLines) return lines;
    const next = lines.slice(0, maxLines);
    const last = next[next.length - 1] ?? "";
    next[next.length - 1] = last.length > 3 ? `${last.slice(0, -3)}...` : last;
    return next;
  }

  function drawHeader() {
    const bandHeight = 74;
    setFill(1);
    rect(0, pageHeight - bandHeight, pageWidth, bandHeight, true);
    setStroke(0.86);
    lineWidth(0.6);
    content += `${marginX} ${pageHeight - bandHeight} m ${pageWidth - marginX} ${pageHeight - bandHeight} l S\n`;
    setFill(0);
    if (logo) {
      const logoWidth = 92;
      const logoHeight = Math.round((logo.height / logo.width) * logoWidth);
      const logoY = pageHeight - bandHeight + Math.round((bandHeight - logoHeight) / 2);
      content += `q ${logoWidth} 0 0 ${logoHeight} ${marginX} ${logoY} cm /Im1 Do Q\n`;
    } else {
      textAt("SALAONE", marginX, pageHeight - 31, 16, true);
      textAt("Sistema de gestao financeira", marginX, pageHeight - 48, 8);
    }
    textAt(params.title, marginX + 185, pageHeight - 29, 18, true);
    if (params.subtitle) {
      textAt(params.subtitle, marginX + 185, pageHeight - 47, 9);
    }
    setFill(0.35);
    textAt(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pageWidth - 210, pageHeight - 48, 9);

    setFill(0);
    y = pageHeight - bandHeight - 24;
  }

  function drawSummary() {
    if (!params.summary?.length) return;

    const boxGap = 10;
    const boxWidth = (contentWidth - boxGap * 3) / 4;
    const boxHeight = 48;

    params.summary.slice(0, 4).forEach(([label, value], index) => {
      if (index > 0 && index % 4 === 0) y -= boxHeight + 8;
      ensureSpace(boxHeight + 8);
      const x = marginX + (index % 4) * (boxWidth + boxGap);
      const yy = y - boxHeight;
      setFill(0.96);
      rect(x, yy, boxWidth, boxHeight, true);
      setStroke(0.76);
      lineWidth(0.8);
      rect(x, yy, boxWidth, boxHeight);
      setFill(0);
      textAt(label, x + 12, yy + 31, 8);
      textAt(value, x + 12, yy + 12, 16, true);
    });

    y -= boxHeight + 18;
  }

  type PdfColumn<TRow> = ReportColumn<TRow> & { width: number };

  function tableColumns(): PdfColumn<TRow>[] {
    const sampleRows = params.rows.slice(0, 40);
    const rawWeights = params.columns.map((column) => {
      const values = sampleRows.map((row) => sanitizePdfText(column.getValue(row)).length);
      const maxValue = Math.max(sanitizePdfText(column.header).length, ...values, 8);
      if (column.align === "right" || column.align === "center") return Math.min(Math.max(maxValue * 4.2, 58), 82);
      return Math.min(Math.max(maxValue * 4.6, 70), 150);
    });
    const totalRaw = rawWeights.reduce((sum, value) => sum + value, 0);
    const scale = contentWidth / totalRaw;

    return params.columns.map((column, index) => ({
      ...column,
      width: Math.max(column.align === "left" || !column.align ? 64 : 54, rawWeights[index] * scale),
    }));
  }

  function drawTableHeader(columns: PdfColumn<TRow>[]) {
    tableHeaderColumns = columns;
    const headerHeight = 24;
    setFill(0.22);
    rect(marginX, y - headerHeight, contentWidth, headerHeight, true);
    setStroke(0.22);
    lineWidth(0.5);
    rect(marginX, y - headerHeight, contentWidth, headerHeight);
    setFill(1);

    let x = marginX;
    columns.forEach((column) => {
      const headerY = y - 15;
      if (column.align === "center" || column.align === "right") {
        textAtCentered(column.header, x + column.width / 2, headerY, 7, true);
      } else {
        textAt(column.header, x + 7, headerY, 7, true);
      }
      x += column.width;
    });
    setFill(0);
    y -= headerHeight;
  }

  function drawTable() {
    const columns = tableColumns();
    drawTableHeader(columns);

    if (params.rows.length === 0) {
      ensureSpace(24);
      text("Nenhum registro encontrado.", marginX + 4, 9);
      y -= 18;
      return;
    }

    params.rows.forEach((row, rowIndex) => {
      const cellLines = columns.map((column) =>
        clampLines(wrapTextByWidth(column.getValue(row), column.width - 12, 7), 2),
      );
      const rowHeight = Math.max(25, Math.max(...cellLines.map((lines) => lines.length)) * 9 + 10);

      if (y - rowHeight < bottomY) {
        pushPage();
        if (tableHeaderColumns) drawTableHeader(tableHeaderColumns);
      }

      if (rowIndex % 2 === 1) {
        setFill(0.975);
        rect(marginX, y - rowHeight, contentWidth, rowHeight, true);
      }
      setFill(0);
      setStroke(0.86);
      lineWidth(0.35);
      rect(marginX, y - rowHeight, contentWidth, rowHeight);

      let x = marginX;
      columns.forEach((column, columnIndex) => {
        const lines = cellLines[columnIndex];
        if (columnIndex > 0) {
          content += `0.2 w ${x} ${y} m ${x} ${y - rowHeight} l S\n`;
        }

        lines.forEach((line, lineIndex) => {
          const textY = y - 15 - lineIndex * 9;
          if (column.align === "center" || column.align === "right") {
            textAt(line, x + (column.width - approximateTextWidth(line, 7)) / 2, textY, 7);
          } else {
            textAt(line, x + 7, textY, 7);
          }
        });

        x += column.width;
      });

      y -= rowHeight;
    });
  }

  drawHeader();
  drawSummary();
  drawTable();

  if (content) pages.push(content);
  if (pages.length === 0) pages.push("");

  const objects: Array<Array<string | Uint8Array> | undefined> = [];
  const pageObjectIds = pages.map((_, index) => 5 + index * 2);
  const imageObjectId = 5 + pages.length * 2;
  const alphaObjectId = imageObjectId + 1;
  objects[1] = ["<< /Type /Catalog /Pages 2 0 R >>"];
  objects[2] = [`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`];
  objects[3] = ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  objects[4] = ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"];

  function footer(pageIndex: number, totalPages: number) {
    let footerContent = "";
    footerContent += "0.42 g\n";
    footerContent += `BT /F1 8 Tf 1 0 0 1 ${marginX} 26 Tm (Gerado automaticamente pelo sistema SalaOne) Tj ET\n`;
    footerContent += `BT /F1 8 Tf 1 0 0 1 ${marginX} 14 Tm (${escapePdfText(new Date().toLocaleString("pt-BR"))}) Tj ET\n`;
    const pageLabel = `Pagina ${pageIndex} de ${totalPages}`;
    footerContent += `BT /F2 8 Tf 1 0 0 1 ${pageWidth - marginX - approximateTextWidth(pageLabel, 8)} 20 Tm (${escapePdfText(pageLabel)}) Tj ET\n`;
    footerContent += "0.82 G\n";
    footerContent += `0.4 w ${marginX} 38 m ${pageWidth - marginX} 38 l S\n`;
    return footerContent;
  }

  pages.forEach((pageContent, index) => {
    const pageId = 5 + index * 2;
    const contentId = pageId + 1;
    const finalPageContent = `${pageContent}${footer(index + 1, pages.length)}`;
    const length = encoder.encode(finalPageContent).length;
    objects[pageId] = [[
      "<< /Type /Page",
      "/Parent 2 0 R",
      `/MediaBox [0 0 ${pageWidth} ${pageHeight}]`,
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${logo ? `/XObject << /Im1 ${imageObjectId} 0 R >>` : ""} >>`,
      `/Contents ${contentId} 0 R`,
      ">>",
    ].join(" ")];
    objects[contentId] = [`<< /Length ${length} >>\nstream\n${finalPageContent}endstream`];
  });

  if (logo) {
    objects[imageObjectId] = [
      [
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height}`,
        "/ColorSpace /DeviceRGB /BitsPerComponent 8",
        logo.hasAlpha ? `/SMask ${alphaObjectId} 0 R` : "",
        `/Length ${logo.rgbBytes.byteLength} >>\nstream\n`,
      ].filter(Boolean).join(" "),
      logo.rgbBytes,
      "\nendstream",
    ];

    if (logo.hasAlpha) {
      objects[alphaObjectId] = [
        `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${logo.alphaBytes.byteLength} >>\nstream\n`,
        logo.alphaBytes,
        "\nendstream",
      ];
    }
  }

  const offsets: number[] = [];
  const parts: BlobPart[] = ["%PDF-1.4\n"];
  let byteLength = encoder.encode(parts[0] as string).length;

  function partLength(part: string | Uint8Array) {
    return typeof part === "string" ? encoder.encode(part).length : part.byteLength;
  }

  function pushPart(part: string | Uint8Array) {
    parts.push(
      typeof part === "string"
        ? part
        : part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer,
    );
    byteLength += partLength(part);
  }

  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) continue;
    offsets[id] = byteLength;
    pushPart(`${id} 0 obj\n`);
    objects[id]!.forEach(pushPart);
    pushPart("\nendobj\n");
  }

  const xrefOffset = byteLength;
  pushPart(`xref\n0 ${objects.length}\n`);
  pushPart("0000000000 65535 f \n");

  for (let id = 1; id < objects.length; id += 1) {
    pushPart(`${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`);
  }

  pushPart(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(parts, { type: "application/pdf" });
}

export function downloadPdfReport<TRow>(
  filename: string,
  params: {
    title: string;
    subtitle?: string;
    columns: ReportColumn<TRow>[];
    rows: TRow[];
    summary?: Array<[string, string | number]>;
  },
) {
  return createPdfReportBlob(params).then((blob) => downloadBlob(blob, filename));
}
