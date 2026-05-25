import { Test, TestingModule } from '@nestjs/testing';
import { CardholderService } from './cardholder.service';
import { AccessControlApiService } from './ac-api.service';
import { AuditService } from '../../audit/audit.service';
import { AmadeusSyncQueueService } from '../../amadeus/services/amadeus-sync-queue.service';
import { createMockAuditService } from '../../test-utils/mock.factory';

describe('CardholderService', () => {
    let service: CardholderService;
    let mockAcApi: Record<string, jest.Mock>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;
    let mockSyncQueue: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockAcApi = {
            downloadCardholders: jest.fn().mockResolvedValue({ cardholders: [], totalCount: 0 }),
            getCardholder: jest.fn().mockResolvedValue({ firstName: 'John', lastName: 'Doe', personId: '123' }),
            createCardholder: jest.fn().mockResolvedValue({ success: true, cardholderId: 'ch-1' }),
            updateCardholder: jest.fn().mockResolvedValue({ success: true }),
            deleteCardholder: jest.fn().mockResolvedValue({ success: true }),
            createCardholderBatch: jest.fn().mockResolvedValue({ succeeded: 1, failed: 0, errors: [] }),
            deleteCardholderBatch: jest.fn().mockResolvedValue({ succeeded: 1, failed: 0, errors: [] }),
        };
        mockAuditService = createMockAuditService();
        mockSyncQueue = {
            enqueueAndExecute: jest.fn().mockResolvedValue({ executed: true, queued: false }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CardholderService,
                { provide: AccessControlApiService, useValue: mockAcApi },
                { provide: AuditService, useValue: mockAuditService },
                { provide: AmadeusSyncQueueService, useValue: mockSyncQueue },
            ],
        }).compile();

        service = module.get<CardholderService>(CardholderService);
    });

    describe('findAll', () => {
        it('should pass query params to acApi.downloadCardholders', async () => {
            await service.findAll({ search: 'john', page: 2, limit: 10 });

            expect(mockAcApi.downloadCardholders).toHaveBeenCalledWith({
                search: 'john',
                accessLevelName: undefined,
                isVisitor: undefined,
                active: undefined,
                page: 2,
                limit: 10,
            });
        });
    });

    describe('findOne', () => {
        it('should call acApi.getCardholder', async () => {
            const result = await service.findOne('ch-1');

            expect(mockAcApi.getCardholder).toHaveBeenCalledWith('ch-1');
            expect(result.firstName).toBe('John');
        });
    });

    describe('create', () => {
        it('should create cardholder and audit log', async () => {
            const result = await service.create(
                { firstName: 'Jane', lastName: 'Doe', personId: '456' },
                'user-1',
            );

            expect(mockSyncQueue.enqueueAndExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: expect.objectContaining({
                        firstName: 'Jane',
                        lastName: 'Doe',
                        personId: '456',
                        active: true,
                    }),
                }),
            );
            expect(result.success).toBe(true);
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'CARDHOLDER_CREATE',
                    userId: 'user-1',
                }),
            );
        });
    });

    describe('update', () => {
        it('should update cardholder and audit log', async () => {
            const result = await service.update('ch-1', { firstName: 'Updated' }, 'user-1');

            expect(mockAcApi.updateCardholder).toHaveBeenCalledWith('ch-1', { firstName: 'Updated' });
            expect(result.success).toBe(true);
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'CARDHOLDER_UPDATE',
                    entityId: 'ch-1',
                }),
            );
        });

        it('should only include defined fields', async () => {
            await service.update('ch-1', { firstName: 'A', cardNumber: 'CARD-1' }, 'user-1');

            expect(mockAcApi.updateCardholder).toHaveBeenCalledWith('ch-1', {
                firstName: 'A',
                cardNumber: 'CARD-1',
            });
        });
    });

    describe('remove', () => {
        it('should delete cardholder and audit log', async () => {
            const result = await service.remove('ch-1', 'user-1');

            expect(mockSyncQueue.enqueueAndExecute).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: { amadeusUid: 'ch-1' },
                    cardholderId: 'ch-1',
                }),
            );
            expect(result.success).toBe(true);
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'CARDHOLDER_DELETE',
                    entityId: 'ch-1',
                }),
            );
        });
    });

    describe('createBatch', () => {
        it('should batch create and audit log', async () => {
            const result = await service.createBatch(
                [{ firstName: 'A', lastName: 'B', personId: '1' }],
                'user-1',
            );

            expect(mockAcApi.createCardholderBatch).toHaveBeenCalledWith([
                expect.objectContaining({ firstName: 'A', personId: '1', active: true }),
            ]);
            expect(result.succeeded).toBe(1);
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'CARDHOLDER_BATCH_CREATE' }),
            );
        });
    });

    describe('removeBatch', () => {
        it('should batch delete and audit log', async () => {
            const result = await service.removeBatch(['ch-1', 'ch-2'], 'user-1');

            expect(mockAcApi.deleteCardholderBatch).toHaveBeenCalledWith(['ch-1', 'ch-2']);
            expect(result.succeeded).toBe(1);
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'CARDHOLDER_BATCH_DELETE' }),
            );
        });
    });
});
