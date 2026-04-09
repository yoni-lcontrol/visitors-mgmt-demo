import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdConfiguration } from './entities/ad-configuration.entity';
import { CreateAdConfigurationDto } from './dto/create-ad-configuration.dto';
import { UpdateAdConfigurationDto } from './dto/update-ad-configuration.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdConfigurationService {
    constructor(
        @InjectRepository(AdConfiguration)
        private readonly repo: Repository<AdConfiguration>,
        private readonly auditService: AuditService,
    ) { }

    private maskSensitive(obj: Record<string, unknown>): Record<string, unknown> {
        const masked = { ...obj };
        if ('password' in masked) masked['password'] = '***';
        if ('bindPassword' in masked) masked['bindPassword'] = '***';
        return masked;
    }

    async findAll(): Promise<AdConfiguration[]> {
        return this.repo.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });
    }

    async findById(id: string): Promise<AdConfiguration> {
        const item = await this.repo.findOne({ where: { id, isActive: true } });
        if (!item) throw new NotFoundException('AD configuration not found');
        return item;
    }

    async create(dto: CreateAdConfigurationDto, currentUserId?: string): Promise<AdConfiguration> {
        const entity = this.repo.create({
            ...dto,
            baseDn: dto.baseDn ?? null,
            port: dto.port ?? 389,
            useSsl: dto.useSsl ?? false,
            description: dto.description ?? null,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });
        const saved = await this.repo.save(entity);

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'CREATE',
            entity: 'AdConfiguration',
            entityId: saved.id,
            description: `Created AD configuration "${saved.name}"`,
            newValue: this.maskSensitive(dto as any),
        }).catch(() => { });

        return saved;
    }

    async update(id: string, dto: UpdateAdConfigurationDto, currentUserId?: string): Promise<AdConfiguration> {
        const entity = await this.findById(id);
        const oldValue = this.maskSensitive({ name: entity.name, domain: entity.domain, ldapUrl: entity.ldapUrl, port: entity.port, useSsl: entity.useSsl, baseDn: entity.baseDn });
        Object.assign(entity, dto, { updatedBy: currentUserId ?? null });
        const saved = await this.repo.save(entity);

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'UPDATE',
            entity: 'AdConfiguration',
            entityId: saved.id,
            description: `Updated AD configuration "${saved.name}"`,
            oldValue,
            newValue: this.maskSensitive(dto as any),
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const entity = await this.findById(id);
        entity.isActive = false;
        entity.updatedBy = currentUserId ?? null;
        await this.repo.save(entity);

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'DELETE',
            entity: 'AdConfiguration',
            entityId: id,
            description: `Deleted AD configuration "${entity.name}"`,
        }).catch(() => { });
    }
}
