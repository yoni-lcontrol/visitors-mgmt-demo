import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../common/utils/paginate.util';
import { toExcelBuffer } from '../common/utils/excel.util';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { Permission } from '../permissions/entities/permission.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RolesService {
    constructor(
        @InjectRepository(Role)
        private readonly roleRepo: Repository<Role>,
        @InjectRepository(Permission)
        private readonly permissionRepo: Repository<Permission>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: PaginationQueryDto): Promise<PaginatedResult<Role>> {
        return paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
    }

    async exportToExcel(query: PaginationQueryDto): Promise<Buffer> {
        const qb = this.buildFindAllQuery(query);
        const items = await qb.getMany();
        const rows = items.map((r) => ({
            name: r.name,
            description: r.description ?? '',
            permissionsCount: r.permissions?.length ?? 0,
            isSystem: r.isSystem,
            status: r.isActive ? 'Active' : 'Inactive',
        }));
        return toExcelBuffer(rows, 'Roles');
    }

    private buildFindAllQuery(query: PaginationQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.roleRepo
            .createQueryBuilder('role')
            .leftJoinAndSelect('role.permissions', 'permission')
            .where('role.isActive = :active', { active: true });

        if (search) {
            qb.andWhere('(role.name LIKE :s OR role.description LIKE :s)', {
                s: `%${search}%`,
            });
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            name: 'role.name',
            description: 'role.description',
            isSystem: 'role.isSystem',
        });

        const sortable: Record<string, string> = {
            name: 'role.name',
            description: 'role.description',
            createdAt: 'role.createdAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'role.name', sortOrder ?? 'ASC');
        return qb;
    }

    async findById(id: string): Promise<Role> {
        const role = await this.roleRepo.findOne({
            where: { id, isActive: true },
            relations: ['permissions'],
        });
        if (!role) {
            throw new NotFoundException('Role not found');
        }
        return role;
    }

    async create(dto: CreateRoleDto, currentUserId?: string): Promise<Role> {
        const existing = await this.roleRepo.findOne({
            where: { name: dto.name },
        });
        if (existing) {
            throw new ConflictException('Role name already exists');
        }

        const role = this.roleRepo.create({
            name: dto.name,
            description: dto.description ?? null,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });

        if (dto.permissionIds?.length) {
            role.permissions = await this.permissionRepo.findBy({
                id: In(dto.permissionIds),
            });
        }

        const saved = await this.roleRepo.save(role);
        this.auditService.log({
            userId: currentUserId,
            module: 'roles',
            action: 'CREATE',
            entity: 'Role',
            entityId: saved.id,
            description: `Created role ${dto.name}`,
            newValue: { name: dto.name, description: dto.description, permissionIds: dto.permissionIds },
        }).catch(() => { });
        return this.findById(saved.id);
    }

    async update(
        id: string,
        dto: UpdateRoleDto,
        currentUserId?: string,
    ): Promise<Role> {
        const role = await this.findById(id);

        if (role.isSystem && dto.name && dto.name !== role.name) {
            throw new BadRequestException('Cannot rename a system role');
        }

        if (dto.name && dto.name !== role.name) {
            const dup = await this.roleRepo.findOne({ where: { name: dto.name } });
            if (dup) {
                throw new ConflictException('Role name already exists');
            }
        }

        if (dto.permissionIds) {
            role.permissions = await this.permissionRepo.findBy({
                id: In(dto.permissionIds),
            });
        }

        Object.assign(role, {
            ...(dto.name && { name: dto.name }),
            ...(dto.description !== undefined && { description: dto.description }),
            updatedBy: currentUserId ?? null,
        });

        await this.roleRepo.save(role);
        this.auditService.log({
            userId: currentUserId,
            module: 'roles',
            action: 'UPDATE',
            entity: 'Role',
            entityId: id,
            description: `Updated role ${role.name}`,
            newValue: dto,
        }).catch(() => { });
        return this.findById(id);
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const role = await this.findById(id);
        if (role.isSystem) {
            throw new BadRequestException('Cannot delete a system role');
        }
        role.isActive = false;
        role.updatedBy = currentUserId ?? null;
        await this.roleRepo.save(role);
        this.auditService.log({
            userId: currentUserId,
            module: 'roles',
            action: 'DELETE',
            entity: 'Role',
            entityId: id,
            description: `Deleted role ${role.name}`,
        }).catch(() => { });
    }

    async assignPermissions(
        id: string,
        permissionIds: string[],
    ): Promise<Role> {
        const role = await this.findById(id);
        role.permissions = await this.permissionRepo.findBy({
            id: In(permissionIds),
        });
        await this.roleRepo.save(role);
        return this.findById(id);
    }
}
