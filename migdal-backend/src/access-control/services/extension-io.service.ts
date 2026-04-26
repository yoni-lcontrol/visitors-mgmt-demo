import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtensionIo } from '../entities/extension-io.entity';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class ExtensionIoService {
    constructor(
        @InjectRepository(ExtensionIo)
        private readonly extensionIoRepo: Repository<ExtensionIo>,
        private readonly auditService: AuditService,
    ) { }

    async findByExtension(extensionId: string): Promise<ExtensionIo[]> {
        return this.extensionIoRepo.find({
            where: { extensionId },
            order: { ioIndex: 'ASC' },
        });
    }

    async findById(id: string): Promise<ExtensionIo> {
        const io = await this.extensionIoRepo.findOne({ where: { id } });
        if (!io) throw new NotFoundException('Extension IO not found');
        return io;
    }

    async create(data: Partial<ExtensionIo>, currentUserId?: string): Promise<ExtensionIo> {
        const saved = await this.extensionIoRepo.save(this.extensionIoRepo.create(data));

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CREATE',
            entity: 'ExtensionIo',
            entityId: saved.id,
            description: `Created extension IO "${saved.name}"`,
            newValue: { name: data.name, type: data.type, ioIndex: data.ioIndex, extensionId: data.extensionId },
        }).catch(() => { });

        return saved;
    }

    async update(id: string, data: Partial<ExtensionIo>, currentUserId?: string): Promise<ExtensionIo> {
        const io = await this.findById(id);
        const oldValue = { name: io.name, type: io.type, ioIndex: io.ioIndex, ioState: io.ioState };
        Object.assign(io, data);
        const saved = await this.extensionIoRepo.save(io);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'UPDATE',
            entity: 'ExtensionIo',
            entityId: id,
            description: `Updated extension IO "${saved.name}"`,
            oldValue,
            newValue: data,
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const io = await this.findById(id);
        await this.extensionIoRepo.remove(io);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'DELETE',
            entity: 'ExtensionIo',
            entityId: id,
            description: `Deleted extension IO "${io.name}"`,
        }).catch(() => { });
    }

    async upsertByExternalId(data: Partial<ExtensionIo>): Promise<{ entity: ExtensionIo; action: 'created' | 'updated' }> {
        const { id: _id, ...safeData } = data;
        if (!safeData.externalId) {
            const created = await this.extensionIoRepo.save(this.extensionIoRepo.create(safeData));
            return { entity: created, action: 'created' };
        }
        const existing = await this.extensionIoRepo.findOne({ where: { externalId: safeData.externalId } });
        if (existing) {
            Object.assign(existing, safeData);
            const saved = await this.extensionIoRepo.save(existing);
            return { entity: saved, action: 'updated' };
        }
        const created = await this.extensionIoRepo.save(this.extensionIoRepo.create(safeData));
        return { entity: created, action: 'created' };
    }
}
