import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { createMockQueryBuilder, createMockRepository } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';
import { VehicleManufacturer } from './entities/vehicle-manufacturer.entity';
import { VehicleModel } from './entities/vehicle-model.entity';
import { VehicleModelsService } from './vehicle-models.service';

describe('VehicleModelsService', () => {
    let service: VehicleModelsService;
    let vehicleModelRepo: ReturnType<typeof createMockRepository>;
    let manufacturerRepo: ReturnType<typeof createMockRepository>;
    let auditService: { log: jest.Mock };

    beforeEach(async () => {
        vehicleModelRepo = createMockRepository();
        manufacturerRepo = createMockRepository();
        auditService = { log: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VehicleModelsService,
                { provide: getRepositoryToken(VehicleModel), useValue: vehicleModelRepo },
                { provide: getRepositoryToken(VehicleManufacturer), useValue: manufacturerRepo },
                { provide: AuditService, useValue: auditService },
            ],
        }).compile();

        service = module.get<VehicleModelsService>(VehicleModelsService);
    });

    it('findAll should return paginated records', async () => {
        const qb = createMockQueryBuilder([
            { id: '1', manufacturer: 'Toyota', model: 'Corolla' },
        ], 1);
        vehicleModelRepo.createQueryBuilder.mockReturnValue(qb);

        const result = await service.findAll({ page: 1, limit: 10 } as any);

        expect(result.total).toBe(1);
        expect(result.items[0].model).toBe('Corolla');
    });

    it('getManufacturers should return ordered manufacturer names', async () => {
        manufacturerRepo.find.mockResolvedValue([{ name: 'Audi' }, { name: 'BMW' }]);

        const result = await service.getManufacturers();

        expect(manufacturerRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
        expect(result).toEqual(['Audi', 'BMW']);
    });

    it('findById should throw when missing', async () => {
        vehicleModelRepo.findOne.mockResolvedValue(null);

        await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('create should validate manufacturer and prevent duplicates', async () => {
        manufacturerRepo.findOne.mockResolvedValue({ name: 'Toyota' });
        vehicleModelRepo.findOne.mockResolvedValue({ id: 'existing' });

        await expect(service.create({ manufacturer: 'Toyota', model: 'Corolla' }, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('create should fail when manufacturer is not seeded', async () => {
        manufacturerRepo.findOne.mockResolvedValue(null);

        await expect(service.create({ manufacturer: 'Unknown', model: 'X' }, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('create should persist and audit', async () => {
        manufacturerRepo.findOne.mockResolvedValue({ name: 'Toyota' });
        vehicleModelRepo.findOne.mockResolvedValue(null);
        vehicleModelRepo.save.mockResolvedValue({ id: '1', manufacturer: 'Toyota', model: 'Corolla' });

        const result = await service.create({ manufacturer: 'Toyota', model: 'Corolla' }, 'user-1');

        expect(result.id).toBe('1');
        expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE', entity: 'VehicleModel' }));
    });

    it('update should throw when duplicate combination exists', async () => {
        vehicleModelRepo.findOne.mockResolvedValue({ id: '1', manufacturer: 'Toyota', model: 'Yaris' });
        manufacturerRepo.findOne.mockResolvedValue({ name: 'Toyota' });

        const qb = createMockQueryBuilder([{ id: '2', manufacturer: 'Toyota', model: 'Corolla' }], 1);
        vehicleModelRepo.createQueryBuilder.mockReturnValue(qb);

        await expect(service.update('1', { manufacturer: 'Toyota', model: 'Corolla' }, 'user-1')).rejects.toThrow(ConflictException);
    });

    it('remove should delete and audit', async () => {
        vehicleModelRepo.findOne.mockResolvedValue({ id: '1', manufacturer: 'Toyota', model: 'Corolla' });

        await service.remove('1', 'user-1');

        expect(vehicleModelRepo.delete).toHaveBeenCalledWith({ id: '1' });
        expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', entity: 'VehicleModel' }));
    });
});
