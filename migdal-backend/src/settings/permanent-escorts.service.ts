import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Sector } from '../sectors/entities/sector.entity';
import { PermanentEscort } from './entities/permanent-escort.entity';
import { AddPermanentEscortDto } from './dto/add-permanent-escort.dto';
import { AuditService } from '../audit/audit.service';

type DomainLookupItem = {
    id: string;
    name: string;
};

type DomainUserLookupItem = {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

type PermanentEscortItem = {
    id: string;
    userId: string;
    fullName: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    domain: { id: string; name: string } | null;
    createdAt: Date;
    updatedAt: Date;
};

@Injectable()
export class PermanentEscortsService {
    constructor(
        @InjectRepository(PermanentEscort)
        private readonly permanentEscortRepo: Repository<PermanentEscort>,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Sector)
        private readonly sectorRepo: Repository<Sector>,
        private readonly auditService: AuditService,
    ) { }

    async getAll(): Promise<PermanentEscortItem[]> {
        const rows = await this.permanentEscortRepo.find({
            relations: ['user', 'user.sector'],
            order: { createdAt: 'DESC' },
        });

        return rows.map((row) => ({
            id: row.id,
            userId: row.userId,
            fullName: `${row.user.firstName} ${row.user.lastName}`.trim(),
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            username: row.user.username,
            email: row.user.email,
            phone: row.user.phone,
            isActive: row.user.isActive,
            domain: row.user.sector ? { id: row.user.sector.id, name: row.user.sector.name } : null,
            createdAt: row.user.createdAt,
            updatedAt: row.user.updatedAt,
        }));
    }

    async getDomains(): Promise<DomainLookupItem[]> {
        const domains = await this.sectorRepo.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });

        return domains.map((domain) => ({ id: domain.id, name: domain.name }));
    }

    async getUsersByDomain(domainId: string): Promise<DomainUserLookupItem[]> {
        const domain = await this.sectorRepo.findOne({ where: { id: domainId, isActive: true } });
        if (!domain) {
            throw new NotFoundException('Domain not found');
        }

        const users = await this.userRepo.find({
            where: { sectorId: domainId, isActive: true },
            order: { firstName: 'ASC', lastName: 'ASC' },
        });

        return users.map((user) => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            email: user.email,
            isActive: user.isActive,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        }));
    }

    async add(dto: AddPermanentEscortDto, currentUserId?: string): Promise<PermanentEscortItem> {
        if (!dto.domainId) {
            throw new BadRequestException('domainId is required');
        }

        if (!dto.userId) {
            throw new BadRequestException('userId is required');
        }

        const domain = await this.sectorRepo.findOne({ where: { id: dto.domainId, isActive: true } });
        if (!domain) {
            throw new NotFoundException('Domain not found');
        }

        const user = await this.userRepo.findOne({
            where: { id: dto.userId },
            relations: ['sector'],
        });

        if (!user || !user.isActive) {
            throw new NotFoundException('User not found');
        }

        if (!user.sectorId || user.sectorId !== dto.domainId) {
            throw new BadRequestException('Selected user is not assigned to the selected domain');
        }

        const existing = await this.permanentEscortRepo.findOne({ where: { userId: dto.userId } });
        if (existing) {
            throw new ConflictException('User is already a permanent escort');
        }

        await this.permanentEscortRepo.save(this.permanentEscortRepo.create({ userId: dto.userId }));

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'ADD_PERMANENT_ESCORT',
            entity: 'PermanentEscort',
            entityId: dto.userId,
            description: `Added permanent escort ${user.username}`,
            newValue: { userId: dto.userId, domainId: dto.domainId },
        }).catch(() => { });

        const updated = await this.getAll();
        const item = updated.find((row) => row.userId === dto.userId);
        if (!item) {
            throw new NotFoundException('Permanent escort was created but could not be loaded');
        }

        return item;
    }

    async remove(userId: string, currentUserId?: string): Promise<void> {
        const existing = await this.permanentEscortRepo.findOne({
            where: { userId },
            relations: ['user'],
        });

        if (!existing) {
            throw new NotFoundException('Permanent escort not found');
        }

        await this.permanentEscortRepo.remove(existing);

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'REMOVE_PERMANENT_ESCORT',
            entity: 'PermanentEscort',
            entityId: userId,
            description: `Removed permanent escort ${existing.user?.username ?? userId}`,
            oldValue: { userId },
        }).catch(() => { });
    }
}
