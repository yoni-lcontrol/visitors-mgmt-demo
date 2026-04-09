import { EmailTemplateRendererService, EmailTemplateData } from './email-template-renderer.service';
import { BadRequestException } from '@nestjs/common';

describe('EmailTemplateRendererService', () => {
    let service: EmailTemplateRendererService;

    beforeEach(() => {
        service = new EmailTemplateRendererService();
    });

    describe('render', () => {
        const sampleData: EmailTemplateData = {
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
            const template = '<p>ביקור: {{visit.title}}, מבקר: {{visitor.firstName}} {{visitor.lastName}}</p>';
            const result = service.render(template, sampleData);
            expect(result).toBe('<p>ביקור: ביקור עסקי, מבקר: יוסי כהן</p>');
        });

        it('should replace missing optional values with empty string', () => {
            const data: EmailTemplateData = {
                visit: { title: 'Test' },
                visitor: { firstName: 'John' },
            };
            const template = '{{visit.title}} - {{visit.endTime}} - {{visitor.firstName}}';
            const result = service.render(template, data);
            expect(result).toBe('Test -  - John');
        });

        it('should handle template with no placeholders', () => {
            const result = service.render('<h1>Hello World</h1>', sampleData);
            expect(result).toBe('<h1>Hello World</h1>');
        });

        it('should handle empty data gracefully', () => {
            const result = service.render('{{visit.title}}', {});
            expect(result).toBe('');
        });

        it('should handle undefined visitor data', () => {
            const data: EmailTemplateData = { visit: { title: 'Test' } };
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
            const result = service.render('<p>Code: {{visitor.checkInCode}}</p>', sampleData);
            expect(result).toBe('<p>Code: 654321</p>');
        });

        it('should replace checkInCode with empty string when not provided', () => {
            const data: EmailTemplateData = { visitor: { firstName: 'Test' } };
            const result = service.render('Code: {{visitor.checkInCode}}', data);
            expect(result).toBe('Code: ');
        });
    });

    describe('validateTemplate', () => {
        it('should accept valid placeholders', () => {
            expect(() => {
                service.validateTemplate('<p>Hello {{visit.title}} and {{visitor.firstName}}</p>');
            }).not.toThrow();
        });

        it('should accept template with no placeholders', () => {
            expect(() => {
                service.validateTemplate('<h1>Hello World</h1>');
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
        });
    });

    describe('getSampleData', () => {
        it('should return data with visit and visitor objects', () => {
            const data = service.getSampleData();
            expect(data.visit).toBeDefined();
            expect(data.visitor).toBeDefined();
            expect(data.visit!.title).toBeDefined();
            expect(data.visitor!.firstName).toBeDefined();
        });

        it('should return data that renders all placeholders', () => {
            const data = service.getSampleData();
            const placeholders = service.getSupportedPlaceholders();
            for (const p of placeholders) {
                const rendered = service.render(p, data);
                expect(rendered).not.toBe('');
            }
        });
    });
});
