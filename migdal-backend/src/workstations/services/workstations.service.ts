import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as crypto from 'crypto';
import { Workstation } from '../entities/workstation.entity';
import { WorkstationUser } from '../entities/workstation-user.entity';
import { WorkstationRole } from '../entities/workstation-role.entity';
import { WorkstationEnrollmentToken } from '../entities/workstation-enrollment-token.entity';
import { DeviceAgent } from '../../agents/entities/device-agent.entity';
import { Role } from '../../roles/entities/role.entity';
import { CreateWorkstationDto } from '../dto/create-workstation.dto';
import { UpdateWorkstationDto } from '../dto/update-workstation.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { AuditService } from '../../audit/audit.service';

const ENROLLMENT_TOKEN_EXPIRY_HOURS = 24;

@Injectable()
export class WorkstationsService {
    private readonly logger = new Logger(WorkstationsService.name);

    constructor(
        @InjectRepository(Workstation)
        private readonly workstationRepo: Repository<Workstation>,
        @InjectRepository(WorkstationUser)
        private readonly workstationUserRepo: Repository<WorkstationUser>,
        @InjectRepository(WorkstationRole)
        private readonly workstationRoleRepo: Repository<WorkstationRole>,
        @InjectRepository(WorkstationEnrollmentToken)
        private readonly enrollmentTokenRepo: Repository<WorkstationEnrollmentToken>,
        @InjectRepository(DeviceAgent)
        private readonly deviceAgentRepo: Repository<DeviceAgent>,
        @InjectRepository(Role)
        private readonly roleRepo: Repository<Role>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(): Promise<Workstation[]> {
        return this.workstationRepo.find({
            where: { isActive: true },
            order: { displayName: 'ASC' },
        });
    }

    async findAllWithDeviceStatus(query: PaginationQueryDto): Promise<PaginatedResult<any>> {
        const { search, sortBy, sortOrder, page, limit } = query;

        const qb = this.workstationRepo
            .createQueryBuilder('ws')
            .leftJoinAndSelect('ws.defaultCardTemplate', 'tpl')
            .where('ws.isActive = :active', { active: true });

        if (search) {
            qb.andWhere(
                '(ws.displayName LIKE :s OR ws.code LIKE :s OR ws.description LIKE :s)',
                { s: `%${search}%` },
            );
        }

        const sortable: Record<string, string> = {
            displayName: 'ws.displayName',
            code: 'ws.code',
            description: 'ws.description',
            createdAt: 'ws.createdAt',
        };
        const sortColumn = sortBy ? sortable[sortBy] : undefined;
        qb.orderBy(sortColumn ?? 'ws.displayName', sortOrder ?? 'ASC');

        const total = await qb.getCount();
        const workstations = await qb
            .skip((page - 1) * limit)
            .take(limit)
            .getMany();

        const deviceAgents = await this.deviceAgentRepo.find({
            where: { isActive: true, isEnabled: true },
        });

        const userCounts = await this.workstationUserRepo
            .createQueryBuilder('wu')
            .select('wu.workstationId', 'workstationId')
            .addSelect('COUNT(*)', 'count')
            .where('wu.isActive = 1')
            .groupBy('wu.workstationId')
            .getRawMany<{ workstationId: string; count: string }>();

        const roleCounts = await this.workstationRoleRepo
            .createQueryBuilder('wr')
            .select('wr.workstationId', 'workstationId')
            .addSelect('COUNT(*)', 'count')
            .where('wr.isActive = 1')
            .groupBy('wr.workstationId')
            .getRawMany<{ workstationId: string; count: string }>();

        const userCountMap = new Map(userCounts.map((r) => [r.workstationId, parseInt(r.count, 10)]));
        const roleCountMap = new Map(roleCounts.map((r) => [r.workstationId, parseInt(r.count, 10)]));

        const items = workstations.map((ws) => {
            const wsAgents = deviceAgents.filter((a) => a.workstationId === ws.id);
            const devices = wsAgents.map((agent) => ({
                providerType: agent.providerType,
                isConnected: agent.isConnected,
                deviceConnected: agent.deviceConnected ?? null,
                agentVersion: agent.version,
            }));

            return {
                id: ws.id,
                code: ws.code,
                displayName: ws.displayName,
                description: ws.description,
                siteId: ws.siteId,
                machineId: ws.machineId,
                hostname: ws.hostname,
                isActive: ws.isActive,
                defaultCardTemplateId: ws.defaultCardTemplateId,
                defaultCardTemplateName: ws.defaultCardTemplate?.name || null,
                devices,
                assignedUsers: userCountMap.get(ws.id) || 0,
                assignedRoles: roleCountMap.get(ws.id) || 0,
            };
        });

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findById(id: string): Promise<Workstation> {
        const ws = await this.workstationRepo.findOne({ where: { id, isActive: true } });
        if (!ws) throw new NotFoundException('Workstation not found');
        return ws;
    }

    async findByIdWithDetails(id: string): Promise<{
        workstation: Workstation;
        assignedUserIds: string[];
        assignedRoleIds: string[];
        agents: Array<{ id: string; providerType: string; clientId: string; isConnected: boolean; version: string | null }>;
    }> {
        const workstation = await this.findById(id);

        const [users, roles, agents] = await Promise.all([
            this.workstationUserRepo.find({ where: { workstationId: id, isActive: true } }),
            this.workstationRoleRepo.find({ where: { workstationId: id, isActive: true } }),
            this.deviceAgentRepo.find({ where: { workstationId: id, isActive: true, isEnabled: true } }),
        ]);

        return {
            workstation,
            assignedUserIds: users.map((u) => u.userId),
            assignedRoleIds: roles.map((r) => r.roleId),
            agents: agents.map((a) => ({
                id: a.id,
                providerType: a.providerType,
                clientId: a.clientId,
                isConnected: a.isConnected,
                version: a.version,
            })),
        };
    }

    async create(dto: CreateWorkstationDto, userId: string): Promise<Workstation> {
        const existing = await this.workstationRepo.findOne({ where: { code: dto.code } });
        if (existing) throw new ConflictException('Workstation code already exists');

        const workstation = this.workstationRepo.create({
            code: dto.code,
            displayName: dto.displayName,
            description: dto.description || null,
            siteId: dto.siteId || null,
            defaultCardTemplateId: dto.defaultCardTemplateId || null,
            createdBy: userId,
            updatedBy: userId,
        });
        const saved = await this.workstationRepo.save(workstation);

        this.auditService.log({
            userId,
            module: 'workstations',
            action: 'CREATE',
            entity: 'Workstation',
            entityId: saved.id,
            newValue: { code: saved.code, displayName: saved.displayName },
        }).catch(() => { });

        this.logger.log(`Workstation created: ${saved.code} (${saved.id})`);
        return saved;
    }

    async update(id: string, dto: UpdateWorkstationDto, userId: string): Promise<Workstation> {
        const workstation = await this.findById(id);
        const oldValue = { displayName: workstation.displayName, description: workstation.description, siteId: workstation.siteId };

        if (dto.displayName !== undefined) workstation.displayName = dto.displayName;
        if (dto.description !== undefined) workstation.description = dto.description || null;
        if (dto.siteId !== undefined) workstation.siteId = dto.siteId || null;
        if (dto.defaultCardTemplateId !== undefined) workstation.defaultCardTemplateId = dto.defaultCardTemplateId || null;
        if (dto.isActive !== undefined) workstation.isActive = dto.isActive;
        workstation.updatedBy = userId;

        const saved = await this.workstationRepo.save(workstation);

        this.auditService.log({
            userId,
            module: 'workstations',
            action: 'UPDATE',
            entity: 'Workstation',
            entityId: saved.id,
            oldValue,
            newValue: { displayName: saved.displayName, description: saved.description, siteId: saved.siteId },
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, userId: string): Promise<void> {
        const workstation = await this.findById(id);
        workstation.isActive = false;
        workstation.updatedBy = userId;
        await this.workstationRepo.save(workstation);

        this.auditService.log({
            userId,
            module: 'workstations',
            action: 'DELETE',
            entity: 'Workstation',
            entityId: id,
        }).catch(() => { });

        this.logger.log(`Workstation deactivated: ${workstation.code}`);
    }

    // ── User Assignment ──

    async assignUsers(workstationId: string, userIds: string[], adminUserId: string): Promise<void> {
        await this.findById(workstationId);

        // Remove existing assignments
        await this.workstationUserRepo.delete({ workstationId });

        // Create new assignments
        if (userIds.length > 0) {
            const entities = userIds.map((userId) =>
                this.workstationUserRepo.create({
                    workstationId,
                    userId,
                    createdBy: adminUserId,
                }),
            );
            await this.workstationUserRepo.save(entities);
        }

        this.auditService.log({
            userId: adminUserId,
            module: 'workstations',
            action: 'ASSIGN_USERS',
            entity: 'Workstation',
            entityId: workstationId,
            newValue: { userIds },
        }).catch(() => { });
    }

    async getAssignedUsers(workstationId: string): Promise<string[]> {
        const assignments = await this.workstationUserRepo.find({
            where: { workstationId },
        });
        return assignments.map((a) => a.userId);
    }

    // ── Role Assignment ──

    async assignRoles(workstationId: string, roleIds: string[], adminUserId: string): Promise<void> {
        await this.findById(workstationId);

        await this.workstationRoleRepo.delete({ workstationId });

        if (roleIds.length > 0) {
            const entities = roleIds.map((roleId) =>
                this.workstationRoleRepo.create({
                    workstationId,
                    roleId,
                    createdBy: adminUserId,
                }),
            );
            await this.workstationRoleRepo.save(entities);
        }

        this.auditService.log({
            userId: adminUserId,
            module: 'workstations',
            action: 'ASSIGN_ROLES',
            entity: 'Workstation',
            entityId: workstationId,
            newValue: { roleIds },
        }).catch(() => { });
    }

    async getAssignedRoles(workstationId: string): Promise<string[]> {
        const assignments = await this.workstationRoleRepo.find({
            where: { workstationId },
        });
        return assignments.map((a) => a.roleId);
    }

    // ── Workstation Access Check ──

    async canUserAccessWorkstation(userId: string, userRoleIds: string[], workstationId: string): Promise<boolean> {
        // Check direct user assignment
        const userAssignment = await this.workstationUserRepo.findOne({
            where: { workstationId, userId, isActive: true },
        });
        if (userAssignment) return true;

        // Check role-based assignment
        if (userRoleIds.length > 0) {
            const roleAssignment = await this.workstationRoleRepo.findOne({
                where: { workstationId, isActive: true, roleId: In(userRoleIds) },
            });
            if (roleAssignment) return true;
        }

        return false;
    }

    async getAccessibleWorkstations(userId: string, userRoleIds: string[]): Promise<Workstation[]> {
        const directAssignments = await this.workstationUserRepo.find({
            where: { userId, isActive: true },
        });
        const directIds = directAssignments.map((a) => a.workstationId);

        let roleIds: string[] = [];
        if (userRoleIds.length > 0) {
            const roleAssignments = await this.workstationRoleRepo.find({
                where: { isActive: true, roleId: In(userRoleIds) },
            });
            roleIds = roleAssignments.map((a) => a.workstationId);
        }

        const allIds = [...new Set([...directIds, ...roleIds])];
        if (allIds.length === 0) return [];

        return this.workstationRepo.find({
            where: { id: In(allIds), isActive: true },
            order: { displayName: 'ASC' },
        });
    }

    async getAccessibleWorkstationsWithDeviceStatus(
        userId: string,
        userRoleIds: string[],
    ): Promise<Array<{ id: string; code: string; displayName: string; machineId: string | null; hostname: string | null; devices: Array<{ providerType: string; isConnected: boolean }> }>> {
        const workstations = await this.getAccessibleWorkstations(userId, userRoleIds);
        if (workstations.length === 0) return [];

        const wsIds = workstations.map((ws) => ws.id);
        const connectedAgents = await this.deviceAgentRepo.find({
            where: { isConnected: true, isActive: true, isEnabled: true },
        });

        return workstations.map((ws) => {
            const wsAgents = connectedAgents.filter((a) => a.workstationId === ws.id);
            return {
                id: ws.id,
                code: ws.code,
                displayName: ws.displayName,
                machineId: ws.machineId,
                hostname: ws.hostname,
                devices: wsAgents.map((a) => ({
                    providerType: a.providerType,
                    isConnected: true,
                })),
            };
        });
    }

    async getAvailableRoles(): Promise<Array<{ id: string; name: string }>> {
        return this.roleRepo.find({
            where: { isActive: true },
            select: ['id', 'name'],
            order: { name: 'ASC' },
        });
    }

    // ── Enrollment Tokens ──

    async createEnrollmentToken(
        workstationId: string,
        providerType: string,
        adminUserId: string,
    ): Promise<{ token: string; expiresAt: Date }> {
        await this.findById(workstationId);

        // Invalidate any existing unused tokens for this workstation + provider
        await this.enrollmentTokenRepo.update(
            { workstationId, providerType, isUsed: false, isActive: true },
            { isActive: false },
        );

        // Generate a secure random token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + ENROLLMENT_TOKEN_EXPIRY_HOURS);

        const entity = this.enrollmentTokenRepo.create({
            workstationId,
            tokenHash,
            providerType,
            expiresAt,
            createdBy: adminUserId,
        });
        await this.enrollmentTokenRepo.save(entity);

        this.auditService.log({
            userId: adminUserId,
            module: 'workstations',
            action: 'CREATE_ENROLLMENT_TOKEN',
            entity: 'Workstation',
            entityId: workstationId,
            newValue: { providerType, expiresAt: expiresAt.toISOString() },
        }).catch(() => { });

        this.logger.log(`Enrollment token created for workstation ${workstationId} (${providerType})`);
        return { token: rawToken, expiresAt };
    }

    async validateEnrollmentToken(
        rawToken: string,
    ): Promise<{ workstationId: string; providerType: string; tokenId: string } | null> {
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        const tokenRecord = await this.enrollmentTokenRepo.findOne({
            where: { tokenHash, isUsed: false, isActive: true },
        });
        if (!tokenRecord) return null;

        if (tokenRecord.expiresAt < new Date()) {
            this.logger.warn(`Enrollment token expired for workstation ${tokenRecord.workstationId}`);
            return null;
        }

        return {
            workstationId: tokenRecord.workstationId,
            providerType: tokenRecord.providerType,
            tokenId: tokenRecord.id,
        };
    }

    async markEnrollmentTokenUsed(tokenId: string, agentId: string): Promise<void> {
        await this.enrollmentTokenRepo.update(
            { id: tokenId },
            { isUsed: true, usedAt: new Date(), usedByAgentId: agentId },
        );
    }
}
