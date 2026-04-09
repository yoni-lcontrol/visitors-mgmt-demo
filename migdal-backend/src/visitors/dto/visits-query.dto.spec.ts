import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VisitsQueryDto } from './visits-query.dto';

describe('VisitsQueryDto', () => {
    it('should accept valid timeFilter values', async () => {
        for (const value of ['today', 'future', 'history']) {
            const dto = plainToInstance(VisitsQueryDto, { timeFilter: value });
            const errors = await validate(dto);
            const timeFilterErrors = errors.filter(e => e.property === 'timeFilter');
            expect(timeFilterErrors).toHaveLength(0);
        }
    });

    it('should reject invalid timeFilter value', async () => {
        const dto = plainToInstance(VisitsQueryDto, { timeFilter: 'invalid' });
        const errors = await validate(dto);
        const timeFilterErrors = errors.filter(e => e.property === 'timeFilter');
        expect(timeFilterErrors.length).toBeGreaterThan(0);
    });

    it('should reject ongoing as timeFilter value', async () => {
        const dto = plainToInstance(VisitsQueryDto, { timeFilter: 'ongoing' });
        const errors = await validate(dto);
        const timeFilterErrors = errors.filter(e => e.property === 'timeFilter');
        expect(timeFilterErrors.length).toBeGreaterThan(0);
    });

    it('should allow missing timeFilter', async () => {
        const dto = plainToInstance(VisitsQueryDto, { page: 1, limit: 10 });
        const errors = await validate(dto);
        const timeFilterErrors = errors.filter(e => e.property === 'timeFilter');
        expect(timeFilterErrors).toHaveLength(0);
    });
});
