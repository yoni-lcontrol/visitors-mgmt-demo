import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { toExcelBuffer } from '../common/utils/excel.util';
import { paginateQuery } from '../common/utils/paginate.util';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { CreateVehicleModelDto } from './dto/create-vehicle-model.dto';
import { UpdateVehicleModelDto } from './dto/update-vehicle-model.dto';
import { VehicleModelQueryDto } from './dto/vehicle-model-query.dto';
import { VehicleManufacturer } from './entities/vehicle-manufacturer.entity';
import { VehicleModel } from './entities/vehicle-model.entity';

@Injectable()
export class VehicleModelsService {
    constructor(
        @InjectRepository(VehicleModel)
        private readonly vehicleModelRepo: Repository<VehicleModel>,
        @InjectRepository(VehicleManufacturer)
        private readonly manufacturerRepo: Repository<VehicleManufacturer>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: VehicleModelQueryDto): Promise<PaginatedResult<VehicleModel>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    async findById(id: string): Promise<VehicleModel> {
        const entity = await this.vehicleModelRepo.findOne({ where: { id } });
        if (!entity) {
            throw new NotFoundException('Vehicle model not found');
        }
        return entity;
    }

    async getManufacturers(): Promise<string[]> {
        const manufacturers = await this.manufacturerRepo.find({
            order: { name: 'ASC' },
        });

        return manufacturers.map((manufacturer) => manufacturer.name);
    }

    async create(dto: CreateVehicleModelDto, currentUserId?: string): Promise<VehicleModel> {
        const normalized = this.normalize(dto);
        await this.ensureManufacturerExists(normalized.manufacturer);

        const existing = await this.vehicleModelRepo.findOne({
            where: {
                manufacturer: normalized.manufacturer,
                model: normalized.model,
            },
        });

        if (existing) {
            throw new ConflictException('Vehicle model already exists for this manufacturer');
        }

        const entity = this.vehicleModelRepo.create({
            ...normalized,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });

        const saved = await this.vehicleModelRepo.save(entity);

        this.auditService.log({
            userId: currentUserId,
            module: 'vehicle-models',
            action: 'CREATE',
            entity: 'VehicleModel',
            entityId: saved.id,
            description: `Created vehicle model "${saved.manufacturer} ${saved.model}"`,
            newValue: normalized,
        }).catch(() => { });

        return saved;
    }

    async update(id: string, dto: UpdateVehicleModelDto, currentUserId?: string): Promise<VehicleModel> {
        const entity = await this.findById(id);

        const normalizedManufacturer = dto.manufacturer !== undefined
            ? this.normalizeValue(dto.manufacturer, 'manufacturer')
            : entity.manufacturer;
        const normalizedModel = dto.model !== undefined
            ? this.normalizeValue(dto.model, 'model')
            : entity.model;

        await this.ensureManufacturerExists(normalizedManufacturer);

        const duplicate = await this.vehicleModelRepo
            .createQueryBuilder('vm')
            .where('vm.manufacturer = :manufacturer', { manufacturer: normalizedManufacturer })
            .andWhere('vm.model = :model', { model: normalizedModel })
            .andWhere('vm.id <> :id', { id })
            .getOne();

        if (duplicate) {
            throw new ConflictException('Vehicle model already exists for this manufacturer');
        }

        const oldValue = {
            manufacturer: entity.manufacturer,
            model: entity.model,
        };

        entity.manufacturer = normalizedManufacturer;
        entity.model = normalizedModel;
        entity.updatedBy = currentUserId ?? null;

        const saved = await this.vehicleModelRepo.save(entity);

        this.auditService.log({
            userId: currentUserId,
            module: 'vehicle-models',
            action: 'UPDATE',
            entity: 'VehicleModel',
            entityId: id,
            description: `Updated vehicle model "${saved.manufacturer} ${saved.model}"`,
            oldValue,
            newValue: {
                manufacturer: saved.manufacturer,
                model: saved.model,
            },
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const entity = await this.findById(id);
        await this.vehicleModelRepo.delete({ id });

        this.auditService.log({
            userId: currentUserId,
            module: 'vehicle-models',
            action: 'DELETE',
            entity: 'VehicleModel',
            entityId: id,
            description: `Deleted vehicle model "${entity.manufacturer} ${entity.model}"`,
        }).catch(() => { });
    }

    async exportToExcel(query: VehicleModelQueryDto): Promise<Buffer> {
        const qb = this.buildFindAllQuery(query);
        const items = await qb.getMany();
        const rows = items.map((item) => ({
            manufacturer: item.manufacturer,
            model: item.model,
        }));

        return toExcelBuffer(rows, 'VehicleModels');
    }

    private buildFindAllQuery(query: VehicleModelQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;

        const qb = this.vehicleModelRepo.createQueryBuilder('vm');

        if (search) {
            qb.andWhere('(vm.manufacturer LIKE :s OR vm.model LIKE :s)', {
                s: `%${search}%`,
            });
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            manufacturer: 'vm.manufacturer',
            model: 'vm.model',
            createdAt: 'vm.createdAt',
            updatedAt: 'vm.updatedAt',
        });

        const sortable: Record<string, string> = {
            manufacturer: 'vm.manufacturer',
            model: 'vm.model',
            createdAt: 'vm.createdAt',
            updatedAt: 'vm.updatedAt',
        };

        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'vm.manufacturer', sortOrder ?? 'ASC');

        return qb;
    }

    private normalize(dto: CreateVehicleModelDto): CreateVehicleModelDto {
        return {
            manufacturer: this.normalizeValue(dto.manufacturer, 'manufacturer'),
            model: this.normalizeValue(dto.model, 'model'),
        };
    }

    private normalizeValue(value: string, field: 'manufacturer' | 'model'): string {
        const normalized = value?.trim();
        if (!normalized) {
            throw new BadRequestException(`${field} is required`);
        }
        return normalized;
    }

    private async ensureManufacturerExists(manufacturer: string): Promise<void> {
        const exists = await this.manufacturerRepo.findOne({ where: { name: manufacturer } });
        if (!exists) {
            throw new BadRequestException('manufacturer must exist in the predefined manufacturers list');
        }
    }
}
