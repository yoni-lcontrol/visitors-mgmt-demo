export interface CardTemplateElement {
    id: string;
    type: 'visitor-field' | 'static-text' | 'image' | 'shape' | 'qr';
    visitorField?: string;
    label?: string;
    text?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize?: number;
    fontWeight?: string;
    fontFamily?: string;
    textAlign?: string;
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    visible?: boolean;
    zIndex?: number;
    rotation?: number;
    imageUrl?: string;
    /** QR source type: 'static' for fixed text, 'dynamic' for visitor field */
    qrSourceType?: 'static' | 'dynamic';
    /** QR static value (used when qrSourceType is 'static') */
    qrStaticValue?: string;
    /** QR dynamic visitor field key (used when qrSourceType is 'dynamic') */
    qrDynamicField?: string;
}

export interface CardTemplate {
    id: string;
    name: string;
    description: string | null;
    cardWidthMm: number;
    cardHeightMm: number;
    orientation: string;
    elementsJson: string;
    backgroundColor: string | null;
    backgroundImageUrl: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy: string | null;
    updatedBy: string | null;
    isActive: boolean;
}

export interface CreateCardTemplateRequest {
    name: string;
    description?: string;
    cardWidthMm?: number;
    cardHeightMm?: number;
    orientation?: string;
    elementsJson: string;
    backgroundColor?: string;
    backgroundImageUrl?: string;
}

export interface UpdateCardTemplateRequest {
    name?: string;
    description?: string;
    cardWidthMm?: number;
    cardHeightMm?: number;
    orientation?: string;
    elementsJson?: string;
    backgroundColor?: string;
    backgroundImageUrl?: string;
}

export const VISITOR_FIELDS: { key: string; label: string; labelHe: string }[] = [
    { key: 'firstName', label: 'First Name', labelHe: 'שם פרטי' },
    { key: 'lastName', label: 'Last Name', labelHe: 'שם משפחה' },
    { key: 'fullName', label: 'Full Name', labelHe: 'שם מלא' },
    { key: 'personId', label: 'Person ID', labelHe: 'מספר זהות' },
    { key: 'phone', label: 'Phone', labelHe: 'טלפון' },
    { key: 'email', label: 'Email', labelHe: 'דוא"ל' },
    { key: 'hostName', label: 'Host Name', labelHe: 'שם מארח' },
    { key: 'visitDate', label: 'Visit Date', labelHe: 'תאריך ביקור' },
    { key: 'startTime', label: 'Start Time', labelHe: 'שעת התחלה' },
    { key: 'endTime', label: 'End Time', labelHe: 'שעת סיום' },
    { key: 'visitorImage', label: 'Visitor Image', labelHe: 'תמונת מבקר' },
    { key: 'carNumber', label: 'Car Number', labelHe: 'מספר רכב' },
    { key: 'visitRequesterFirstName', label: 'Visit Requester - First Name', labelHe: 'מזמין הביקור - שם פרטי' },
    { key: 'visitRequesterLastName', label: 'Visit Requester - Last Name', labelHe: 'מזמין הביקור - שם משפחה' },
];
