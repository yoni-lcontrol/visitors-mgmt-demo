import { parseTableFilters, applyTableFilters, TableFilters } from './table-filter.util';

function createMockQb() {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};
    const qb = {
        andWhere: jest.fn((clause: string, p: Record<string, unknown>) => {
            clauses.push(clause);
            Object.assign(params, p);
            return qb;
        }),
        clauses,
        params,
    } as any;
    return qb;
}

const fieldMap = {
    firstName: 'user.firstName',
    lastName: 'user.lastName',
    isActive: 'user.isActive',
};

describe('parseTableFilters', () => {
    it('should return empty object for undefined', () => {
        expect(parseTableFilters(undefined)).toEqual({});
    });

    it('should return empty object for invalid JSON', () => {
        expect(parseTableFilters('not-json')).toEqual({});
    });

    it('should parse valid JSON', () => {
        const raw = JSON.stringify({ firstName: { value: 'John', matchMode: 'contains' } });
        const result = parseTableFilters(raw);
        expect(result).toHaveProperty('firstName');
    });
});

describe('applyTableFilters', () => {
    it('should handle old PrimeNG format (constraints object)', () => {
        const filters: TableFilters = {
            firstName: {
                operator: 'and',
                constraints: [{ value: 'John', matchMode: 'contains' }],
            },
        };
        const qb = createMockQb();
        applyTableFilters(qb, filters, fieldMap);
        expect(qb.andWhere).toHaveBeenCalledWith(
            'user.firstName LIKE :f_firstName_0',
            { f_firstName_0: '%John%' },
        );
    });

    it('should handle old PrimeNG format (flat value/matchMode)', () => {
        const filters: TableFilters = {
            firstName: { value: 'Jane', matchMode: 'startsWith' },
        };
        const qb = createMockQb();
        applyTableFilters(qb, filters, fieldMap);
        expect(qb.andWhere).toHaveBeenCalledWith(
            'user.firstName LIKE :f_firstName_0',
            { f_firstName_0: 'Jane%' },
        );
    });

    it('should handle PrimeNG v19 format (array of constraints)', () => {
        const filters: TableFilters = {
            firstName: [
                { value: 'John', matchMode: 'contains' },
            ],
        };
        const qb = createMockQb();
        applyTableFilters(qb, filters, fieldMap);
        expect(qb.andWhere).toHaveBeenCalledWith(
            'user.firstName LIKE :f_firstName_0',
            { f_firstName_0: '%John%' },
        );
    });

    it('should handle PrimeNG v19 format with multiple constraints', () => {
        const filters: TableFilters = {
            firstName: [
                { value: 'John', matchMode: 'contains' },
                { value: 'Doe', matchMode: 'endsWith' },
            ],
        };
        const qb = createMockQb();
        applyTableFilters(qb, filters, fieldMap);
        expect(qb.andWhere).toHaveBeenCalledTimes(2);
        expect(qb.andWhere).toHaveBeenCalledWith(
            'user.firstName LIKE :f_firstName_0',
            { f_firstName_0: '%John%' },
        );
        expect(qb.andWhere).toHaveBeenCalledWith(
            'user.firstName LIKE :f_firstName_1',
            { f_firstName_1: '%Doe' },
        );
    });

    it('should skip fields not in fieldMap', () => {
        const filters: TableFilters = {
            unknownField: [{ value: 'test', matchMode: 'contains' }],
        };
        const qb = createMockQb();
        applyTableFilters(qb, filters, fieldMap);
        expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should skip null/empty values', () => {
        const filters: TableFilters = {
            firstName: [{ value: null, matchMode: 'contains' }],
            lastName: [{ value: '', matchMode: 'contains' }],
        };
        const qb = createMockQb();
        applyTableFilters(qb, filters, fieldMap);
        expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('should handle equals matchMode', () => {
        const filters: TableFilters = {
            isActive: [{ value: true, matchMode: 'equals' }],
        };
        const qb = createMockQb();
        applyTableFilters(qb, filters, fieldMap);
        expect(qb.andWhere).toHaveBeenCalledWith(
            'user.isActive = :f_isActive_0',
            { f_isActive_0: true },
        );
    });
});
