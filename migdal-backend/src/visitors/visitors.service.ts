import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Visitor } from './entities/visitor.entity';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../common/utils/paginate.util';
import { toExcelBuffer } from '../common/utils/excel.util';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { BlacklistService } from './blacklist.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class VisitorsService {
    constructor(
        @InjectRepository(Visitor)
        private readonly visitorRepo: Repository<Visitor>,
        private readonly wsGateway: UsersGateway,
        private readonly blacklistService: BlacklistService,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Visitor>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    async exportToExcel(query: PaginationQueryDto): Promise<Buffer> {
        const qb = this.buildFindAllQuery(query);
        const items = await qb.getMany();
        const rows = items.map((v) => ({
            firstName: v.firstName,
            lastName: v.lastName,
            personId: v.personId,
            email: v.email ?? '',
            phone: v.phone ?? '',
            carNumber: v.carNumber ?? '',
        }));
        return toExcelBuffer(rows, 'Visitors');
    }

    private buildFindAllQuery(query: PaginationQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.visitorRepo
            .createQueryBuilder('v')
            .where('v.isActive = :active', { active: true });

        if (search) {
            qb.andWhere(
                '(v.firstName LIKE :s OR v.lastName LIKE :s OR v.email LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            firstName: 'v.firstName',
            lastName: 'v.lastName',
            email: 'v.email',
            phone: 'v.phone',
            personId: 'v.personId',
        });

        const sortable: Record<string, string> = {
            firstName: 'v.firstName',
            lastName: 'v.lastName',
            email: 'v.email',
            phone: 'v.phone',
            personId: 'v.personId',
            createdAt: 'v.createdAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'v.createdAt', sortOrder ?? 'DESC');
        return qb;
    }

    async searchByPersonId(prefix: string): Promise<Pick<Visitor, 'id' | 'firstName' | 'lastName' | 'personId' | 'phone' | 'email' | 'carNumber' | 'vehicleType'>[]> {
        if (!prefix || prefix.trim().length < 4) return [];

        const sanitized = prefix.trim();
        const visitors = await this.visitorRepo
            .createQueryBuilder('v')
            .select(['v.id', 'v.firstName', 'v.lastName', 'v.personId', 'v.phone', 'v.email', 'v.carNumber', 'v.vehicleType'])
            .where('v.isActive = :active', { active: true })
            .andWhere('v.personId LIKE :prefix', { prefix: `${sanitized}%` })
            .orderBy('v.personId', 'ASC')
            .take(10)
            .getMany();

        return visitors;
    }

    async findById(id: string): Promise<Visitor> {
        const visitor = await this.visitorRepo.findOne({
            where: { id, isActive: true },
        });
        if (!visitor) throw new NotFoundException('Visitor not found');
        return visitor;
    }

    async create(dto: CreateVisitorDto, currentUserId?: string): Promise<Visitor> {
        const visitor = this.visitorRepo.create({
            ...dto,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });
        const saved = await this.visitorRepo.save(visitor);
        const result = await this.findById(saved.id);
        this.wsGateway.broadcastToAll('visitors:visitor:created', { id: result.id, firstName: result.firstName, lastName: result.lastName });

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'CREATE',
            entity: 'Visitor',
            entityId: saved.id,
            description: `Created visitor "${result.firstName} ${result.lastName}"`,
            newValue: { firstName: dto.firstName, lastName: dto.lastName, personId: dto.personId },
        }).catch(() => { });

        return result;
    }

    async update(id: string, dto: UpdateVisitorDto, currentUserId?: string): Promise<Visitor> {
        const visitor = await this.findById(id);
        const oldValue = { firstName: visitor.firstName, lastName: visitor.lastName, personId: visitor.personId, email: visitor.email, phone: visitor.phone };
        Object.assign(visitor, dto, { updatedBy: currentUserId ?? null });
        await this.visitorRepo.save(visitor);
        const result = await this.findById(id);

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'UPDATE',
            entity: 'Visitor',
            entityId: id,
            description: `Updated visitor "${result.firstName} ${result.lastName}"`,
            oldValue,
            newValue: dto,
        }).catch(() => { });

        return result;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const visitor = await this.findById(id);
        visitor.isActive = false;
        visitor.updatedBy = currentUserId ?? null;
        await this.visitorRepo.save(visitor);
        this.wsGateway.broadcastToAll('visitors:visitor:deleted', { id });

        this.auditService.log({
            userId: currentUserId,
            module: 'visitors',
            action: 'DELETE',
            entity: 'Visitor',
            entityId: id,
            description: `Deleted visitor "${visitor.firstName} ${visitor.lastName}"`,
        }).catch(() => { });
    }
}
