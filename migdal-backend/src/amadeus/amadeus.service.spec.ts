import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AmadeusService } from './amadeus.service';
import { AcController } from '../access-control/entities/ac-controller.entity';
import { Door } from '../access-control/entities/door.entity';
import { DoorIo } from '../access-control/entities/door-io.entity';
import { Extension } from '../access-control/entities/extension.entity';
import { ExtensionIo } from '../access-control/entities/extension-io.entity';
import { createMockRepository, createMockQueryBuilder } from '../test-utils/mock.factory';

describe('AmadeusService', () => {
    let service: AmadeusService;
    let controllerRepo: ReturnType<typeof createMockRepository>;
    let doorRepo: ReturnType<typeof createMockRepository>;
    let doorIoRepo: ReturnType<typeof createMockRepository>;
    let extensionRepo: ReturnType<typeof createMockRepository>;
    let extensionIoRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        controllerRepo = createMockRepository();
        doorRepo = createMockRepository();
        doorIoRepo = createMockRepository();
        extensionRepo = createMockRepository();
        extensionIoRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AmadeusService,
                { provide: getRepositoryToken(AcController), useValue: controllerRepo },
                { provide: getRepositoryToken(Door), useValue: doorRepo },
                { provide: getRepositoryToken(DoorIo), useValue: doorIoRepo },
                { provide: getRepositoryToken(Extension), useValue: extensionRepo },
                { provide: getRepositoryToken(ExtensionIo), useValue: extensionIoRepo },
            ],
        }).compile();

        service = module.get<AmadeusService>(AmadeusService);
    });

    describe('getControllers', () => {
        it('should return flat list of controllers with mapped fields', async () => {
            controllerRepo.find.mockResolvedValue([
                { id: 'c1', name: 'Controller 1', externalId: 'ext-c1', isActive: true },
                { id: 'c2', name: 'Controller 2', externalId: null, isActive: false },
            ]);

            const result = await service.getControllers();

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                id: 'c1',
                externalId: 'ext-c1',
                amadeusUid: null,
                name: 'Controller 1',
                isActive: true,
            });
            expect(result[1]).toEqual({
                id: 'c2',
                externalId: null,
                amadeusUid: null,
                name: 'Controller 2',
                isActive: false,
            });
        });

        it('should return empty array when no controllers exist', async () => {
            controllerRepo.find.mockResolvedValue([]);
            const result = await service.getControllers();
            expect(result).toEqual([]);
        });
    });

    describe('getDoors', () => {
        it('should return flat list of doors with controller external ID', async () => {
            doorRepo.find.mockResolvedValue([
                {
                    id: 'd1',
                    name: 'Door 1',
                    externalId: 'ext-d1',
                    controller: { externalId: 'ext-c1' },
                },
                {
                    id: 'd2',
                    name: 'Door 2',
                    externalId: null,
                    controller: null,
                },
            ]);

            const result = await service.getDoors();

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                id: 'd1',
                externalId: 'ext-d1',
                amadeusUid: null,
                name: 'Door 1',
                controllerExternalId: 'ext-c1',
            });
            expect(result[1].controllerExternalId).toBeNull();
        });
    });

    describe('getDoorIos', () => {
        it('should return flat list of door IOs with controller external ID', async () => {
            const mockQb = createMockQueryBuilder([
                {
                    id: 'dio1',
                    name: 'DoorIO 1',
                    externalId: 'ext-dio1',
                    type: 0,
                    door: { controller: { externalId: 'ext-c1' } },
                },
            ]);
            doorIoRepo.createQueryBuilder.mockReturnValue(mockQb);

            const result = await service.getDoorIos();

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'dio1',
                externalId: 'ext-dio1',
                amadeusUid: null,
                name: 'DoorIO 1',
                ioType: '0',
                direction: null,
                controllerExternalId: 'ext-c1',
            });
        });
    });

    describe('getExtensions', () => {
        it('should return flat list of extensions with controller external ID', async () => {
            extensionRepo.find.mockResolvedValue([
                {
                    id: 'e1',
                    name: 'Extension 1',
                    externalId: 'ext-e1',
                    controller: { externalId: 'ext-c1' },
                },
            ]);

            const result = await service.getExtensions();

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'e1',
                externalId: 'ext-e1',
                amadeusUid: null,
                name: 'Extension 1',
                controllerExternalId: 'ext-c1',
            });
        });
    });

    describe('getExtensionIos', () => {
        it('should return flat list of extension IOs with extension and controller external IDs', async () => {
            const mockQb = createMockQueryBuilder([
                {
                    id: 'eio1',
                    name: 'ExtensionIO 1',
                    externalId: 'ext-eio1',
                    type: 1,
                    extension: {
                        externalId: 'ext-e1',
                        controller: { externalId: 'ext-c1' },
                    },
                },
            ]);
            extensionIoRepo.createQueryBuilder.mockReturnValue(mockQb);

            const result = await service.getExtensionIos();

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'eio1',
                externalId: 'ext-eio1',
                amadeusUid: null,
                name: 'ExtensionIO 1',
                ioType: '1',
                direction: null,
                extensionExternalId: 'ext-e1',
                controllerExternalId: 'ext-c1',
            });
        });
    });

    describe('triggerFullSync', () => {
        it('should return sync result with equipment counts', async () => {
            controllerRepo.count.mockResolvedValue(5);
            doorRepo.count.mockResolvedValue(10);
            extensionRepo.count.mockResolvedValue(3);

            const result = await service.triggerFullSync();

            expect(result.success).toBe(true);
            expect(result.operation).toBe('FullStartup');
            expect(result.totalReceived).toBe(18);
            expect(result.unchanged).toBe(18);
            expect(result.startedUtc).toBeDefined();
            expect(result.completedUtc).toBeDefined();
        });

        it('should return zero counts when no equipment exists', async () => {
            controllerRepo.count.mockResolvedValue(0);
            doorRepo.count.mockResolvedValue(0);
            extensionRepo.count.mockResolvedValue(0);

            const result = await service.triggerFullSync();

            expect(result.totalReceived).toBe(0);
            expect(result.unchanged).toBe(0);
        });
    });
});
