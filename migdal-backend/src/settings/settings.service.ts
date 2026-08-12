import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SettingsService {
    constructor(
        @InjectRepository(Setting)
        private readonly settingRepo: Repository<Setting>,
        private readonly wsGateway: UsersGateway,
        private readonly auditService: AuditService,
    ) { }

    async findAll(group?: string): Promise<Setting[]> {
        const where: Record<string, unknown> = { isActive: true };
        if (group) where['group'] = group;
        return this.settingRepo.find({ where, order: { group: 'ASC', key: 'ASC' } });
    }

    async findPublic(): Promise<Setting[]> {
        return this.settingRepo.find({
            where: { isPublic: true, isActive: true },
            order: { group: 'ASC', key: 'ASC' },
        });
    }

    async findByKey(key: string): Promise<Setting> {
        const setting = await this.settingRepo.findOne({
            where: { key, isActive: true },
        });
        if (!setting) throw new NotFoundException(`Setting '${key}' not found`);
        return setting;
    }

    async create(dto: CreateSettingDto, currentUserId?: string): Promise<Setting> {
        const existing = await this.settingRepo.findOne({ where: { key: dto.key } });
        if (existing) throw new ConflictException('Setting key already exists');

        const setting = this.settingRepo.create({
            ...dto,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });
        const saved = await this.settingRepo.save(setting);

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'CREATE',
            entity: 'Setting',
            entityId: saved.key,
            description: `Created setting "${saved.key}"`,
            newValue: { key: saved.key, value: saved.value, group: saved.group },
        }).catch(() => { });

        return saved;
    }

    async update(key: string, dto: UpdateSettingDto, currentUserId?: string): Promise<Setting> {
        const setting = await this.findByKey(key);
        const oldValue = { value: setting.value, description: setting.description };

        if (dto.value !== undefined) {
            this.validateSettingValue(key, dto.value);
        }

        Object.assign(setting, dto, { updatedBy: currentUserId ?? null });
        const saved = await this.settingRepo.save(setting);
        this.wsGateway.broadcastToAll('settings:setting:updated', { key: saved.key, value: saved.value, group: saved.group });

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'UPDATE',
            entity: 'Setting',
            entityId: saved.key,
            description: `Updated setting "${saved.key}"`,
            oldValue,
            newValue: { value: saved.value, description: saved.description },
        }).catch(() => { });

        return saved;
    }

    /** Validates setting values for keys with special constraints. */
    private validateSettingValue(key: string, value: string): void {
        const retentionKeys = ['retention.auditLogsMonths', 'retention.visitsMonths', 'retention.deviceCommandLogsMonths'];
        if (retentionKeys.includes(key)) {
            if (value.trim() === '') {
                throw new BadRequestException('Retention value is required');
            }

            const num = Number(value);
            if (!Number.isFinite(num) || !Number.isInteger(num)) {
                throw new BadRequestException('Retention value must be a positive integer');
            }
            if (num < 1) {
                throw new BadRequestException('Retention value must be at least 1');
            }
            if (num > 120) {
                throw new BadRequestException('Retention value must not exceed 120');
            }
            return;
        }

        if (key === 'visitors.escortPairingWindowSeconds') {
            if (value.trim() === '') {
                throw new BadRequestException('Pairing window value is required');
            }

            const num = Number(value);
            if (!Number.isFinite(num) || !Number.isInteger(num)) {
                throw new BadRequestException('Pairing window value must be a positive integer');
            }
            if (num < 3) {
                throw new BadRequestException('Pairing window must be at least 3 seconds');
            }
            if (num > 60) {
                throw new BadRequestException('Pairing window must not exceed 60 seconds');
            }
        }
    }

    async remove(key: string, currentUserId?: string): Promise<void> {
        const setting = await this.findByKey(key);
        setting.isActive = false;
        setting.updatedBy = currentUserId ?? null;
        await this.settingRepo.save(setting);

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'DELETE',
            entity: 'Setting',
            entityId: key,
            description: `Deleted setting "${key}"`,
        }).catch(() => { });
    }

    async getValue(key: string): Promise<string | null> {
        try {
            const s = await this.findByKey(key);
            return s.value;
        } catch {
            return null;
        }
    }
}
