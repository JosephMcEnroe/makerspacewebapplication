import { zip } from "fflate";
import { renderFinancialReportPdf } from "./financialReportPdf";
import { renderFinancialReportCsv, renderFinancialReportXlsx } from "./financialReportSpreadsheet";

const exporters = {
  pdf: { type: "application/pdf", render: renderFinancialReportPdf },
  csv: { type: "text/csv; charset=utf-8", render: renderFinancialReportCsv },
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", render: renderFinancialReportXlsx },
};

export function parseReportFormats(value = "pdf") {
  if (typeof value !== "string") throw new Error("Choose one or more of: pdf, csv, xlsx.");
  const formats = [...new Set(value.split(","))];
  if (formats.some(format => !Object.hasOwn(exporters, format))) throw new Error("Choose one or more of: pdf, csv, xlsx.");
  return formats;
}

export async function exportFinancialReport(report, formats) {
  const base = `financial-report_${report.period.start}_${report.period.end}`;
  const files = await Promise.all(formats.map(async format => ({
    filename: `${base}.${format}`, type: exporters[format].type,
    data: await exporters[format].render(report),
  })));
  if (files.length === 1) return files[0];
  const data = await new Promise((resolve, reject) => {
    zip(Object.fromEntries(files.map(file => [file.filename, file.data])), { level: 0 }, (error, bytes) => {
      if (error) reject(error); else resolve(Buffer.from(bytes));
    });
  });
  return { filename: `${base}.zip`, type: "application/zip", data };
}
