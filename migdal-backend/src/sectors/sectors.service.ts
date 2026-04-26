import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sector } from './entities/sector.entity';

@Injectable()
export class SectorsService {
    constructor(
        @InjectRepository(Sector)
        private readonly sectorRepo: Repository<Sector>,
    ) { }

    async findAll(): Promise<Sector[]> {
        return this.sectorRepo.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });
    }

    async findById(id: string): Promise<Sector | null> {
        return this.sectorRepo.findOne({ where: { id, isActive: true } });
    }

    /**
     * Finds or creates a sector by name.
     * Used during AD import to auto-create sectors from the AD "company" attribute.
     */
    async findOrCreateByName(name: string): Promise<Sector> {
        const existing = await this.sectorRepo.findOne({ where: { name } });
        if (existing) {
            if (!existing.isActive) {
                existing.isActive = true;
                return this.sectorRepo.save(existing);
            }
            return existing;
        }

        const sector = this.sectorRepo.create({ name });
        return this.sectorRepo.save(sector);
    }
}
