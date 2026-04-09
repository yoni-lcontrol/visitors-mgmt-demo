import { Test, TestingModule } from '@nestjs/testing';
import { ParkingRequestController } from './parking-request.controller';
import { ParkingRequestService } from './parking-request.service';

describe('ParkingRequestController', () => {
    let controller: ParkingRequestController;
    let service: Record<string, jest.Mock>;

    beforeEach(async () => {
        service = {
            findAll: jest.fn(),
            review: jest.fn(),
            getPendingCount: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [ParkingRequestController],
            providers: [
                { provide: ParkingRequestService, useValue: service },
            ],
        }).compile();

        controller = module.get<ParkingRequestController>(ParkingRequestController);
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
            service.getPendingCount.mockResolvedValue(5);

            const result = await controller.getPendingCount();

            expect(service.getPendingCount).toHaveBeenCalled();
            expect(result).toBe(5);
        });
    });

    describe('review', () => {
        it('should delegate approve to service', async () => {
            const dto = { status: 'approved', reviewNote: 'Looks good' } as any;
            const reviewed = { id: 'req-1', status: 'approved', reviewNote: 'Looks good' };
            service.review.mockResolvedValue(reviewed);

            const result = await controller.review('req-1', dto, 'user-1');

            expect(service.review).toHaveBeenCalledWith('req-1', dto, 'user-1');
            expect(result.status).toBe('approved');
        });

        it('should delegate deny to service', async () => {
            const dto = { status: 'denied', reviewNote: 'No spaces available' } as any;
            const reviewed = { id: 'req-1', status: 'denied' };
            service.review.mockResolvedValue(reviewed);

            const result = await controller.review('req-1', dto, 'user-2');

            expect(service.review).toHaveBeenCalledWith('req-1', dto, 'user-2');
            expect(result.status).toBe('denied');
        });
    });
});
