import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export async function toExcelBuffer(rows: Array<Record<string, unknown>>, sheetName = 'Data'): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    if (rows.length === 0) {
        return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    const columns = Object.keys(rows[0]);
    sheet.columns = columns.map((key) => ({ header: key, key, width: 12 }));

    for (const row of rows) {
        const added = sheet.addRow(row);
        added.eachCell((cell) => {
            if (cell.value instanceof Date) {
                cell.numFmt = 'DD/MM/YYYY HH:mm';
            }
        });
    }

    // Auto-fit column widths
    for (const col of sheet.columns) {
        let maxLen = String(col.header ?? '').length;
        col.eachCell!({ includeEmpty: false }, (cell, rowNum) => {
            if (rowNum === 1) return;
            const val = cell.value;
            const len = val instanceof Date ? 18 : String(val ?? '').length;
            if (len > maxLen) maxLen = len;
        });
        col.width = Math.min(maxLen + 3, 50);
    }

    // Header row
    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5496' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FF1F3864' } },
            top: { style: 'thin', color: { argb: 'FF1F3864' } },
            left: { style: 'thin', color: { argb: 'FF3A6BC5' } },
            right: { style: 'thin', color: { argb: 'FF3A6BC5' } },
        };
    });

    // Data rows
    const border: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
    };
    for (let i = 2; i <= sheet.rowCount; i++) {
        const row = sheet.getRow(i);
        row.alignment = { vertical: 'middle', wrapText: true };
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = border;
            if (i % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } };
            }
        });
    }

    // Freeze header + auto-filter
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

    return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function sendExcelResponse(res: Response, buffer: Buffer, filename: string): void {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
}
