import { SmsTemplateRendererService, SmsTemplateData } from './sms-template-renderer.service';
import { BadRequestException } from '@nestjs/common';

describe('SmsTemplateRendererService', () => {
    let service: SmsTemplateRendererService;

    beforeEach(() => {
        service = new SmsTemplateRendererService();
    });

    describe('render', () => {
        const sampleData: SmsTemplateData = {
            visit: {
                title: 'ביקור עסקי',
                startTime: '01/01/2026 09:00',
                endTime: '01/01/2026 17:00',
                hostName: 'ישראל ישראלי',
                siteName: 'מגדל',
                purposeOfVisit: 'תיאור',
            },
            visitor: {
                firstName: 'יוסי',
                lastName: 'כהן',
                personId: '123456789',
                phone: '0501234567',
                company: 'חברה',
                carNumber: '12-345-67',
                checkInCode: '654321',
            },
        };

        it('should replace all placeholders with actual values', () => {
            const template = 'ביקור: {{visit.title}}, מבקר: {{visitor.firstName}} {{visitor.lastName}}';
            const result = service.render(template, sampleData);
            expect(result).toBe('ביקור: ביקור עסקי, מבקר: יוסי כהן');
        });

        it('should replace missing optional values with empty string', () => {
            const data: SmsTemplateData = {
                visit: { title: 'Test' },
                visitor: { firstName: 'John' },
            };
            const template = '{{visit.title}} - {{visit.endTime}} - {{visitor.firstName}}';
            const result = service.render(template, data);
            expect(result).toBe('Test -  - John');
        });

        it('should handle template with no placeholders', () => {
            const result = service.render('Hello World', sampleData);
            expect(result).toBe('Hello World');
        });

        it('should handle empty data gracefully', () => {
            const result = service.render('{{visit.title}}', {});
            expect(result).toBe('');
        });

        it('should handle undefined visitor data', () => {
            const data: SmsTemplateData = { visit: { title: 'Test' } };
            const result = service.render('{{visitor.firstName}}', data);
            expect(result).toBe('');
        });

        it('should replace all visit placeholders correctly', () => {
            const template = '{{visit.title}} {{visit.startTime}} {{visit.endTime}} {{visit.hostName}} {{visit.siteName}} {{visit.purposeOfVisit}}';
            const result = service.render(template, sampleData);
            expect(result).toBe('ביקור עסקי 01/01/2026 09:00 01/01/2026 17:00 ישראל ישראלי מגדל תיאור');
        });

        it('should replace all visitor placeholders correctly', () => {
            const template = '{{visitor.firstName}} {{visitor.lastName}} {{visitor.personId}} {{visitor.phone}} {{visitor.company}} {{visitor.carNumber}}';
            const result = service.render(template, sampleData);
            expect(result).toBe('יוסי כהן 123456789 0501234567 חברה 12-345-67');
        });

        it('should replace checkInCode placeholder correctly', () => {
            const template = 'קוד הכניסה שלך: {{visitor.checkInCode}}';
            const result = service.render(template, sampleData);
            expect(result).toBe('קוד הכניסה שלך: 654321');
        });

        it('should replace checkInCode with empty string when not provided', () => {
            const data: SmsTemplateData = { visitor: { firstName: 'Test' } };
            const result = service.render('Code: {{visitor.checkInCode}}', data);
            expect(result).toBe('Code: ');
        });

        it('should replace parking placeholders correctly', () => {
            const data: SmsTemplateData = {
                visitor: { firstName: 'John', carNumber: '12-345' },
                parking: { status: 'approved', reviewNote: 'Reserved spot 5' },
            };
            const template = '{{visitor.firstName}} parking: {{parking.status}} - {{parking.reviewNote}}';
            const result = service.render(template, data);
            expect(result).toBe('John parking: approved - Reserved spot 5');
        });

        it('should handle missing parking data gracefully', () => {
            const data: SmsTemplateData = { visitor: { firstName: 'John' } };
            const result = service.render('Status: {{parking.status}}', data);
            expect(result).toBe('Status: ');
        });
    });

    describe('validateTemplate', () => {
        it('should accept valid placeholders', () => {
            expect(() => {
                service.validateTemplate('Hello {{visit.title}} and {{visitor.firstName}}');
            }).not.toThrow();
        });

        it('should accept parking placeholders', () => {
            expect(() => {
                service.validateTemplate('Parking: {{parking.status}} Note: {{parking.reviewNote}}');
            }).not.toThrow();
        });

        it('should accept template with no placeholders', () => {
            expect(() => {
                service.validateTemplate('Hello World');
            }).not.toThrow();
        });

        it('should reject invalid placeholders', () => {
            expect(() => {
                service.validateTemplate('Hello {{invalid.field}}');
            }).toThrow(BadRequestException);
        });

        it('should reject mixed valid and invalid placeholders', () => {
            expect(() => {
                service.validateTemplate('{{visit.title}} {{foo.bar}}');
            }).toThrow(BadRequestException);
        });

        it('should include invalid placeholder names in error message', () => {
            try {
                service.validateTemplate('{{bad.placeholder}}');
                fail('Expected BadRequestException');
            } catch (err) {
                expect((err as BadRequestException).message).toContain('{{bad.placeholder}}');
            }
        });
    });

    describe('getSupportedPlaceholders', () => {
        it('should return an array of placeholder strings', () => {
            const placeholders = service.getSupportedPlaceholders();
            expect(Array.isArray(placeholders)).toBe(true);
            expect(placeholders.length).toBeGreaterThan(0);
            expect(placeholders).toContain('{{visit.title}}');
            expect(placeholders).toContain('{{visitor.firstName}}');
            expect(placeholders).toContain('{{visitor.checkInCode}}');
            expect(placeholders).toContain('{{parking.status}}');
            expect(placeholders).toContain('{{parking.reviewNote}}');
        });
    });

    describe('getSampleData', () => {
        it('should return sample data object with visit and visitor', () => {
            const data = service.getSampleData();
            expect(data.visit).toBeDefined();
            expect(data.visitor).toBeDefined();
            expect(data.visit!.title).toBeTruthy();
            expect(data.visitor!.firstName).toBeTruthy();
        });

        it('should include parking sample data', () => {
            const data = service.getSampleData();
            expect(data.parking).toBeDefined();
            expect(data.parking!.status).toBeTruthy();
        });
    });
});
