import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Building } from './entities/building.entity';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { BuildingQueryDto } from './dto/building-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../common/utils/paginate.util';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BuildingsService {
    constructor(
        @InjectRepository(Building)
        private readonly buildingRepo: Repository<Building>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: BuildingQueryDto): Promise<PaginatedResult<Building>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    private buildFindAllQuery(query: BuildingQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.buildingRepo.createQueryBuilder('b')
            .where('b.isActive = :isActive', { isActive: true });

        if (query.active !== undefined) {
            qb.andWhere('b.active = :active', { active: query.active });
        }

        if (search) {
            qb.andWhere('(b.name LIKE :s OR b.address LIKE :s)', { s: `%${search}%` });
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            name: 'b.name',
            address: 'b.address',
        });

        const sortable: Record<string, string> = {
            name: 'b.name',
            address: 'b.address',
            active: 'b.active',
            createdAt: 'b.createdAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'b.name', sortOrder ?? 'ASC');
        return qb;
    }

    async findById(id: string): Promise<Building> {
        const building = await this.buildingRepo.findOne({ where: { id, isActive: true } });
        if (!building) throw new NotFoundException('Building not found');
        return building;
    }

    async create(dto: CreateBuildingDto, currentUserId?: string): Promise<Building> {
        const building = this.buildingRepo.create(dto);
        const saved = await this.buildingRepo.save(building);

        this.auditService.log({
            userId: currentUserId,
            module: 'buildings',
            action: 'CREATE',
            entity: 'Building',
            entityId: saved.id,
            description: `Created building "${saved.name}"`,
            newValue: dto,
        }).catch(() => { });

        return saved;
    }

    async update(id: string, dto: UpdateBuildingDto, currentUserId?: string): Promise<Building> {
        const building = await this.findById(id);
        const oldValue = { name: building.name, address: building.address, active: building.active };
        Object.assign(building, dto);
        const saved = await this.buildingRepo.save(building);

        this.auditService.log({
            userId: currentUserId,
            module: 'buildings',
            action: 'UPDATE',
            entity: 'Building',
            entityId: id,
            description: `Updated building "${saved.name}"`,
            oldValue,
            newValue: dto,
        }).catch(() => { });

        return saved;
    }
}
