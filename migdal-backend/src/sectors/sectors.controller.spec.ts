import { Test, TestingModule } from '@nestjs/testing';
import { SectorsController } from './sectors.controller';
import { SectorsService } from './sectors.service';

describe('SectorsController', () => {
    let controller: SectorsController;
    const mockSectorsService = {
        findAll: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SectorsController],
            providers: [
                { provide: SectorsService, useValue: mockSectorsService },
            ],
        }).compile();

        controller = module.get<SectorsController>(SectorsController);
        jest.clearAllMocks();
    });

    it('should return active sectors', async () => {
        const sectors = [{ id: 's1', name: 'Security', isActive: true }];
        mockSectorsService.findAll.mockResolvedValue(sectors);

        const result = await controller.findAll();

        expect(mockSectorsService.findAll).toHaveBeenCalledTimes(1);
        expect(result).toEqual(sectors);
    });
});
