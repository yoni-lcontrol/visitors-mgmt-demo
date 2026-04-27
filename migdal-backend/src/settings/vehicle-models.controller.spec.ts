import { Test, TestingModule } from '@nestjs/testing';
import { VehicleModelsController } from './vehicle-models.controller';
import { VehicleModelsService } from './vehicle-models.service';

describe('VehicleModelsController', () => {
    let controller: VehicleModelsController;
    let service: Record<string, jest.Mock>;

    beforeEach(async () => {
        service = {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            getManufacturers: jest.fn(),
            exportToExcel: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [VehicleModelsController],
            providers: [{ provide: VehicleModelsService, useValue: service }],
        }).compile();

        controller = module.get<VehicleModelsController>(VehicleModelsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('should delegate list call to service', async () => {
        service.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

        const result = await controller.findAll({ page: 1, limit: 20 } as any);

        expect(service.findAll).toHaveBeenCalled();
        expect(result.items).toEqual([]);
    });

    it('should delegate manufacturers call to service', async () => {
        service.getManufacturers.mockResolvedValue(['Audi', 'BMW']);

        const result = await controller.getManufacturers();

        expect(service.getManufacturers).toHaveBeenCalled();
        expect(result).toEqual(['Audi', 'BMW']);
    });
});
