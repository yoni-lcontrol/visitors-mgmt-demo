import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginatedResult } from '../interfaces/paginated-result.interface';

/**
 * Applies pagination (skip/take) to a pre-built query builder and returns
 * a standard PaginatedResult envelope.
 *
 * Usage:
 *   const qb = this.buildFindAllQuery(query);
 *   return paginateQuery(qb, query.page, query.limit);
 */
export async function paginateQuery<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    page: number,
    limit: number,
): Promise<PaginatedResult<T>> {
    const total = await qb.getCount();
    const items = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
