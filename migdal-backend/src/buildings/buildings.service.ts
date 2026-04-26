import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Building } from './entities/building.entity';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { BuildingQueryDto } from './dto/building-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../common/utils/paginate.util';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { AuditService } from '../audit/audit.service';
import { AccessLevel } from '../access-control/entities/access-level.entity';

@Injectable()
export class BuildingsService {
    constructor(
        @InjectRepository(Building)
        private readonly buildingRepo: Repository<Building>,
        @InjectRepository(AccessLevel)
        private readonly accessLevelRepo: Repository<AccessLevel>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: BuildingQueryDto): Promise<PaginatedResult<Building>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    private buildFindAllQuery(query: BuildingQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.buildingRepo.createQueryBuilder('b')
            .leftJoinAndSelect('b.accessLevels', 'al', 'al.isActive = :alIsActive AND al.active = :alBusinessActive', {
                alIsActive: true,
                alBusinessActive: true,
            })
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
        const building = await this.buildingRepo.findOne({
            where: { id, isActive: true },
            relations: ['accessLevels'],
        });
        if (!building) throw new NotFoundException('Building not found');
        building.accessLevels = (building.accessLevels ?? []).filter((accessLevel) => accessLevel.isActive && accessLevel.active);
        return building;
    }

    async findAccessLevels(): Promise<AccessLevel[]> {
        return this.accessLevelRepo.find({
            where: {
                isActive: true,
                active: true,
                visitorAccess: true,
            },
            order: {
                name: 'ASC',
            },
        });
    }

    async create(dto: CreateBuildingDto, currentUserId?: string): Promise<Building> {
        const { accessLevelIds, ...buildingData } = dto;
        const accessLevels = await this.resolveAccessLevels(accessLevelIds);
        const building = this.buildingRepo.create(buildingData);
        building.accessLevels = accessLevels;
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
        const oldValue = {
            name: building.name,
            address: building.address,
            active: building.active,
            accessLevelIds: (building.accessLevels ?? []).map((accessLevel) => accessLevel.id),
        };
        const { accessLevelIds, ...buildingData } = dto;
        Object.assign(building, buildingData);
        if (accessLevelIds !== undefined) {
            building.accessLevels = await this.resolveAccessLevels(accessLevelIds);
        }
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

    private async resolveAccessLevels(accessLevelIds?: string[]): Promise<AccessLevel[]> {
        if (!accessLevelIds?.length) {
            return [];
        }

        const uniqueIds = [...new Set(accessLevelIds)];
        const accessLevels = await this.accessLevelRepo.find({
            where: {
                id: In(uniqueIds),
                isActive: true,
                active: true,
                visitorAccess: true,
            },
        });

        if (accessLevels.length !== uniqueIds.length) {
            throw new BadRequestException('One or more access levels were not found, inactive, or not open for visitor access');
        }

        return accessLevels;
    }
}
