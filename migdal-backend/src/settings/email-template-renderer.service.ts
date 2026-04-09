import { Injectable, BadRequestException } from '@nestjs/common';
import {
    EMAIL_PLACEHOLDERS,
    EMAIL_PLACEHOLDER_REGEX,
    VALID_EMAIL_PLACEHOLDER_REGEX,
} from './constants/email-placeholders.constants';

export interface EmailTemplateData {
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
}

@Injectable()
export class EmailTemplateRendererService {
    render(template: string, data: EmailTemplateData): string {
        return template.replace(EMAIL_PLACEHOLDER_REGEX, (match) => {
            const path = match.slice(2, -2);
            const value = this.resolvePath(data, path);
            return value ?? '';
        });
    }

    validateTemplate(template: string): void {
        const allPlaceholders = template.match(EMAIL_PLACEHOLDER_REGEX) ?? [];
        const validPlaceholders = template.match(VALID_EMAIL_PLACEHOLDER_REGEX) ?? [];

        const invalidCount = allPlaceholders.length - validPlaceholders.length;
        if (invalidCount > 0) {
            const validSet = new Set(validPlaceholders);
            const invalid = allPlaceholders.filter((p) => !validSet.has(p));
            const unique = [...new Set(invalid)];
            throw new BadRequestException(
                `Invalid placeholders: ${unique.join(', ')}. Supported: ${EMAIL_PLACEHOLDERS.join(', ')}`,
            );
        }
    }

    getSupportedPlaceholders(): string[] {
        return [...EMAIL_PLACEHOLDERS];
    }

    getSampleData(): EmailTemplateData {
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
        };
    }

    private resolvePath(data: EmailTemplateData, path: string): string | undefined {
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
