import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import { AdGroupRoleMapping } from '../ad-group-role-mappings/entities/ad-group-role-mapping.entity';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';

// Per spec: visit requester ("מזמין") lookup is restricted to these AD groups —
// every Sniper group except the default employee group (Sniper_useres / עובד מגדל).
const REQUESTER_ELIGIBLE_AD_GROUPS = [
    'Sniper_Mangers',
    'Sniper_merkaz_Hadrachot',
    'Sniper_Moked_bitachon',
    'Sniper_Dalpak_Bitachon',
    'Sniper_Kabat',
];

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Role)
        private readonly roleRepo: Repository<Role>,
        @InjectRepository(AdGroupRoleMapping)
        private readonly adGroupRoleMappingRepo: Repository<AdGroupRoleMapping>,
        private readonly wsGateway: UsersGateway,
        private readonly auditService: AuditService,
    ) { }

    async findAll(query: PaginationQueryDto): Promise<PaginatedResult<User>> {
        const result = await paginateQuery(this.buildFindAllQuery(query), query.page, query.limit);
        result.items = result.items.map(u => this.stripSensitive(u));
        return result;
    }

    /** Users eligible to be selected as a visit requester ("מזמין") on behalf of someone else. */
    async findRequesterCandidates(query: PaginationQueryDto): Promise<PaginatedResult<User>> {
        const mappings = await this.adGroupRoleMappingRepo.find({
            where: { groupName: In(REQUESTER_ELIGIBLE_AD_GROUPS) },
        });
        const roleIds = [...new Set(mappings.map((m) => m.roleId))];

        const qb = this.buildFindAllQuery(query);
        if (roleIds.length === 0) {
            qb.andWhere('1 = 0');
        } else {
            qb.andWhere(
                'EXISTS (SELECT 1 FROM UserRoles ur WHERE ur.userId = user.id AND ur.roleId IN (:...roleIds))',
                { roleIds },
            );
        }

        const result = await paginateQuery(qb, query.page, query.limit);
        result.items = result.items.map((u) => this.stripSensitive(u));
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
            employeeId: u.employeeId || '',
            status: u.isActive ? 'Active' : 'Inactive',
            role: u.role?.name ?? '',
            createdAt: u.createdAt,
        }));
        return toExcelBuffer(rows, 'Users');
    }

    private buildFindAllQuery(query: PaginationQueryDto) {
        const { search, sortBy, sortOrder, filters } = query;
        const qb = this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.role', 'role')
            .leftJoinAndSelect('user.sector', 'sector');

        if (search) {
            qb.andWhere(
                '(user.username LIKE :s OR user.firstName LIKE :s OR user.lastName LIKE :s OR sector.name LIKE :s)',
                { s: `%${search}%` },
            );
        }

        applyTableFilters(qb, parseTableFilters(filters), {
            firstName: 'user.firstName',
            lastName: 'user.lastName',
            username: 'user.username',
            email: 'user.email',
            phone: 'user.phone',
            mobile: 'user.mobile',
            sectorName: 'sector.name',
            isActive: 'user.isActive',
        });

        const sortable: Record<string, string> = {
            firstName: 'user.firstName',
            lastName: 'user.lastName',
            username: 'user.username',
            email: 'user.email',
            phone: 'user.phone',
            sectorName: 'sector.name',
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
            relations: ['sector', 'role', 'role.permissions', 'roles', 'roles.permissions'],
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
            relations: ['sector', 'role', 'role.permissions', 'roles', 'roles.permissions'],
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepo.findOne({
            where: { email },
            relations: ['sector', 'role', 'role.permissions', 'roles', 'roles.permissions'],
        });
    }

    async findByExternalIdentity(externalAuthId: string, externalTenantId: string): Promise<User | null> {
        const qb = this.userRepo
            .createQueryBuilder('user')
            .leftJoinAndSelect('user.sector', 'sector')
            .leftJoinAndSelect('user.role', 'role')
            .leftJoinAndSelect('role.permissions', 'rolePermissions')
            .leftJoinAndSelect('user.roles', 'roles')
            .leftJoinAndSelect('roles.permissions', 'rolesPermissions')
            .where('user.externalAuthId = :externalAuthId', { externalAuthId })
            .andWhere('(user.externalAuthProvider = :provider OR user.externalAuthProvider IS NULL)', {
                provider: 'entra',
            })
            .andWhere('(user.externalTenantId = :externalTenantId OR user.externalTenantId IS NULL)', {
                externalTenantId,
            })
            .orderBy('CASE WHEN user.externalTenantId = :externalTenantId THEN 0 ELSE 1 END', 'ASC')
            .setParameter('externalTenantId', externalTenantId);

        return qb.getOne();
    }

    async create(dto: CreateUserDto, currentUserId?: string): Promise<User> {
        const existing = await this.userRepo.findOne({
            where: { username: dto.username },
        });
        if (existing) {
            throw new ConflictException('Username already in use');
        }

        const passwordHash = await hashPassword(dto.password);

        const user = this.userRepo.create({
            username: dto.username,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            mobile: dto.mobile ?? null,
            idNumber: dto.idNumber ?? null,
            employeeId: dto.employeeId ?? null,
            licensePlate: dto.licensePlate ?? null,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });

        const requestedRoleIds = dto.roleIds ?? (dto.roleId ? [dto.roleId] : []);
        if (requestedRoleIds.length > 0) {
            const roles = await this.resolveRoles(requestedRoleIds);
            user.roles = roles;
            user.roleId = roles[0]?.id ?? null;
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
            newValue: {
                username: dto.username,
                firstName: dto.firstName,
                lastName: dto.lastName,
                roleId: result.roleId,
                roleIds: result.roles?.map((r) => r.id) ?? (result.roleId ? [result.roleId] : []),
            },
        }).catch(() => { });
        return result;
    }

    async update(
        id: string,
        dto: UpdateUserDto,
        currentUserId?: string,
    ): Promise<User> {
        const user = await this.userRepo.findOne({
            where: { id },
            relations: ['role', 'role.permissions', 'roles', 'roles.permissions'],
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (this.isAdImportedUser(user)) {
            throw new BadRequestException('AD imported users cannot be edited directly. Use role assignment only.');
        }

        if (!user.isActive && dto.isActive === undefined) {
            throw new NotFoundException('User not found');
        }

        if (dto.isActive !== undefined && dto.isActive !== user.isActive && currentUserId && currentUserId === id) {
            throw new BadRequestException('Cannot change your own active status');
        }

        const oldValue = {
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            isActive: user.isActive,
            roleId: user.roleId,
            roleIds: user.roles?.map((r) => r.id) ?? (user.roleId ? [user.roleId] : []),
        };

        if (dto.username && dto.username !== user.username) {
            const dup = await this.userRepo.findOne({ where: { username: dto.username } });
            if (dup) {
                throw new ConflictException('Username already in use');
            }
        }

        const { password, roleId, roleIds, ...rest } = dto;
        Object.assign(user, rest, { updatedBy: currentUserId ?? null });

        const requestedRoleIds = roleIds ?? (roleId !== undefined ? (roleId ? [roleId] : []) : undefined);
        if (requestedRoleIds !== undefined) {
            const roles = await this.resolveRoles(requestedRoleIds);
            user.roles = roles;
            user.roleId = roles[0]?.id ?? null;
        }

        if (password) {
            user.passwordHash = await hashPassword(password);
        }
        await this.userRepo.save(user);
        const result = dto.isActive !== undefined ? this.stripSensitive(user) : await this.findById(id);
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

    async assignRole(
        id: string,
        roleId: string | null,
        currentUserId?: string,
    ): Promise<User> {
        return this.assignRoles(id, roleId ? [roleId] : [], currentUserId);
    }

    async assignRoles(
        id: string,
        roleIds: string[],
        currentUserId?: string,
    ): Promise<User> {
        const user = await this.findById(id);
        const oldRoleIds = user.roles?.map((r) => r.id) ?? (user.roleId ? [user.roleId] : []);
        const roles = await this.resolveRoles(roleIds);

        user.roles = roles;
        user.roleId = roles[0]?.id ?? null;
        user.role = roles[0] ?? null;
        user.updatedBy = currentUserId ?? null;
        await this.userRepo.save(user);

        this.auditService.log({
            userId: currentUserId,
            module: 'users',
            action: 'ASSIGN_ROLE',
            entity: 'User',
            entityId: id,
            description: `Assigned role to user ${user.username}`,
            oldValue: { roleIds: oldRoleIds },
            newValue: { roleIds: roles.map((r) => r.id) },
        }).catch(() => { });

        return this.findById(id);
    }

    async updateLastLogin(id: string): Promise<void> {
        await this.userRepo.update(id, { lastLoginAt: new Date() });
    }

    async linkExternalAuth(userId: string, params: {
        provider: string;
        externalId: string;
        tenantId: string;
        displayName?: string;
        email?: string | null;
    }): Promise<void> {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        await this.userRepo.update(userId, {
            externalAuthProvider: params.provider,
            externalAuthId: params.externalId,
            externalTenantId: params.tenantId,
            displayName: params.displayName ?? user.displayName,
            email: params.email ?? user.email,
            lastExternalLoginAt: new Date(),
        });

        this.auditService.log({
            userId,
            module: 'users',
            action: 'LINK_EXTERNAL_AUTH',
            entity: 'User',
            entityId: userId,
            description: `Linked external auth provider ${params.provider}`,
            newValue: { provider: params.provider, externalId: params.externalId, tenantId: params.tenantId },
        }).catch(() => { });
    }

    async updateLastExternalLogin(userId: string, profile?: { displayName?: string; email?: string | null }): Promise<void> {
        const patch: Partial<User> = {
            lastExternalLoginAt: new Date(),
            lastLoginAt: new Date(),
        };

        if (profile?.displayName) {
            patch.displayName = profile.displayName;
        }

        if (profile?.email) {
            patch.email = profile.email;
        }

        await this.userRepo.update(userId, patch);
    }

    async createExternalUser(params: {
        username: string;
        firstName: string;
        lastName: string;
        displayName: string;
        email: string | null;
        externalAuthProvider: string;
        externalAuthId: string;
        externalTenantId: string;
        roleNames: string[];
    }): Promise<User> {
        const roles = params.roleNames.length
            ? await this.userRepo.manager
                .getRepository(Role)
                .find({ where: { name: In(params.roleNames) } })
            : [];

        const user = this.userRepo.create({
            username: params.username,
            passwordHash: 'EXTERNAL_AUTH_NO_PASSWORD',
            firstName: params.firstName,
            lastName: params.lastName,
            displayName: params.displayName,
            email: params.email,
            externalAuthProvider: params.externalAuthProvider,
            externalAuthId: params.externalAuthId,
            externalTenantId: params.externalTenantId,
            lastExternalLoginAt: new Date(),
            syncSource: 'entra',
            roleId: roles[0]?.id ?? null,
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

    async createPendingExternalUser(params: {
        oid: string;
        tid: string;
        preferredUsername: string | null;
        email: string | null;
        displayName: string | null;
    }): Promise<User> {
        const existing = await this.findByExternalIdentity(params.oid, params.tid);
        if (existing) {
            await this.userRepo.update(existing.id, {
                email: params.email ?? existing.email,
                displayName: params.displayName ?? existing.displayName,
                lastExternalLoginAt: new Date(),
            });
            const updated = await this.userRepo.findOne({ where: { id: existing.id } });
            return this.stripSensitive((updated ?? existing) as User);
        }

        const usernameBase = params.preferredUsername
            ?? params.email?.split('@')[0]
            ?? `entra_${params.oid.slice(0, 8)}`;
        const username = await this.generateUniqueUsername(usernameBase);

        const fullName = (params.displayName ?? '').trim();
        const [firstName = 'Pending', ...rest] = fullName.split(' ');
        const lastName = rest.join(' ') || 'User';

        const pending = this.userRepo.create({
            username,
            passwordHash: null,
            firstName,
            lastName,
            displayName: params.displayName,
            email: params.email,
            externalAuthProvider: 'entra',
            externalAuthId: params.oid,
            externalTenantId: params.tid,
            syncSource: 'entra-pending',
            isActive: false,
            lastExternalLoginAt: new Date(),
            lastLoginAt: null,
            roleId: null,
            roles: [],
        });

        const saved = await this.userRepo.save(pending);

        this.auditService.log({
            userId: null,
            module: 'users',
            action: 'ENTRA_PENDING_CREATED',
            entity: 'User',
            entityId: saved.id,
            description: `Created pending Entra user ${saved.username}`,
            newValue: {
                externalAuthId: params.oid,
                externalTenantId: params.tid,
                email: params.email,
            },
        }).catch(() => { });

        return this.stripSensitive(saved);
    }

    private async resolveRoles(roleIds: string[]): Promise<Role[]> {
        if (roleIds.length === 0) {
            return [];
        }

        const uniqueRoleIds = [...new Set(roleIds)];
        const roles = await this.roleRepo.find({ where: { id: In(uniqueRoleIds) } });

        if (roles.length !== uniqueRoleIds.length) {
            throw new BadRequestException('One or more role IDs are invalid');
        }

        const roleMap = new Map(roles.map((r) => [r.id, r]));
        return uniqueRoleIds.map((id) => roleMap.get(id)!).filter(Boolean);
    }

    private isAdImportedUser(user: User): boolean {
        return user.syncSource === 'ad';
    }

    private async generateUniqueUsername(rawBase: string): Promise<string> {
        const normalized = rawBase.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-') || 'pending-user';

        let attempt = normalized;
        let suffix = 1;
        while (await this.userRepo.exist({ where: { username: attempt } })) {
            suffix += 1;
            attempt = `${normalized}-${suffix}`;
        }

        return attempt;
    }
}
