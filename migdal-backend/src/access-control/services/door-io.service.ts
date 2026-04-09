import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoorIo } from '../entities/door-io.entity';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class DoorIoService {
    constructor(
        @InjectRepository(DoorIo)
        private readonly doorIoRepo: Repository<DoorIo>,
        private readonly auditService: AuditService,
    ) { }

    async findByDoor(doorId: string): Promise<DoorIo[]> {
        return this.doorIoRepo.find({
            where: { doorId },
            order: { ioIndex: 'ASC' },
        });
    }

    async findById(id: string): Promise<DoorIo> {
        const io = await this.doorIoRepo.findOne({ where: { id } });
        if (!io) throw new NotFoundException('Door IO not found');
        return io;
    }

    async create(data: Partial<DoorIo>, currentUserId?: string): Promise<DoorIo> {
        const saved = await this.doorIoRepo.save(this.doorIoRepo.create(data));

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'CREATE',
            entity: 'DoorIo',
            entityId: saved.id,
            description: `Created door IO "${saved.name}"`,
            newValue: { name: data.name, type: data.type, ioIndex: data.ioIndex, doorId: data.doorId },
        }).catch(() => { });

        return saved;
    }

    async update(id: string, data: Partial<DoorIo>, currentUserId?: string): Promise<DoorIo> {
        const io = await this.findById(id);
        const oldValue = { name: io.name, type: io.type, ioIndex: io.ioIndex, ioState: io.ioState };
        Object.assign(io, data);
        const saved = await this.doorIoRepo.save(io);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'UPDATE',
            entity: 'DoorIo',
            entityId: id,
            description: `Updated door IO "${saved.name}"`,
            oldValue,
            newValue: data,
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const io = await this.findById(id);
        await this.doorIoRepo.remove(io);

        this.auditService.log({
            userId: currentUserId,
            module: 'access-control',
            action: 'DELETE',
            entity: 'DoorIo',
            entityId: id,
            description: `Deleted door IO "${io.name}"`,
        }).catch(() => { });
    }
}
