import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { EntranceExitLogQueryDto } from './entrance-exit-log-query.dto';

describe('EntranceExitLogQueryDto', () => {
    it('should pass with valid ISO date strings', async () => {
        const dto = plainToInstance(EntranceExitLogQueryDto, { dateFrom: '2026-01-01', dateTo: '2026-12-31' });
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateFrom' || e.property === 'dateTo');
        expect(dateErrors).toHaveLength(0);
    });

    it('should pass when dates are omitted', async () => {
        const dto = plainToInstance(EntranceExitLogQueryDto, {});
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateFrom' || e.property === 'dateTo');
        expect(dateErrors).toHaveLength(0);
    });

    it('should pass when dateFrom is empty string', async () => {
        const dto = plainToInstance(EntranceExitLogQueryDto, { dateFrom: '' });
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateFrom');
        expect(dateErrors).toHaveLength(0);
    });

    it('should pass when dateTo is empty string', async () => {
        const dto = plainToInstance(EntranceExitLogQueryDto, { dateTo: '' });
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateTo');
        expect(dateErrors).toHaveLength(0);
    });

    it('should reject invalid date format', async () => {
        const dto = plainToInstance(EntranceExitLogQueryDto, { dateFrom: 'invalid' });
        const errors = await validate(dto);
        const dateErrors = errors.filter(e => e.property === 'dateFrom');
        expect(dateErrors.length).toBeGreaterThan(0);
    });
});
