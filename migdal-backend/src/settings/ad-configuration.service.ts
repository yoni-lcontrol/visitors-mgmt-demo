import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from 'ldapts';
import { AdConfiguration } from './entities/ad-configuration.entity';
import { CreateAdConfigurationDto } from './dto/create-ad-configuration.dto';
import { UpdateAdConfigurationDto } from './dto/update-ad-configuration.dto';
import { AuditService } from '../audit/audit.service';

export interface TestConnectionResult {
    success: boolean;
    message: string;
    url?: string;
    bindDn?: string;
    baseDn?: string;
    usersFound?: number;
}

export interface AdConfigurationResponse {
    id: string;
    name: string;
    domain: string;
    ldapUrl: string;
    baseDn: string | null;
    username: string;
    password: string;
    port: number;
    useSsl: boolean;
    description: string | null;
    targetGroups: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    updatedBy: string | null;
}

@Injectable()
export class AdConfigurationService {
    private readonly logger = new Logger(AdConfigurationService.name);

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

    async findAll(): Promise<AdConfigurationResponse[]> {
        const items = await this.repo.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });
        return items.map((item) => this.toResponse(item));
    }

    async findById(id: string): Promise<AdConfigurationResponse> {
        const item = await this.findEntityById(id);
        return this.toResponse(item);
    }

    private async findEntityById(id: string): Promise<AdConfiguration> {
        const item = await this.repo.findOne({ where: { id, isActive: true } });
        if (!item) throw new NotFoundException('AD configuration not found');
        return item;
    }

    async create(dto: CreateAdConfigurationDto, currentUserId?: string): Promise<AdConfigurationResponse> {
        const entity = this.repo.create({
            ...dto,
            baseDn: dto.baseDn || null,
            port: dto.port ?? 389,
            useSsl: dto.useSsl ?? false,
            description: dto.description ?? null,
            targetGroupsJson: this.serializeTargetGroups(dto.targetGroups),
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

        return this.toResponse(saved);
    }

    async update(id: string, dto: UpdateAdConfigurationDto, currentUserId?: string): Promise<AdConfigurationResponse> {
        const entity = await this.findEntityById(id);
        const oldValue = this.maskSensitive({
            name: entity.name,
            domain: entity.domain,
            ldapUrl: entity.ldapUrl,
            port: entity.port,
            useSsl: entity.useSsl,
            baseDn: entity.baseDn,
            targetGroups: this.parseTargetGroups(entity.targetGroupsJson),
        });
        const normalized = { ...dto };
        if ('baseDn' in normalized) {
            (normalized as any).baseDn = normalized.baseDn || null;
        }
        Object.assign(entity, normalized, { updatedBy: currentUserId ?? null });
        if ('targetGroups' in dto) {
            entity.targetGroupsJson = this.serializeTargetGroups(dto.targetGroups);
        }
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

        return this.toResponse(saved);
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const entity = await this.findEntityById(id);
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

    async testConnection(id: string): Promise<TestConnectionResult> {
        const config = await this.findEntityById(id);

        const url = this.buildLdapUrl(config);
        const bindDn = config.username.includes('@') || config.username.includes('\\')
            ? config.username
            : `${config.username}@${config.domain}`;
        const baseDn = config.baseDn || `DC=${config.domain.split('.').join(',DC=')}`;

        const client = new Client({
            url,
            tlsOptions: config.useSsl ? { rejectUnauthorized: false } : undefined,
            connectTimeout: 10_000,
        });

        try {
            this.logger.log(`Testing AD connection "${config.name}" → url=${url}, bindDn=${bindDn}, baseDn=${baseDn}, username="${config.username}", domain="${config.domain}"`);
            await client.bind(bindDn, config.password);

            // Try a small search to verify baseDn works
            const { searchEntries } = await client.search(baseDn, {
                scope: 'sub',
                filter: '(&(objectClass=user)(objectCategory=person))',
                attributes: ['sAMAccountName'],
                sizeLimit: 5,
                timeLimit: 10,
            });

            return {
                success: true,
                message: `Connection successful. Found ${searchEntries.length}+ users in AD.`,
                url,
                bindDn,
                baseDn,
                usersFound: searchEntries.length,
            };
        } catch (err) {
            const msg = (err as Error).message ?? 'Unknown error';
            this.logger.error(`AD test connection failed for "${config.name}": ${msg}`);
            return {
                success: false,
                message: msg,
                url,
                bindDn,
                baseDn,
            };
        } finally {
            try { await client.unbind(); } catch { /* ignore */ }
        }
    }

    private buildLdapUrl(config: AdConfiguration): string {
        if (config.useSsl) {
            const rawUrl = config.ldapUrl.startsWith('ldap')
                ? config.ldapUrl
                : `ldap://${config.ldapUrl}`;
            const hostname = new URL(rawUrl).hostname;
            return `ldaps://${hostname}:${config.port}`;
        }
        const port = config.port || 389;
        if (config.ldapUrl.includes('://')) {
            // If URL already has protocol, ensure port is correct
            try {
                const parsed = new URL(config.ldapUrl);
                return `${parsed.protocol}//${parsed.hostname}:${port}`;
            } catch {
                return `ldap://${config.ldapUrl}:${port}`;
            }
        }
        return `ldap://${config.ldapUrl}:${port}`;
    }

    private parseTargetGroups(raw: string | null): string[] {
        if (!raw) {
            return [];
        }

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                return [];
            }

            return this.normalizeTargetGroups(parsed);
        } catch {
            return [];
        }
    }

    private normalizeTargetGroups(groups: unknown[] | undefined): string[] {
        if (!groups?.length) {
            return [];
        }

        const unique = new Map<string, string>();
        for (const group of groups) {
            const normalized = String(group ?? '').trim();
            if (!normalized) {
                continue;
            }

            const dedupeKey = normalized.toLowerCase();
            if (!unique.has(dedupeKey)) {
                unique.set(dedupeKey, normalized);
            }
        }

        return [...unique.values()];
    }

    private serializeTargetGroups(groups: string[] | undefined): string | null {
        const normalized = this.normalizeTargetGroups(groups as unknown[] | undefined);
        return normalized.length ? JSON.stringify(normalized) : null;
    }

    private toResponse(entity: AdConfiguration): AdConfigurationResponse {
        return {
            id: entity.id,
            name: entity.name,
            domain: entity.domain,
            ldapUrl: entity.ldapUrl,
            baseDn: entity.baseDn,
            username: entity.username,
            password: entity.password,
            port: entity.port,
            useSsl: entity.useSsl,
            description: entity.description,
            targetGroups: this.parseTargetGroups(entity.targetGroupsJson),
            isActive: entity.isActive,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            createdBy: entity.createdBy,
            updatedBy: entity.updatedBy,
        };
    }
}
