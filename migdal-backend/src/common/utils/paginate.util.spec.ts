import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { paginateQuery } from './paginate.util';

function createMockQb<T extends ObjectLiteral>(items: T[], total: number): SelectQueryBuilder<T> {
    const qb = {
        getCount: jest.fn().mockResolvedValue(total),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(items),
    } as unknown as SelectQueryBuilder<T>;
    return qb;
}

describe('paginateQuery', () => {
    it('should return paginated result with correct envelope', async () => {
        const items = [{ id: 1 }, { id: 2 }];
        const qb = createMockQb(items, 10);

        const result = await paginateQuery(qb, 2, 5);

        expect(result).toEqual({
            items,
            total: 10,
            page: 2,
            limit: 5,
            totalPages: 2,
        });
        expect(qb.skip).toHaveBeenCalledWith(5);
        expect(qb.take).toHaveBeenCalledWith(5);
    });

    it('should calculate totalPages rounding up', async () => {
        const qb = createMockQb([{ id: 1 }], 7);

        const result = await paginateQuery(qb, 1, 3);

        expect(result.totalPages).toBe(3);
    });

    it('should return totalPages 0 when total is 0', async () => {
        const qb = createMockQb([], 0);

        const result = await paginateQuery(qb, 1, 10);

        expect(result).toEqual({
            items: [],
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
        });
    });

    it('should apply correct skip for page 1', async () => {
        const qb = createMockQb([], 0);

        await paginateQuery(qb, 1, 10);

        expect(qb.skip).toHaveBeenCalledWith(0);
        expect(qb.take).toHaveBeenCalledWith(10);
    });
});
