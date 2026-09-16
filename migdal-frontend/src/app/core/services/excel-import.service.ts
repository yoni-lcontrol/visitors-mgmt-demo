import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface ExcelImportResult<T> {
    valid: T[];
    invalid: { row: number; data: Record<string, unknown>; errors: string[] }[];
}

export interface VisitDetailsImport {
    title: string;
    purposeOfVisit: string;
    siteName: string;
    buildingName: string;
    floor: number;
    plannedStart: Date;
    plannedEnd: Date;
    requesterIdentifier: string;
}

export interface ParsedVisitWorkbook {
    /** Raw mapped visit-details row, or null if no visit-details sheet was found in the file. */
    visitDetails: Record<string, unknown> | null;
    visitorRows: Record<string, unknown>[];
    escortRows: Record<string, unknown>[];
}

/** Column name aliases (case-insensitive) mapped to InlineVisitor field names. */
const VISITOR_COLUMN_MAP: Record<string, string> = {
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
    'mobile': 'phone',
    'mobile phone': 'phone',
    'cell': 'phone',
    'cellular': 'phone',
    'טלפון': 'phone',
    'נייד': 'phone',
    'פלאפון': 'phone',
    'טל': 'phone',

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

    'hasvehicle': 'hasVehicle',
    'has vehicle': 'hasVehicle',
    'has_vehicle': 'hasVehicle',
    'מגיע עם רכב': 'hasVehicle',
};

/** Column name aliases (case-insensitive) mapped to InlineEscort field names. */
const ESCORT_COLUMN_MAP: Record<string, string> = {
    'firstname': 'firstName',
    'first name': 'firstName',
    'first_name': 'firstName',
    'שם פרטי': 'firstName',

    'lastname': 'lastName',
    'last name': 'lastName',
    'last_name': 'lastName',
    'שם משפחה': 'lastName',

    'phone': 'phone',
    'telephone': 'phone',
    'mobile': 'phone',
    'mobile phone': 'phone',
    'טלפון': 'phone',
    'נייד': 'phone',
    'פלאפון': 'phone',

    'email': 'email',
    'אימייל': 'email',
    'דוא"ל': 'email',

    'sector': 'sector',
    'department': 'sector',
    'מחלקה': 'sector',
    'גורם': 'sector',
    'מחלקה/גורם': 'sector',
};

/** Column name aliases (case-insensitive) mapped to VisitDetailsImport field names. */
const VISIT_DETAILS_COLUMN_MAP: Record<string, string> = {
    'title': 'title',
    'visit title': 'title',
    'כותרת הביקור': 'title',

    'purposeofvisit': 'purposeOfVisit',
    'purpose of visit': 'purposeOfVisit',
    'מטרת הביקור': 'purposeOfVisit',

    'site': 'siteName',
    'site name': 'siteName',
    'שם אתר': 'siteName',

    'building': 'buildingName',
    'building name': 'buildingName',
    'שם מבנה': 'buildingName',

    'floor': 'floor',
    'קומה': 'floor',

    'start': 'plannedStart',
    'planned start': 'plannedStart',
    'start time': 'plannedStart',
    'תאריך ושעת התחלה מתוכננת': 'plannedStart',

    'end': 'plannedEnd',
    'planned end': 'plannedEnd',
    'end time': 'plannedEnd',
    'תאריך ושעת סיום מתוכננת': 'plannedEnd',

    'requester': 'requesterIdentifier',
    'visit requester': 'requesterIdentifier',
    'מבקש הביקור': 'requesterIdentifier',
    'ת.ז / אימייל של מבקש הביקור': 'requesterIdentifier',
};

const VISIT_SHEET_NAMES = ['פרטי ביקור', 'visit', 'visit details'];
const VISITOR_SHEET_NAMES = ['מבקרים', 'visitors'];
const ESCORT_SHEET_NAMES = ['מלווים', 'escorts'];

const TRUE_VALUES = new Set(['כן', 'yes', 'true', '1', 'y']);

@Injectable({ providedIn: 'root' })
export class ExcelImportService {

    /** Read an Excel file and return parsed rows (of its first sheet) as key/value objects. */
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

    /**
     * Read a workbook that may contain up to three sheets: visit details, visitors (with
     * vehicle info) and escorts, identified by name (Hebrew or English, case-insensitive).
     * A single unnamed sheet is treated as the visitors sheet for backward compatibility.
     */
    parseVisitWorkbook(file: File): Promise<ParsedVisitWorkbook> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target!.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

                    const findSheet = (aliases: string[]) =>
                        workbook.SheetNames.find(n => aliases.includes(n.trim().toLowerCase()));

                    const rowsOf = (name: string | undefined) =>
                        name ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: '' }) : [];

                    const visitSheetName = findSheet(VISIT_SHEET_NAMES);
                    const visitorSheetName = findSheet(VISITOR_SHEET_NAMES);
                    const escortSheetName = findSheet(ESCORT_SHEET_NAMES);

                    let visitRows = rowsOf(visitSheetName);
                    let visitorRows = rowsOf(visitorSheetName);
                    const escortRows = rowsOf(escortSheetName);

                    if (!visitSheetName && !visitorSheetName && !escortSheetName && workbook.SheetNames.length) {
                        visitorRows = rowsOf(workbook.SheetNames[0]);
                        visitRows = [];
                    }

                    resolve({
                        visitDetails: visitRows[0] ?? null,
                        visitorRows,
                        escortRows,
                    });
                } catch {
                    reject(new Error('VISITS.IMPORT_INVALID_FILE'));
                }
            };
            reader.onerror = () => reject(new Error('VISITS.IMPORT_INVALID_FILE'));
            reader.readAsArrayBuffer(file);
        });
    }

    /** Map raw Excel row objects to visitor-shaped objects using VISITOR_COLUMN_MAP. */
    mapRows(rows: Record<string, unknown>[]): Record<string, string>[] {
        return this.mapWithColumnMap(rows, VISITOR_COLUMN_MAP);
    }

    /** Map raw Excel row objects to escort-shaped objects using ESCORT_COLUMN_MAP. */
    mapEscortRows(rows: Record<string, unknown>[]): Record<string, string>[] {
        return this.mapWithColumnMap(rows, ESCORT_COLUMN_MAP);
    }

    /** Map a single raw visit-details row using VISIT_DETAILS_COLUMN_MAP, keeping raw cell values. */
    mapVisitDetailsRow(row: Record<string, unknown> | null): Record<string, unknown> {
        if (!row) return {};
        const mapped: Record<string, unknown> = {};
        for (const [rawKey, value] of Object.entries(row)) {
            const normalised = rawKey.trim().toLowerCase();
            const field = VISIT_DETAILS_COLUMN_MAP[normalised];
            if (field) {
                mapped[field] = value;
            }
        }
        return mapped;
    }

    private mapWithColumnMap(rows: Record<string, unknown>[], columnMap: Record<string, string>): Record<string, string>[] {
        return rows.map(row => {
            const mapped: Record<string, string> = {};
            for (const [rawKey, value] of Object.entries(row)) {
                const normalised = rawKey.trim().toLowerCase();
                const field = columnMap[normalised];
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

            const hasVehicle = row['hasVehicle'] !== undefined && row['hasVehicle'] !== ''
                ? this.parseBoolean(row['hasVehicle'])
                : !!row['carNumber'];
            if (hasVehicle && !row['carNumber']) errors.push('carNumber');
            if (hasVehicle && !row['vehicleType']) errors.push('vehicleType');

            if (errors.length > 0) {
                invalid.push({ row: index + 2, data: row, errors }); // row+2 because Excel row 1 is header
            } else {
                valid.push(row);
            }
        });

        return { valid, invalid };
    }

    /** Validate mapped escort rows. Returns valid InlineEscort-shaped objects and invalid rows. */
    validateEscortRows(mapped: Record<string, string>[]): ExcelImportResult<Record<string, string>> {
        const valid: Record<string, string>[] = [];
        const invalid: ExcelImportResult<Record<string, string>>['invalid'] = [];

        mapped.forEach((row, index) => {
            const errors: string[] = [];
            if (!row['firstName']) errors.push('firstName');
            if (!row['lastName']) errors.push('lastName');
            if (!row['phone']) errors.push('phone');
            if (!row['email']) errors.push('email');
            else if (!this.isValidEmail(row['email'])) errors.push('email (invalid)');

            if (errors.length > 0) {
                invalid.push({ row: index + 2, data: row, errors });
            } else {
                valid.push(row);
            }
        });

        return { valid, invalid };
    }

    /**
     * Validate a mapped visit-details row. Returns null data (with no errors) when no
     * visit-details sheet was present at all, since that sheet is optional.
     */
    validateVisitDetails(mapped: Record<string, unknown>): { valid: boolean; errors: string[]; data: VisitDetailsImport | null } {
        if (!Object.keys(mapped).length) {
            return { valid: true, errors: [], data: null };
        }

        const errors: string[] = [];
        const title = String(mapped['title'] ?? '').trim();
        const buildingName = String(mapped['buildingName'] ?? '').trim();
        const floorRaw = String(mapped['floor'] ?? '').trim();
        const floor = floorRaw ? Number(floorRaw) : NaN;
        const plannedStart = this.parseExcelDateTime(mapped['plannedStart']);
        const plannedEnd = this.parseExcelDateTime(mapped['plannedEnd']);
        const requesterIdentifier = String(mapped['requesterIdentifier'] ?? '').trim();

        if (!title) errors.push('title');
        if (!buildingName) errors.push('buildingName');
        if (!floorRaw || Number.isNaN(floor)) errors.push('floor');
        if (!plannedStart) errors.push('plannedStart');
        if (!plannedEnd) errors.push('plannedEnd');
        if (plannedStart && plannedEnd && plannedEnd <= plannedStart) errors.push('plannedEnd (before start)');
        if (!requesterIdentifier) errors.push('requesterIdentifier');

        if (errors.length) {
            return { valid: false, errors, data: null };
        }

        return {
            valid: true,
            errors: [],
            data: {
                title,
                purposeOfVisit: String(mapped['purposeOfVisit'] ?? '').trim(),
                siteName: String(mapped['siteName'] ?? '').trim(),
                buildingName,
                floor,
                plannedStart: plannedStart!,
                plannedEnd: plannedEnd!,
                requesterIdentifier,
            },
        };
    }

    /** Parse a "כן/לא"-or-boolean-like Excel cell into a boolean. */
    parseBoolean(value: string | undefined): boolean {
        if (!value) return false;
        return TRUE_VALUES.has(value.trim().toLowerCase());
    }

    private parseExcelDateTime(raw: unknown): Date | null {
        if (raw instanceof Date && !isNaN(raw.getTime())) return raw;

        const str = String(raw ?? '').trim();
        if (!str) return null;

        const dmy = str.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})[ T]+(\d{1,2}):(\d{2})$/);
        if (dmy) {
            const [, d, mo, y, h, mi] = dmy;
            return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
        }

        const native = new Date(str);
        return isNaN(native.getTime()) ? null : native;
    }

    private isValidEmail(email: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
}
