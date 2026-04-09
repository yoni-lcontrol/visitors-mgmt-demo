import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuditQueryDto } from './audit-query.dto';

describe('AuditQueryDto', () => {
    it('should pass with valid ISO date strings', async () => {
        const dto = plainToInstance(AuditQueryDto, { dateFrom: '2026-01-01', dateTo: '2026-12-31' });
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateFrom' || e.property === 'dateTo');
        expect(dateErrors).toHaveLength(0);
    });

    it('should pass when dates are omitted', async () => {
        const dto = plainToInstance(AuditQueryDto, {});
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateFrom' || e.property === 'dateTo');
        expect(dateErrors).toHaveLength(0);
    });

    it('should pass when dateFrom is empty string', async () => {
        const dto = plainToInstance(AuditQueryDto, { dateFrom: '' });
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateFrom');
        expect(dateErrors).toHaveLength(0);
    });

    it('should pass when dateTo is empty string', async () => {
        const dto = plainToInstance(AuditQueryDto, { dateTo: '' });
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateTo');
        expect(dateErrors).toHaveLength(0);
    });

    it('should reject invalid date format', async () => {
        const dto = plainToInstance(AuditQueryDto, { dateFrom: 'not-a-date' });
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateFrom');
        expect(dateErrors.length).toBeGreaterThan(0);
    });
});
