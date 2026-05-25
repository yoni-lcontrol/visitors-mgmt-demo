import { Injectable, BadRequestException } from '@nestjs/common';
import {
    SMS_PLACEHOLDERS,
    PLACEHOLDER_REGEX,
    VALID_PLACEHOLDER_REGEX,
} from './constants/sms-placeholders.constants';

export interface SmsTemplateData {
    visit?: {
        title?: string;
        startTime?: string;
        endTime?: string;
        hostName?: string;
        siteName?: string;
        purposeOfVisit?: string;
    };
    visitor?: {
        firstName?: string;
        lastName?: string;
        personId?: string;
        phone?: string;
        company?: string;
        carNumber?: string;
        checkInCode?: string;
    };
    parking?: {
        status?: string;
        reviewNote?: string;
    };
    requester?: {
        phone?: string;
        email?: string;
    };
}

@Injectable()
export class SmsTemplateRendererService {
    /**
     * Render a template string by replacing placeholders with actual data.
     * Missing values are replaced with empty string.
     */
    render(template: string, data: SmsTemplateData): string {
        return template.replace(PLACEHOLDER_REGEX, (match) => {
            const path = match.slice(2, -2); // strip {{ and }}
            const value = this.resolvePath(data, path);
            return value ?? '';
        });
    }

    /**
     * Validate that a template only contains supported placeholders.
     * Throws BadRequestException if invalid placeholders are found.
     */
    validateTemplate(template: string): void {
        const allPlaceholders = template.match(PLACEHOLDER_REGEX) ?? [];
        const validPlaceholders = template.match(VALID_PLACEHOLDER_REGEX) ?? [];

        const invalidCount = allPlaceholders.length - validPlaceholders.length;
        if (invalidCount > 0) {
            const validSet = new Set(validPlaceholders);
            const invalid = allPlaceholders.filter((p) => !validSet.has(p));
            const unique = [...new Set(invalid)];
            throw new BadRequestException(
                `Invalid placeholders: ${unique.join(', ')}. Supported: ${SMS_PLACEHOLDERS.join(', ')}`,
            );
        }
    }

    /** Returns the list of supported placeholders for documentation */
    getSupportedPlaceholders(): string[] {
        return [...SMS_PLACEHOLDERS];
    }

    /**
     * Build a sample data object for template preview.
     */
    getSampleData(): SmsTemplateData {
        return {
            visit: {
                title: 'ביקור לדוגמה',
                startTime: '01/01/2026 09:00',
                endTime: '01/01/2026 17:00',
                hostName: 'ישראל ישראלי',
                siteName: 'מגדל',
                purposeOfVisit: 'ביקור עסקי לדוגמה',
            },
            visitor: {
                firstName: 'יוסי',
                lastName: 'כהן',
                personId: '123456789',
                phone: '0501234567',
                company: 'חברה לדוגמה',
                carNumber: '12-345-67',
                checkInCode: '123456',
            },
            parking: {
                status: 'approved',
                reviewNote: 'הערה לדוגמה',
            },
        };
    }

    private resolvePath(data: SmsTemplateData, path: string): string | undefined {
        const parts = path.split('.');
        let current: unknown = data;
        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            current = (current as Record<string, unknown>)[part];
        }
        if (current === null || current === undefined) return undefined;
        return String(current);
    }
}
