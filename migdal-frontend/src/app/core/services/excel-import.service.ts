import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface ExcelImportResult<T> {
    valid: T[];
    invalid: { row: number; data: Record<string, unknown>; errors: string[] }[];
}

/** Column name aliases (case-insensitive) mapped to InlineVisitor field names. */
const COLUMN_MAP: Record<string, string> = {
    'firstname': 'firstName',
    'first name': 'firstName',
    'first_name': 'firstName',
    'שם פרטי': 'firstName',

    'lastname': 'lastName',
    'last name': 'lastName',
    'last_name': 'lastName',
    'שם משפחה': 'lastName',

    'email': 'email',
    'אימייל': 'email',
    'דוא"ל': 'email',

    'phone': 'phone',
    'telephone': 'phone',
    'טלפון': 'phone',

    'personid': 'personId',
    'person id': 'personId',
    'person_id': 'personId',
    'id number': 'personId',
    'id': 'personId',
    'מספר זהות': 'personId',
    'ת.ז': 'personId',
    'ת.ז.': 'personId',
    'תעודת זהות': 'personId',

    'carnumber': 'carNumber',
    'car number': 'carNumber',
    'car_number': 'carNumber',
    'license plate': 'carNumber',
    'מספר רכב': 'carNumber',

    'vehicletype': 'vehicleType',
    'vehicle type': 'vehicleType',
    'vehicle_type': 'vehicleType',
    'car type': 'vehicleType',
    'סוג רכב': 'vehicleType',
};

@Injectable({ providedIn: 'root' })
export class ExcelImportService {

    /** Read an Excel file and return parsed rows as key/value objects. */
    parseFile(file: File): Promise<Record<string, unknown>[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target!.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    if (!sheetName) {
                        resolve([]);
                        return;
                    }
                    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: '' });
                    resolve(rows);
                } catch {
                    reject(new Error('VISITS.IMPORT_INVALID_FILE'));
                }
            };
            reader.onerror = () => reject(new Error('VISITS.IMPORT_INVALID_FILE'));
            reader.readAsArrayBuffer(file);
        });
    }

    /** Map raw Excel row objects to visitor-shaped objects using COLUMN_MAP. */
    mapRows(rows: Record<string, unknown>[]): Record<string, string>[] {
        return rows.map(row => {
            const mapped: Record<string, string> = {};
            for (const [rawKey, value] of Object.entries(row)) {
                const normalised = rawKey.trim().toLowerCase();
                const field = COLUMN_MAP[normalised];
                if (field) {
                    mapped[field] = String(value ?? '').trim();
                }
            }
            return mapped;
        });
    }

    /** Validate mapped rows. Returns valid InlineVisitor-shaped objects and invalid rows. */
    validateVisitorRows(mapped: Record<string, string>[]): ExcelImportResult<Record<string, string>> {
        const valid: Record<string, string>[] = [];
        const invalid: ExcelImportResult<Record<string, string>>['invalid'] = [];

        mapped.forEach((row, index) => {
            const errors: string[] = [];
            if (!row['firstName']) errors.push('firstName');
            if (!row['lastName']) errors.push('lastName');
            if (!row['personId']) errors.push('personId');

            if (row['email'] && !this.isValidEmail(row['email'])) {
                errors.push('email (invalid)');
            }

            if (errors.length > 0) {
                invalid.push({ row: index + 2, data: row, errors }); // row+2 because Excel row 1 is header
            } else {
                valid.push(row);
            }
        });

        return { valid, invalid };
    }

    private isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
}
