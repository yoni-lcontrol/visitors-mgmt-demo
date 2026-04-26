import {
    Injectable,
    BadRequestException,
    ConflictException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AdGroupRoleMapping } from './entities/ad-group-role-mapping.entity';
import { CreateAdGroupRoleMappingDto } from './dto/create-ad-group-role-mapping.dto';
import { UpdateAdGroupRoleMappingDto } from './dto/update-ad-group-role-mapping.dto';
import { Role } from '../roles/entities/role.entity';
import { AuditService } from '../audit/audit.service';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';

@Injectable()
export class AdGroupRoleMappingsService {
    private readonly logger = new Logger(AdGroupRoleMappingsService.name);

    constructor(
        @InjectRepository(AdGroupRoleMapping)
        private readonly mappingRepo: Repository<AdGroupRoleMapping>,
        @InjectRepository(Role)
        private readonly roleRepo: Repository<Role>,
        @InjectRepository(AdConfiguration)
        private readonly adConfigRepo: Repository<AdConfiguration>,
        private readonly auditService: AuditService,
    ) { }

    async findAll(): Promise<AdGroupRoleMapping[]> {
        return this.mappingRepo.find({
            relations: ['role', 'adSource'],
            order: { adSourceId: 'ASC', groupName: 'ASC' },
        });
    }

    async create(dto: CreateAdGroupRoleMappingDto, currentUserId?: string): Promise<AdGroupRoleMapping> {
        const normalizedGroupName = dto.groupName.trim();
        const normalizedAdSourceId = this.normalizeOptional(dto.adSourceId);
        const normalizedGroupExternalId = this.normalizeOptional(dto.groupExternalId);

        if (!normalizedGroupName) {
            throw new BadRequestException('groupName is required');
        }

        await this.assertRoleExists(dto.roleId);
        await this.assertAdSourceExists(normalizedAdSourceId);

        const existingByName = await this.mappingRepo.findOne({
            where: {
                adSourceId: normalizedAdSourceId ?? IsNull(),
                groupName: normalizedGroupName,
            },
        });

        if (existingByName) {
            throw new ConflictException('AD group mapping already exists for this groupName');
        }

        if (normalizedGroupExternalId) {
            const existingByExternalId = await this.mappingRepo.findOne({
                where: {
                    adSourceId: normalizedAdSourceId ?? IsNull(),
                    groupExternalId: normalizedGroupExternalId,
                },
            });

            if (existingByExternalId) {
                throw new ConflictException('AD group mapping already exists for this groupExternalId');
            }
        }

        const mapping = this.mappingRepo.create({
            groupName: normalizedGroupName,
            roleId: dto.roleId,
            adSourceId: normalizedAdSourceId,
            groupExternalId: normalizedGroupExternalId,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });

        const saved = await this.mappingRepo.save(mapping);

        this.auditService.log({
            userId: currentUserId,
            module: 'ad-group-role-mappings',
            action: 'CREATE',
            entity: 'AdGroupRoleMapping',
            entityId: String(saved.id),
            description: `Created AD group mapping for ${normalizedGroupName}`,
            newValue: {
                groupName: normalizedGroupName,
                roleId: dto.roleId,
                adSourceId: normalizedAdSourceId,
                groupExternalId: normalizedGroupExternalId,
            },
        }).catch(() => { });

        this.logger.log(`Created AD group mapping: ${normalizedGroupName} -> ${dto.roleId}`);
        return this.findById(saved.id);
    }

    async update(id: number, dto: UpdateAdGroupRoleMappingDto, currentUserId?: string): Promise<AdGroupRoleMapping> {
        const existing = await this.findById(id);
        const normalizedGroupName = dto.groupName !== undefined ? dto.groupName.trim() : existing.groupName;
        const normalizedAdSourceId = dto.adSourceId !== undefined
            ? this.normalizeOptional(dto.adSourceId)
            : existing.adSourceId;
        const normalizedGroupExternalId = dto.groupExternalId !== undefined
            ? this.normalizeOptional(dto.groupExternalId)
            : existing.groupExternalId;

        if (dto.roleId !== undefined) {
            await this.assertRoleExists(dto.roleId);
        }

        await this.assertAdSourceExists(normalizedAdSourceId);

        if (dto.groupName !== undefined) {
            if (!normalizedGroupName) {
                throw new BadRequestException('groupName is required');
            }
        }

        const duplicateByName = await this.mappingRepo.findOne({
            where: {
                adSourceId: normalizedAdSourceId ?? IsNull(),
                groupName: normalizedGroupName,
            },
        });
        if (duplicateByName && duplicateByName.id !== id) {
            throw new ConflictException('AD group mapping already exists for this groupName');
        }

        if (normalizedGroupExternalId) {
            const duplicateByExternalId = await this.mappingRepo.findOne({
                where: {
                    adSourceId: normalizedAdSourceId ?? IsNull(),
                    groupExternalId: normalizedGroupExternalId,
                },
            });
            if (duplicateByExternalId && duplicateByExternalId.id !== id) {
                throw new ConflictException('AD group mapping already exists for this groupExternalId');
            }
        }

        existing.groupName = normalizedGroupName;
        existing.adSourceId = normalizedAdSourceId;
        existing.groupExternalId = normalizedGroupExternalId;

        if (dto.roleId !== undefined) {
            existing.roleId = dto.roleId;
        }

        existing.updatedBy = currentUserId ?? null;

        const saved = await this.mappingRepo.save(existing);

        this.auditService.log({
            userId: currentUserId,
            module: 'ad-group-role-mappings',
            action: 'UPDATE',
            entity: 'AdGroupRoleMapping',
            entityId: String(id),
            description: `Updated AD group mapping ${id}`,
            newValue: dto,
        }).catch(() => { });

        this.logger.log(`Updated AD group mapping id=${id}`);
        return this.findById(saved.id);
    }

    async remove(id: number, currentUserId?: string): Promise<void> {
        const existing = await this.findById(id);

        await this.mappingRepo.remove(existing);

        this.auditService.log({
            userId: currentUserId,
            module: 'ad-group-role-mappings',
            action: 'DELETE',
            entity: 'AdGroupRoleMapping',
            entityId: String(id),
            description: `Deleted AD group mapping ${id}`,
            oldValue: { groupName: existing.groupName, roleId: existing.roleId },
        }).catch(() => { });

        this.logger.log(`Deleted AD group mapping id=${id}`);
    }

    async findById(id: number): Promise<AdGroupRoleMapping> {
        const mapping = await this.mappingRepo.findOne({
            where: { id },
            relations: ['role', 'adSource'],
        });

        if (!mapping) {
            throw new NotFoundException('AD group-role mapping not found');
        }

        return mapping;
    }

    private async assertRoleExists(roleId: string): Promise<void> {
        const role = await this.roleRepo.findOne({ where: { id: roleId, isActive: true } });
        if (!role) {
            throw new BadRequestException('roleId does not exist');
        }
    }

    private async assertAdSourceExists(adSourceId: string | null): Promise<void> {
        if (!adSourceId) {
            return;
        }

        const source = await this.adConfigRepo.findOne({ where: { id: adSourceId, isActive: true } });
        if (!source) {
            throw new BadRequestException('adSourceId does not exist');
        }
    }

    private normalizeOptional(value: string | undefined): string | null {
        const normalized = value?.trim();
        return normalized ? normalized : null;
    }
}
