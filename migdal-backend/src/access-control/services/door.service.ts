import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Door } from '../entities/door.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../../common/utils/paginate.util';
import { applyTableFilters, parseTableFilters } from '../../common/utils/table-filter.util';
import { toExcelBuffer } from '../../common/utils/excel.util';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class DoorService {
    constructor(
        @InjectRepository(Door)
        private readonly doorRepo: Repository<Door>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Door>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    async exportToExcel(query: PaginationQueryDto): Promise<Buffer> {
        const qb = this.buildFindAllQuery(query);
        const items = await qb.getMany();
        const rows = items.map((d) => ({
            name: d.name,
            doorsIndex: d.doorsIndex,
            entryType: d.entryType,
            controllerId: d.controllerId,
            externalId: d.externalId ?? '',
            ioCount: d.doorIos?.length ?? 0,
        }));
        return toExcelBuffer(rows, 'Doors');
    }

    private buildFindAllQuery(query: PaginationQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.doorRepo
            .createQueryBuilder('door')
            .leftJoinAndSelect('door.doorIos', 'doorIo');

        if (search) {
            qb.andWhere('(door.name LIKE :s)', { s: `%${search}%` });
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            name: 'door.name',
            doorsIndex: 'door.doorsIndex',
            entryType: 'door.entryType',
        });

        const sortable: Record<string, string> = {
            name: 'door.name',
            doorsIndex: 'door.doorsIndex',
            entryType: 'door.entryType',
            createdAt: 'door.createdAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'door.name', sortOrder ?? 'ASC');
        return qb;
    }

    async findByController(controllerId: string): Promise<Door[]> {
        return this.doorRepo.find({
            where: { controllerId },
            relations: ['doorIos'],
            order: { doorsIndex: 'ASC' },
        });
    }

    async findById(id: string): Promise<Door> {
        const door = await this.doorRepo.findOne({
            where: { id },
            relations: ['doorIos'],
        });
        if (!door) throw new NotFoundException('Door not found');
        return door;
    }

    async create(data: Partial<Door>, currentUserId?: string): Promise<Door> {
        const door = this.doorRepo.create(data);
        const saved = await this.doorRepo.save(door);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CREATE',
            entity: 'Door',
            entityId: saved.id,
            description: `Created door "${saved.name}"`,
            newValue: { name: data.name, doorsIndex: data.doorsIndex, entryType: data.entryType, controllerId: data.controllerId },
        }).catch(() => { });

        return saved;
    }

    async update(id: string, data: Partial<Door>, currentUserId?: string): Promise<Door> {
        const door = await this.findById(id);
        const oldValue = { name: door.name, doorsIndex: door.doorsIndex, entryType: door.entryType };
        Object.assign(door, data);
        const saved = await this.doorRepo.save(door);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'UPDATE',
            entity: 'Door',
            entityId: id,
            description: `Updated door "${saved.name}"`,
            oldValue,
            newValue: data,
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const door = await this.findById(id);
        await this.doorRepo.remove(door);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'DELETE',
            entity: 'Door',
            entityId: id,
            description: `Deleted door "${door.name}"`,
        }).catch(() => { });
    }
}
