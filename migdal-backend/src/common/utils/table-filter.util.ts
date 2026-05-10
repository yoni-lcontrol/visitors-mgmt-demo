import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export type FilterOperator =
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'equals'
    | 'notEquals'
    | 'lt'
    | 'lte'
    | 'gt'
    | 'gte';

export interface TableFilterConstraint {
    value: string | number | boolean | null;
    matchMode?: FilterOperator;
}

export interface TableFilterField {
    value?: string | number | boolean | null;
    matchMode?: FilterOperator;
    operator?: 'and' | 'or';
    constraints?: TableFilterConstraint[];
}

export type TableFilters = Record<string, TableFilterField | TableFilterConstraint[] | undefined>;

export function parseTableFilters(raw?: string): TableFilters {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed as TableFilters;
        return {};
    } catch {
        return {};
    }
}

function applyConstraint<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    dbField: string,
    constraint: TableFilterConstraint,
    paramName: string,
) {
    const value = constraint?.value;
    if (value === undefined || value === null || value === '') return;

    const mode = constraint.matchMode ?? 'contains';

    if (mode === 'contains') {
        qb.andWhere(`${dbField} LIKE :${paramName}`, { [paramName]: `%${value}%` });
        return;
    }
    if (mode === 'startsWith') {
        qb.andWhere(`${dbField} LIKE :${paramName}`, { [paramName]: `${value}%` });
        return;
    }
    if (mode === 'endsWith') {
        qb.andWhere(`${dbField} LIKE :${paramName}`, { [paramName]: `%${value}` });
        return;
    }
    if (mode === 'equals') {
        qb.andWhere(`${dbField} = :${paramName}`, { [paramName]: value });
        return;
    }
    if (mode === 'notEquals') {
        qb.andWhere(`${dbField} <> :${paramName}`, { [paramName]: value });
        return;
    }
    if (mode === 'lt') {
        qb.andWhere(`${dbField} < :${paramName}`, { [paramName]: value });
        return;
    }
    if (mode === 'lte') {
        qb.andWhere(`${dbField} <= :${paramName}`, { [paramName]: value });
        return;
    }
    if (mode === 'gt') {
        qb.andWhere(`${dbField} > :${paramName}`, { [paramName]: value });
        return;
    }
    if (mode === 'gte') {
        qb.andWhere(`${dbField} >= :${paramName}`, { [paramName]: value });
    }
}

export function applyTableFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    filters: TableFilters,
    fieldMap: Record<string, string>,
): void {
    let paramCounter = 0;

    Object.entries(filters).forEach(([uiField, filter]) => {
        if (!filter) return;
        const dbField = fieldMap[uiField];
        if (!dbField) return;

        // PrimeNG v19 sends filters as arrays; older versions use { constraints: [...] }
        const constraints: TableFilterConstraint[] = Array.isArray(filter)
            ? filter
            : filter.constraints?.length
                ? filter.constraints
                : [{ value: filter.value ?? null, matchMode: filter.matchMode }];

        constraints.forEach((constraint) => {
            const value = constraint?.value;
            if (value === undefined || value === null || value === '') return;
            const paramName = `f_${uiField}_${paramCounter++}`;
            applyConstraint(qb, dbField, constraint, paramName);
        });
    });
}
