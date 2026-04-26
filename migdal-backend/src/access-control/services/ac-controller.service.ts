import {
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AcController } from '../entities/ac-controller.entity';
import { CreateControllerDto } from '../dto/create-controller.dto';
import { UpdateControllerDto } from '../dto/update-controller.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../../common/utils/paginate.util';
import { toExcelBuffer } from '../../common/utils/excel.util';
import { applyTableFilters, parseTableFilters } from '../../common/utils/table-filter.util';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AcControllerService {
    constructor(
        @InjectRepository(AcController)
        private readonly controllerRepo: Repository<AcController>,
        private readonly wsGateway: UsersGateway,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: PaginationQueryDto): Promise<PaginatedResult<AcController>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    async exportToExcel(query: PaginationQueryDto): Promise<Buffer> {
        const qb = this.buildFindAllQuery(query);
        const items = await qb.getMany();
        const rows = items.map((ctrl) => ({
            name: ctrl.name,
            type: ctrl.type,
            ip: ctrl.ip ?? '',
            port: ctrl.port,
            model: ctrl.model ?? '',
            externalId: ctrl.externalId ?? '',
            doors: ctrl.doors?.length ?? 0,
            extensions: ctrl.extensions?.length ?? 0,
        }));
        return toExcelBuffer(rows, 'Controllers');
    }

    private buildFindAllQuery(query: PaginationQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.controllerRepo
            .createQueryBuilder('ctrl')
            .leftJoinAndSelect('ctrl.doors', 'door')
            .leftJoinAndSelect('ctrl.extensions', 'ext');

        if (search) {
            qb.andWhere(
                '(ctrl.name LIKE :s OR ctrl.ip LIKE :s OR ctrl.model LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            name: 'ctrl.name',
            ip: 'ctrl.ip',
            model: 'ctrl.model',
            type: 'ctrl.type',
            port: 'ctrl.port',
            externalId: 'ctrl.externalId',
        });

        const sortable: Record<string, string> = {
            name: 'ctrl.name',
            ip: 'ctrl.ip',
            model: 'ctrl.model',
            type: 'ctrl.type',
            port: 'ctrl.port',
            createdAt: 'ctrl.createdAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'ctrl.createdAt', sortOrder ?? 'DESC');
        return qb;
    }

    async findById(id: string): Promise<AcController> {
        const ctrl = await this.controllerRepo.findOne({
            where: { id },
            relations: ['doors', 'doors.doorIos', 'extensions', 'extensions.extensionIos'],
        });
        if (!ctrl) {
            throw new NotFoundException('Controller not found');
        }
        return ctrl;
    }

    async create(dto: CreateControllerDto, currentUserId?: string): Promise<AcController> {
        const ctrl = this.controllerRepo.create({
            ...dto,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });
        const saved = await this.controllerRepo.save(ctrl);
        const result = await this.findById(saved.id);
        this.wsGateway.broadcastToAll('access-control:controller:created', { id: result.id, name: result.name });

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CREATE',
            entity: 'AcController',
            entityId: saved.id,
            description: `Created controller "${result.name}"`,
            newValue: { name: dto.name, type: dto.type, ip: dto.ip, port: dto.port, model: dto.model },
        }).catch(() => { });

        return result;
    }

    async update(id: string, dto: UpdateControllerDto, currentUserId?: string): Promise<AcController> {
        const ctrl = await this.findById(id);
        const oldValue = { name: ctrl.name, type: ctrl.type, ip: ctrl.ip, port: ctrl.port, model: ctrl.model };
        Object.assign(ctrl, dto, { updatedBy: currentUserId ?? null });
        await this.controllerRepo.save(ctrl);
        const result = await this.findById(id);
        this.wsGateway.broadcastToAll('access-control:controller:updated', { id: result.id, name: result.name });

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'UPDATE',
            entity: 'AcController',
            entityId: id,
            description: `Updated controller "${result.name}"`,
            oldValue,
            newValue: dto,
        }).catch(() => { });

        return result;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const ctrl = await this.findById(id);
        await this.controllerRepo.remove(ctrl);
        this.wsGateway.broadcastToAll('access-control:controller:deleted', { id });

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'DELETE',
            entity: 'AcController',
            entityId: id,
            description: `Deleted controller "${ctrl.name}"`,
        }).catch(() => { });
    }

    async upsertByExternalId(data: Partial<AcController>): Promise<{ entity: AcController; action: 'created' | 'updated' }> {
        const { id: _id, ...safeData } = data;
        if (!safeData.externalId) {
            const created = await this.controllerRepo.save(this.controllerRepo.create(safeData));
            return { entity: created, action: 'created' };
        }
        const existing = await this.controllerRepo.findOne({ where: { externalId: safeData.externalId } });
        if (existing) {
            Object.assign(existing, safeData);
            const saved = await this.controllerRepo.save(existing);
            return { entity: saved, action: 'updated' };
        }
        const created = await this.controllerRepo.save(this.controllerRepo.create(safeData));
        return { entity: created, action: 'created' };
    }
}
