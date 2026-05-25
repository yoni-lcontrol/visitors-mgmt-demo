import { Test, TestingModule } from '@nestjs/testing';
import { BlacklistOverrideController } from './blacklist-override.controller';
import { BlacklistOverrideService } from './blacklist-override.service';

describe('BlacklistOverrideController', () => {
    let controller: BlacklistOverrideController;
    let service: Record<string, jest.Mock>;

    beforeEach(async () => {
        service = {
            findAll: jest.fn(),
            review: jest.fn(),
            getPendingCount: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [BlacklistOverrideController],
            providers: [
                { provide: BlacklistOverrideService, useValue: service },
            ],
        }).compile();

        controller = module.get<BlacklistOverrideController>(BlacklistOverrideController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should delegate to service with query', async () => {
            const query = { page: 1, limit: 20, status: 'pending' } as any;
            const expected = { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
            service.findAll.mockResolvedValue(expected);

            const result = await controller.findAll(query);

            expect(service.findAll).toHaveBeenCalledWith(query);
            expect(result).toEqual(expected);
        });
    });

    describe('getPendingCount', () => {
        it('should return pending count', async () => {
            service.getPendingCount.mockResolvedValue(3);

            const result = await controller.getPendingCount();

            expect(service.getPendingCount).toHaveBeenCalled();
            expect(result).toBe(3);
        });
    });

    describe('review', () => {
        it('should delegate approve to service', async () => {
            const dto = { status: 'approved', reviewNote: 'Security approved' } as any;
            const reviewed = { id: 'bor-1', status: 'approved', reviewNote: 'Security approved' };
            service.review.mockResolvedValue(reviewed);

            const result = await controller.review('bor-1', dto, 'user-1');

            expect(service.review).toHaveBeenCalledWith('bor-1', dto, 'user-1');
            expect(result).toEqual(reviewed);
        });

        it('should delegate deny to service', async () => {
            const dto = { status: 'denied', reviewNote: 'Not allowed' } as any;
            const reviewed = { id: 'bor-1', status: 'denied' };
            service.review.mockResolvedValue(reviewed);

            const result = await controller.review('bor-1', dto, 'user-1');

            expect(service.review).toHaveBeenCalledWith('bor-1', dto, 'user-1');
            expect(result).toEqual(reviewed);
        });
    });
});
