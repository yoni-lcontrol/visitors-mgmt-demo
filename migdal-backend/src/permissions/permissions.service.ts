import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Permission } from './entities/permission.entity';

@Injectable()
export class PermissionsService {
    constructor(
        @InjectRepository(Permission)
        private readonly permissionRepo: Repository<Permission>,
    ) { }

    async findAll(): Promise<Permission[]> {
        return this.permissionRepo.find({
            where: { isActive: true },
            order: { module: 'ASC', action: 'ASC' },
        });
    }

    async findById(id: string): Promise<Permission> {
        const perm = await this.permissionRepo.findOne({
            where: { id, isActive: true },
        });
        if (!perm) {
            throw new NotFoundException('Permission not found');
        }
        return perm;
    }

    async findByKeys(keys: string[]): Promise<Permission[]> {
        return this.permissionRepo.findBy({ key: In(keys) });
    }

    async findGroupedByModule(): Promise<Record<string, Permission[]>> {
        const all = await this.findAll();
        const groups: Record<string, Permission[]> = {};
        for (const p of all) {
            (groups[p.module] ??= []).push(p);
        }
        return groups;
    }
}
