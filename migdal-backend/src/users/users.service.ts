import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { paginateQuery } from '../common/utils/paginate.util';
import { hashPassword } from '../common/utils/hash.util';
import { toExcelBuffer } from '../common/utils/excel.util';
import { applyTableFilters, parseTableFilters } from '../common/utils/table-filter.util';
import { Role } from '../roles/entities/role.entity';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly wsGateway: UsersGateway,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: PaginationQueryDto): Promise<PaginatedResult<User>> {
        const result = await paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
        result.items = result.items.map(u => this.stripSensitive(u));
        return result;
    }

    async exportToExcel(query: PaginationQueryDto): Promise<Buffer> {
        const qb = this.buildFindAllQuery(query);
        const items = await qb.getMany();
        const rows = items.map((u) => ({
            firstName: u.firstName,
            lastName: u.lastName,
            username: u.username,
            idNumber: u.idNumber || '',
            status: u.isActive ? 'Active' : 'Inactive',
            roles: (u.roles ?? []).map((r) => r.name).join(', '),
            createdAt: u.createdAt,
        }));
        return toExcelBuffer(rows, 'Users');
    }

    private buildFindAllQuery(query: PaginationQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.roles', 'role');

        if (search) {
            qb.andWhere(
                '(user.username LIKE :s OR user.firstName LIKE :s OR user.lastName LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            firstName: 'user.firstName',
            lastName: 'user.lastName',
            username: 'user.username',
            email: 'user.email',
            phone: 'user.phone',
            isActive: 'user.isActive',
        });

        const sortable: Record<string, string> = {
            firstName: 'user.firstName',
            lastName: 'user.lastName',
            username: 'user.username',
            email: 'user.email',
            phone: 'user.phone',
            createdAt: 'user.createdAt',
            updatedAt: 'user.updatedAt',
        };

        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'user.createdAt', sortOrder ?? 'DESC');

        return qb;
    }

    async findById(id: string): Promise<User> {
        const user = await this.userRepo.findOne({
            where: { id, isActive: true },
            relations: ['roles', 'roles.permissions'],
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return this.stripSensitive(user);
    }

    private stripSensitive(user: User): User {
        const { passwordHash, ...safe } = user as any;
        return safe as User;
    }

    async findByUsername(username: string): Promise<User | null> {
        return this.userRepo.findOne({
            where: { username },
            relations: ['roles', 'roles.permissions'],
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepo.findOne({
            where: { email },
            relations: ['roles', 'roles.permissions'],
        });
    }

    async findByExternalAuthId(externalAuthId: string): Promise<User | null> {
        return this.userRepo.findOne({
            where: { externalAuthId },
            relations: ['roles', 'roles.permissions'],
        });
    }

    async create(dto: CreateUserDto, currentUserId?: string): Promise<User> {
        const existing = await this.userRepo.findOne({
            where: { username: dto.username },
        });
        if (existing) {
            throw new ConflictException('Username already in use');
        }

        const passwordHash = dto.password
            ? await hashPassword(dto.password)
            : null;

        const user = this.userRepo.create({
            username: dto.username,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            idNumber: dto.idNumber ?? null,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });

        if (dto.roleIds?.length) {
            user.roles = dto.roleIds.map((id) => ({ id }) as Role);
        }

        const saved = await this.userRepo.save(user);
        const result = await this.findById(saved.id);
        this.wsGateway.broadcastToAll('users:user:created', { id: result.id, username: result.username, firstName: result.firstName, lastName: result.lastName });
        this.auditService.log({
            userId: currentUserId,
            module: 'users',
            action: 'CREATE',
            entity: 'User',
            entityId: saved.id,
            description: `Created user ${dto.username}`,
            newValue: { username: dto.username, firstName: dto.firstName, lastName: dto.lastName, roleIds: dto.roleIds },
        }).catch(() => { });
        return result;
    }

    async update(
        id: string,
        dto: UpdateUserDto,
        currentUserId?: string,
    ): Promise<User> {
        const hasIsActiveChange = dto.isActive !== undefined;

        // When toggling isActive, find user regardless of current active status
        let user: User;
        if (hasIsActiveChange) {
            const found = await this.userRepo.findOne({
                where: { id },
                relations: ['roles', 'roles.permissions'],
            });
            if (!found) {
                throw new NotFoundException('User not found');
            }
            user = this.stripSensitive(found);

            if (dto.isActive !== found.isActive && currentUserId && currentUserId === id) {
                throw new BadRequestException('Cannot change your own active status');
            }
        } else {
            user = await this.findById(id);
        }

        const oldValue = { username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, isActive: user.isActive };

        if (dto.username && dto.username !== user.username) {
            const dup = await this.userRepo.findOne({ where: { username: dto.username } });
            if (dup) {
                throw new ConflictException('Username already in use');
            }
        }

        const { password, ...rest } = dto;
        Object.assign(user, rest, { updatedBy: currentUserId ?? null });
        if (password) {
            user.passwordHash = await hashPassword(password);
        }
        await this.userRepo.save(user);
        const result = hasIsActiveChange ? this.stripSensitive(user) : await this.findById(id);
        this.wsGateway.broadcastToAll('users:user:updated', { id: result.id, username: result.username, firstName: result.firstName, lastName: result.lastName });
        this.auditService.log({
            userId: currentUserId,
            module: 'users',
            action: 'UPDATE',
            entity: 'User',
            entityId: id,
            description: `Updated user ${user.username}`,
            oldValue,
            newValue: dto,
        }).catch(() => { });
        return result;
    }

    async assignRoles(
        id: string,
        roleIds: string[],
        currentUserId?: string,
    ): Promise<User> {
        const user = await this.findById(id);
        const oldRoleIds = (user.roles ?? []).map(r => r.id);
        user.roles = roleIds.map((rid) => ({ id: rid }) as Role);
        user.updatedBy = currentUserId ?? null;
        await this.userRepo.save(user);

        this.auditService.log({
            userId: currentUserId,
            module: 'users',
            action: 'ASSIGN_ROLES',
            entity: 'User',
            entityId: id,
            description: `Assigned roles to user ${user.username}`,
            oldValue: { roleIds: oldRoleIds },
            newValue: { roleIds },
        }).catch(() => { });

        return this.findById(id);
    }

    async updateLastLogin(id: string): Promise<void> {
        await this.userRepo.update(id, { lastLoginAt: new Date() });
    }

    async linkExternalAuth(
        userId: string,
        provider: string,
        externalId: string,
    ): Promise<void> {
        await this.userRepo.update(userId, {
            externalAuthProvider: provider,
            externalAuthId: externalId,
            lastExternalLoginAt: new Date(),
        });

        this.auditService.log({
            userId,
            module: 'users',
            action: 'LINK_EXTERNAL_AUTH',
            entity: 'User',
            entityId: userId,
            description: `Linked external auth provider ${provider}`,
            newValue: { provider },
        }).catch(() => { });
    }

    async updateLastExternalLogin(userId: string): Promise<void> {
        await this.userRepo.update(userId, {
            lastExternalLoginAt: new Date(),
            lastLoginAt: new Date(),
        });
    }

    async createExternalUser(params: {
        username: string;
        firstName: string;
        lastName: string;
        email: string | null;
        externalAuthProvider: string;
        externalAuthId: string;
        roleNames: string[];
    }): Promise<User> {
        const roles = await this.userRepo.manager
            .getRepository(Role)
            .find({ where: params.roleNames.map((name) => ({ name })) });

        const user = this.userRepo.create({
            username: params.username,
            passwordHash: 'EXTERNAL_AUTH_NO_PASSWORD',
            firstName: params.firstName,
            lastName: params.lastName,
            email: params.email,
            externalAuthProvider: params.externalAuthProvider,
            externalAuthId: params.externalAuthId,
            lastExternalLoginAt: new Date(),
            syncSource: 'entra',
            roles,
        });

        const saved = await this.userRepo.save(user);

        this.auditService.log({
            userId: saved.id,
            module: 'users',
            action: 'AUTO_PROVISION',
            entity: 'User',
            entityId: saved.id,
            description: `User ${saved.username} auto-provisioned via ${params.externalAuthProvider}`,
        }).catch(() => { });

        this.wsGateway.broadcastToAll('user:changed', { action: 'created', userId: saved.id });

        return this.findById(saved.id);
    }
}
