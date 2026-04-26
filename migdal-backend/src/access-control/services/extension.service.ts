import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Extension } from '../entities/extension.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../../common/utils/paginate.util';
import { applyTableFilters, parseTableFilters } from '../../common/utils/table-filter.util';
import { toExcelBuffer } from '../../common/utils/excel.util';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ExtensionService {
    constructor(
        @InjectRepository(Extension)
        private readonly extensionRepo: Repository<Extension>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Extension>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    async exportToExcel(query: PaginationQueryDto): Promise<Buffer> {
        const qb = this.buildFindAllQuery(query);
        const items = await qb.getMany();
        const rows = items.map((e) => ({
            name: e.name,
            type: e.type,
            extensionIndex: e.extensionIndex,
            controllerId: e.controllerId,
            externalId: e.externalId ?? '',
            ioCount: e.extensionIos?.length ?? 0,
        }));
        return toExcelBuffer(rows, 'Extensions');
    }

    private buildFindAllQuery(query: PaginationQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.extensionRepo
            .createQueryBuilder('ext')
            .leftJoinAndSelect('ext.extensionIos', 'extensionIo');

        if (search) {
            qb.andWhere('(ext.name LIKE :s)', { s: `%${search}%` });
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            name: 'ext.name',
            extensionIndex: 'ext.extensionIndex',
            type: 'ext.type',
        });

        const sortable: Record<string, string> = {
            name: 'ext.name',
            extensionIndex: 'ext.extensionIndex',
            type: 'ext.type',
            createdAt: 'ext.createdAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'ext.name', sortOrder ?? 'ASC');
        return qb;
    }

    async findByController(controllerId: string): Promise<Extension[]> {
        return this.extensionRepo.find({
            where: { controllerId },
            relations: ['extensionIos'],
            order: { extensionIndex: 'ASC' },
        });
    }

    async findById(id: string): Promise<Extension> {
        const ext = await this.extensionRepo.findOne({
            where: { id },
            relations: ['extensionIos'],
        });
        if (!ext) throw new NotFoundException('Extension not found');
        return ext;
    }

    async create(data: Partial<Extension>, currentUserId?: string): Promise<Extension> {
        const ext = this.extensionRepo.create(data);
        const saved = await this.extensionRepo.save(ext);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CREATE',
            entity: 'Extension',
            entityId: saved.id,
            description: `Created extension "${saved.name}"`,
            newValue: { name: data.name, type: data.type, extensionIndex: data.extensionIndex, controllerId: data.controllerId },
        }).catch(() => { });

        return saved;
    }

    async update(id: string, data: Partial<Extension>, currentUserId?: string): Promise<Extension> {
        const ext = await this.findById(id);
        const oldValue = { name: ext.name, type: ext.type, extensionIndex: ext.extensionIndex };
        Object.assign(ext, data);
        const saved = await this.extensionRepo.save(ext);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'UPDATE',
            entity: 'Extension',
            entityId: id,
            description: `Updated extension "${saved.name}"`,
            oldValue,
            newValue: data,
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const ext = await this.findById(id);
        await this.extensionRepo.remove(ext);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'DELETE',
            entity: 'Extension',
            entityId: id,
            description: `Deleted extension "${ext.name}"`,
        }).catch(() => { });
    }

    async upsertByExternalId(data: Partial<Extension>): Promise<{ entity: Extension; action: 'created' | 'updated' }> {
        const { id: _id, ...safeData } = data;
        if (!safeData.externalId) {
            const created = await this.extensionRepo.save(this.extensionRepo.create(safeData));
            return { entity: created, action: 'created' };
        }
        const existing = await this.extensionRepo.findOne({ where: { externalId: safeData.externalId } });
        if (existing) {
            Object.assign(existing, safeData);
            const saved = await this.extensionRepo.save(existing);
            return { entity: saved, action: 'updated' };
        }
        const created = await this.extensionRepo.save(this.extensionRepo.create(safeData));
        return { entity: created, action: 'created' };
    }
}
