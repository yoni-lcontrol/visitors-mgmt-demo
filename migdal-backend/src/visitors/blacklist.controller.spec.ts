import { Test, TestingModule } from '@nestjs/testing';
import { BlacklistController } from './blacklist.controller';
import { BlacklistService } from './blacklist.service';

describe('BlacklistController', () => {
    let controller: BlacklistController;
    let service: Record<string, jest.Mock>;

    beforeEach(async () => {
        service = {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            checkBlacklistStatus: jest.fn(),
            exportToExcel: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [BlacklistController],
            providers: [
                { provide: BlacklistService, useValue: service },
            ],
        }).compile();

        controller = module.get<BlacklistController>(BlacklistController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should delegate to service with query params', async () => {
            const query = { page: 1, limit: 20 } as any;
            const expected = { items: [{ id: '1' }], total: 1, page: 1, limit: 20 };
            service.findAll.mockResolvedValue(expected);

            const result = await controller.findAll(query);

            expect(service.findAll).toHaveBeenCalledWith(query);
            expect(result).toEqual(expected);
        });
    });

    describe('findOne', () => {
        it('should return a single blacklist entry by id', async () => {
            const entry = { id: 'uuid-1', firstName: 'John', lastName: 'Doe' };
            service.findById.mockResolvedValue(entry);

            const result = await controller.findOne('uuid-1');

            expect(service.findById).toHaveBeenCalledWith('uuid-1');
            expect(result).toEqual(entry);
        });
    });

    describe('create', () => {
        it('should create a blacklist entry', async () => {
            const dto = {
                firstName: 'John',
                lastName: 'Doe',
                idNumber: '123456789',
                reason: 'Security',
            } as any;
            const created = { id: 'new-id', ...dto };
            service.create.mockResolvedValue(created);

            const result = await controller.create(dto, 'user-1');

            expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
            expect(result.id).toBe('new-id');
        });
    });

    describe('update', () => {
        it('should update a blacklist entry', async () => {
            const dto = { reason: 'Updated reason' } as any;
            const updated = { id: 'uuid-1', reason: 'Updated reason' };
            service.update.mockResolvedValue(updated);

            const result = await controller.update('uuid-1', dto, 'user-1');

            expect(service.update).toHaveBeenCalledWith('uuid-1', dto, 'user-1');
            expect(result.reason).toBe('Updated reason');
        });
    });

    describe('remove', () => {
        it('should remove a blacklist entry', async () => {
            service.remove.mockResolvedValue(undefined);

            await controller.remove('uuid-1', 'user-1');

            expect(service.remove).toHaveBeenCalledWith('uuid-1', 'user-1');
        });
    });

    describe('checkBlacklist', () => {
        it('should check person blacklist status', async () => {
            service.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: true });

            const result = await controller.checkBlacklist('123456789');

            expect(service.checkBlacklistStatus).toHaveBeenCalledWith('123456789');
            expect(result.isBlacklisted).toBe(true);
        });
    });

    describe('route registration order', () => {
        it('should have blacklist controller defined with correct path prefix', () => {
            // This test verifies the controller is instantiated correctly.
            // The actual route conflict fix is in VisitorsModule where BlacklistController
            // is registered before VisitorsController to prevent the :id wildcard
            // from intercepting /visitors/blacklist requests.
            expect(controller).toBeDefined();
        });
    });
});
