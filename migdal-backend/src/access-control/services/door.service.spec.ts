import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DoorService } from './door.service';
import { Door } from '../entities/door.entity';
import { AuditService } from '../../audit/audit.service';
import { createMockRepository, createMockAuditService } from '../../test-utils/mock.factory';

describe('DoorService', () => {
    let service: DoorService;
    let mockDoorRepo: ReturnType<typeof createMockRepository>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockDoorRepo = createMockRepository();
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DoorService,
                { provide: getRepositoryToken(Door), useValue: mockDoorRepo },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<DoorService>(DoorService);
    });

    describe('upsertByExternalId', () => {
        it('should create disabled door when disableOnCreate is true and door does not exist', async () => {
            mockDoorRepo.findOne.mockResolvedValue(null);
            mockDoorRepo.create.mockImplementation((e: any) => ({ ...e }));
            mockDoorRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'door-new', ...e }));

            const result = await service.upsertByExternalId(
                {
                    controllerId: 'ctrl-1',
                    name: 'Door A',
                    externalId: 'ext-door-a',
                },
                { disableOnCreate: true },
            );

            expect(result.action).toBe('created');
            expect(mockDoorRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ isActive: false }),
            );
            expect(result.entity.isActive).toBe(false);
        });

        it('should keep existing door active status on update even with disableOnCreate', async () => {
            const existing = {
                id: 'door-1',
                name: 'Door Existing',
                externalId: 'ext-door-1',
                isActive: true,
            };
            mockDoorRepo.findOne.mockResolvedValue(existing);
            mockDoorRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            const result = await service.upsertByExternalId(
                {
                    name: 'Door Existing Updated',
                    externalId: 'ext-door-1',
                },
                { disableOnCreate: true },
            );

            expect(result.action).toBe('updated');
            expect(result.entity.name).toBe('Door Existing Updated');
            expect(result.entity.isActive).toBe(true);
        });

        it('should not force disabled when disableOnCreate is false', async () => {
            mockDoorRepo.findOne.mockResolvedValue(null);
            mockDoorRepo.create.mockImplementation((e: any) => ({ ...e }));
            mockDoorRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'door-new', ...e }));

            await service.upsertByExternalId(
                {
                    controllerId: 'ctrl-1',
                    name: 'Door B',
                    externalId: 'ext-door-b',
                },
                { disableOnCreate: false },
            );

            expect(mockDoorRepo.create).not.toHaveBeenCalledWith(
                expect.objectContaining({ isActive: false }),
            );
        });
    });
});
