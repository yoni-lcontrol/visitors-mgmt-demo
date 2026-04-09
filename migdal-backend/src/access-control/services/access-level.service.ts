import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessLevel } from '../entities/access-level.entity';
import { VisitVisitor } from '../../visitors/entities/visit-visitor.entity';
import { CreateAccessLevelDto } from '../dto/create-access-level.dto';
import { UpdateAccessLevelDto } from '../dto/update-access-level.dto';
import { AccessLevelQueryDto } from '../dto/access-level-query.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../../common/utils/paginate.util';
import { applyTableFilters, parseTableFilters } from '../../common/utils/table-filter.util';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AccessLevelService {
    constructor(
        @InjectRepository(AccessLevel)
        private readonly accessLevelRepo: Repository<AccessLevel>,
        @InjectRepository(VisitVisitor)
        private readonly visitVisitorRepo: Repository<VisitVisitor>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: AccessLevelQueryDto): Promise<PaginatedResult<AccessLevel>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    private buildFindAllQuery(query: AccessLevelQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.accessLevelRepo.createQueryBuilder('al')
            .where('al.isActive = :isActive', { isActive: true });

        if (query.active !== undefined) {
            qb.andWhere('al.active = :active', { active: query.active });
        }

        if (query.visitorAccess !== undefined) {
            qb.andWhere('al.visitorAccess = :va', { va: query.visitorAccess });
        }

        if (search) {
            qb.andWhere('(al.name LIKE :s)', { s: `%${search}%` });
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            name: 'al.name',
        });

        const sortable: Record<string, string> = {
            name: 'al.name',
            active: 'al.active',
            visitorAccess: 'al.visitorAccess',
            createdAt: 'al.createdAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'al.name', sortOrder ?? 'ASC');
        return qb;
    }

    async findById(id: string): Promise<AccessLevel> {
        const al = await this.accessLevelRepo.findOne({ where: { id, isActive: true } });
        if (!al) throw new NotFoundException('Access level not found');
        return al;
    }

    async create(dto: CreateAccessLevelDto, currentUserId?: string): Promise<AccessLevel> {
        const al = this.accessLevelRepo.create(dto);
        const saved = await this.accessLevelRepo.save(al);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CREATE',
            entity: 'AccessLevel',
            entityId: saved.id,
            description: `Created access level "${saved.name}"`,
            newValue: dto,
        }).catch(() => { });

        return saved;
    }

    async update(id: string, dto: UpdateAccessLevelDto, currentUserId?: string): Promise<AccessLevel> {
        const al = await this.findById(id);
        const oldValue = { name: al.name, active: al.active, visitorAccess: al.visitorAccess };
        Object.assign(al, dto);
        const saved = await this.accessLevelRepo.save(al);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'UPDATE',
            entity: 'AccessLevel',
            entityId: id,
            description: `Updated access level "${saved.name}"`,
            oldValue,
            newValue: dto,
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const al = await this.findById(id);
        await this.visitVisitorRepo
            .createQueryBuilder()
            .update(VisitVisitor)
            .set({ accessLevelId: null })
            .where('accessLevelId = :id', { id })
            .execute();
        al.isActive = false;
        await this.accessLevelRepo.save(al);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'DELETE',
            entity: 'AccessLevel',
            entityId: id,
            description: `Deleted access level "${al.name}"`,
        }).catch(() => { });
    }
}
