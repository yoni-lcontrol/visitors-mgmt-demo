import { Test, TestingModule } from '@nestjs/testing';
import { ImportService } from './import.service';
import { AcControllerService } from './ac-controller.service';
import { DoorService } from './door.service';
import { ExtensionService } from './extension.service';
import { DoorIoService } from './door-io.service';
import { ExtensionIoService } from './extension-io.service';
import { AccessLevelService } from './access-level.service';
import { AccessControlApiService } from './ac-api.service';
import { AuditService } from '../../audit/audit.service';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { createMockAuditService } from '../../test-utils/mock.factory';

describe('ImportService', () => {
    let service: ImportService;
    let mockAcApiService: any;
    let mockControllerService: any;
    let mockDoorService: any;
    let mockExtensionService: any;
    let mockDoorIoService: any;
    let mockExtensionIoService: any;
    let mockAccessLevelService: any;
    let mockAuditService: ReturnType<typeof createMockAuditService>;
    let mockUsersGateway: any;

    beforeEach(async () => {
        mockAcApiService = {
            triggerFullImport: jest.fn().mockResolvedValue({ controllers: [] }),
            triggerAccessLevelImport: jest.fn().mockResolvedValue({ accessLevels: [] }),
        };
        mockControllerService = { create: jest.fn().mockResolvedValue({ id: 'ctrl-1' }), upsertByExternalId: jest.fn().mockResolvedValue({ entity: { id: 'ctrl-1' }, action: 'created' }) };
        mockDoorService = { create: jest.fn().mockResolvedValue({ id: 'door-1' }), upsertByExternalId: jest.fn().mockResolvedValue({ entity: { id: 'door-1' }, action: 'created' }) };
        mockExtensionService = { create: jest.fn().mockResolvedValue({ id: 'ext-1' }), upsertByExternalId: jest.fn().mockResolvedValue({ entity: { id: 'ext-1' }, action: 'created' }) };
        mockDoorIoService = { create: jest.fn().mockResolvedValue({ id: 'dio-1' }), upsertByExternalId: jest.fn().mockResolvedValue({ entity: { id: 'dio-1' }, action: 'created' }) };
        mockExtensionIoService = { create: jest.fn().mockResolvedValue({ id: 'eio-1' }), upsertByExternalId: jest.fn().mockResolvedValue({ entity: { id: 'eio-1' }, action: 'created' }) };
        mockAccessLevelService = { create: jest.fn().mockResolvedValue({ id: 'al-1' }), upsertByExternalId: jest.fn().mockResolvedValue({ entity: { id: 'al-1' }, action: 'created' }) };
        mockAuditService = createMockAuditService();
        mockUsersGateway = { broadcastToAll: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ImportService,
                { provide: AccessControlApiService, useValue: mockAcApiService },
                { provide: AcControllerService, useValue: mockControllerService },
                { provide: DoorService, useValue: mockDoorService },
                { provide: ExtensionService, useValue: mockExtensionService },
                { provide: DoorIoService, useValue: mockDoorIoService },
                { provide: ExtensionIoService, useValue: mockExtensionIoService },
                { provide: AccessLevelService, useValue: mockAccessLevelService },
                { provide: AuditService, useValue: mockAuditService },
                { provide: UsersGateway, useValue: mockUsersGateway },
            ],
        }).compile();

        service = module.get<ImportService>(ImportService);
    });

    describe('triggerRemoteImport', () => {
        it('should call triggerFullImport and process the returned payload', async () => {
            mockAcApiService.triggerFullImport.mockResolvedValue({
                controllers: [{ name: 'Imported Controller' }],
            });

            const result = await service.triggerRemoteImport();

            expect(mockAcApiService.triggerFullImport).toHaveBeenCalledTimes(1);
            expect(result.created).toBe(1);
            expect(result.updated).toBe(0);
            expect(result.items).toHaveLength(1);
            expect(result.items[0].name).toBe('Imported Controller');
            expect(mockControllerService.upsertByExternalId).toHaveBeenCalled();
        });

        it('should broadcast progress events during import', async () => {
            mockAcApiService.triggerFullImport.mockResolvedValue({
                controllers: [{ name: 'Controller A' }, { name: 'Controller B' }],
            });

            await service.triggerRemoteImport();

            const calls = mockUsersGateway.broadcastToAll.mock.calls;
            expect(calls.length).toBeGreaterThanOrEqual(4);
            expect(calls[0][0]).toBe('access-control:controllers:import-progress');
            expect(calls[calls.length - 1][0]).toBe('access-control:controllers:import-completed');
        });

        it('should broadcast failure event on error', async () => {
            mockAcApiService.triggerFullImport.mockRejectedValue(new Error('AC server down'));

            await expect(service.triggerRemoteImport()).rejects.toThrow('AC server down');
            expect(mockUsersGateway.broadcastToAll).toHaveBeenCalledWith(
                'access-control:controllers:import-failed',
                expect.objectContaining({ message: 'AC server down' }),
            );
        });

        it('should return empty result when remote returns no controllers', async () => {
            mockAcApiService.triggerFullImport.mockResolvedValue({ controllers: [] });

            const result = await service.triggerRemoteImport();

            expect(result.created).toBe(0);
            expect(result.updated).toBe(0);
        });

        it('should propagate errors from acApiService', async () => {
            mockAcApiService.triggerFullImport.mockRejectedValue(new Error('AC server down'));
            await expect(service.triggerRemoteImport()).rejects.toThrow('AC server down');
        });
    });

    describe('processCallback', () => {
        it('should return empty result for no controllers', async () => {
            const result = await service.processCallback({ controllers: [] });
            expect(result.created).toBe(0);
            expect(result.updated).toBe(0);
            expect(result.items).toHaveLength(0);
            expect(result.errors).toContain('No controllers in callback payload');
        });

        it('should skip controllers without name', async () => {
            const result = await service.processCallback({
                controllers: [{ name: '' } as any],
            });
            expect(result.skipped).toBe(1);
            expect(result.items).toHaveLength(0);
        });

        it('should import controller with doors and extensions and include items', async () => {
            const result = await service.processCallback({
                controllers: [{
                    name: 'Main Controller',
                    type: 1,
                    ip: '192.168.1.1',
                    doors: [{
                        name: 'Front Door',
                        doorIos: [{ name: 'Reader 1' }],
                    }],
                    extensions: [{
                        name: 'Extension 1',
                        extensionIos: [{ name: 'Sensor 1' }],
                    }],
                }],
            });

            expect(result.created).toBe(1);
            expect(result.updated).toBe(0);
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toEqual(expect.objectContaining({ name: 'Main Controller', type: 1, ip: '192.168.1.1' }));
            expect(mockControllerService.upsertByExternalId).toHaveBeenCalled();
            expect(mockDoorService.upsertByExternalId).toHaveBeenCalled();
            expect(mockDoorIoService.upsertByExternalId).toHaveBeenCalled();
            expect(mockExtensionService.upsertByExternalId).toHaveBeenCalled();
            expect(mockExtensionIoService.upsertByExternalId).toHaveBeenCalled();
        });

        it('should handle errors per controller and continue', async () => {
            mockControllerService.upsertByExternalId
                .mockRejectedValueOnce(new Error('DB error'))
                .mockResolvedValueOnce({ entity: { id: 'ctrl-2' }, action: 'created' });

            const result = await service.processCallback({
                controllers: [
                    { name: 'Bad Controller' },
                    { name: 'Good Controller' },
                ],
            });

            expect(result.created).toBe(1);
            expect(result.updated).toBe(0);
            expect(result.skipped).toBe(1);
            expect(result.errors).toHaveLength(1);
        });

        it('should map controller active to isActive', async () => {
            await service.processCallback({
                controllers: [
                    { name: 'Inactive Controller', active: 'false' as any },
                    { name: 'Active Controller', active: 1 as any },
                ],
            } as any);

            expect(mockControllerService.upsertByExternalId).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({ isActive: false }),
            );
            expect(mockControllerService.upsertByExternalId).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ isActive: true }),
            );
        });

        it('should normalize string IO type before saving', async () => {
            await service.processCallback({
                controllers: [
                    {
                        name: 'Controller With String IoType',
                        doors: [
                            {
                                name: 'Door 1',
                                doorIos: [
                                    { name: 'Input 1', type: 'TwoStates', externalId: 'io-1' },
                                    { name: 'Relay 1', type: 'Closed', externalId: 'io-2' },
                                ],
                            },
                        ],
                    },
                ],
            } as any);

            expect(mockDoorIoService.upsertByExternalId).toHaveBeenCalledWith(
                expect.objectContaining({ externalId: 'io-1', type: 0 }),
            );
            expect(mockDoorIoService.upsertByExternalId).toHaveBeenCalledWith(
                expect.objectContaining({ externalId: 'io-2', type: 1 }),
            );
        });

        it('should continue controller import when a single IO upsert fails', async () => {
            mockDoorIoService.upsertByExternalId
                .mockRejectedValueOnce(new Error('invalid io type'))
                .mockResolvedValue({ entity: { id: 'dio-2' }, action: 'created' });

            const result = await service.processCallback({
                controllers: [
                    {
                        name: 'Controller With Partial Io Failure',
                        doors: [
                            {
                                name: 'Door 1',
                                doorIos: [
                                    { name: 'Bad IO', type: 'BadType', externalId: 'io-bad' },
                                    { name: 'Good IO', type: 'TwoStates', externalId: 'io-good' },
                                ],
                            },
                        ],
                    },
                ],
            } as any);

            expect(result.created).toBe(1);
            expect(result.updated).toBe(0);
            expect(result.skipped).toBe(0);
            expect(result.errors.some((e) => e.includes('Door 1') && e.includes('Bad IO'))).toBe(true);
            expect(mockDoorIoService.upsertByExternalId).toHaveBeenCalledTimes(2);
        });

        it('should continue processing remaining doors and extensions when one door fails', async () => {
            mockDoorService.upsertByExternalId
                .mockRejectedValueOnce(new Error('door save failed'))
                .mockResolvedValueOnce({ entity: { id: 'door-2' }, action: 'created' });

            const result = await service.processCallback({
                controllers: [
                    {
                        name: 'Controller Partial Child Failure',
                        doors: [
                            { name: 'Broken Door', externalId: 'door-bad' },
                            { name: 'Good Door', externalId: 'door-good' },
                        ],
                        extensions: [
                            { name: 'Good Extension', externalId: 'ext-good' },
                        ],
                    },
                ],
            } as any);

            expect(result.created).toBe(1);
            expect(result.updated).toBe(0);
            expect(result.skipped).toBe(0);
            expect(result.errors.some((e) => e.includes('Broken Door') && e.includes('door save failed'))).toBe(true);
            expect(mockDoorService.upsertByExternalId).toHaveBeenCalledTimes(2);
            expect(mockExtensionService.upsertByExternalId).toHaveBeenCalledTimes(1);
        });

        it('should normalize numeric string fields for controller door and extension', async () => {
            await service.processCallback({
                controllers: [
                    {
                        name: 'Controller Numeric Strings',
                        type: '7',
                        port: '8080',
                        doors: [
                            {
                                name: 'Door Numeric Strings',
                                doorsIndex: '3',
                                entryType: '2',
                                doorIos: [
                                    { name: 'IO Numeric Strings', ioIndex: '10', ioState: '1' },
                                ],
                            },
                        ],
                        extensions: [
                            {
                                name: 'Extension Numeric Strings',
                                type: '4',
                                extensionIndex: '6',
                                extensionIos: [
                                    { name: 'Ext IO Numeric Strings', ioIndex: '11', ioState: '0' },
                                ],
                            },
                        ],
                    },
                ],
            } as any);

            expect(mockControllerService.upsertByExternalId).toHaveBeenCalledWith(
                expect.objectContaining({ type: 7, port: 8080 }),
            );
            expect(mockDoorService.upsertByExternalId).toHaveBeenCalledWith(
                expect.objectContaining({ doorsIndex: 3, entryType: 2 }),
                { disableOnCreate: true },
            );
            expect(mockExtensionService.upsertByExternalId).toHaveBeenCalledWith(
                expect.objectContaining({ type: 4, extensionIndex: 6 }),
            );
            expect(mockDoorIoService.upsertByExternalId).toHaveBeenCalledWith(
                expect.objectContaining({ ioIndex: 10, ioState: 1 }),
            );
            expect(mockExtensionIoService.upsertByExternalId).toHaveBeenCalledWith(
                expect.objectContaining({ ioIndex: 11, ioState: 0 }),
            );
        });

        it('should generate deterministic fallback externalId values when missing', async () => {
            await service.processCallback({
                controllers: [
                    {
                        name: 'Controller Empty ExternalId',
                        externalId: '   ',
                        doors: [
                            {
                                name: 'Door Empty ExternalId',
                                externalId: '',
                                doorIos: [
                                    { name: 'Door IO Empty ExternalId', externalId: '   ' },
                                ],
                            },
                        ],
                        extensions: [
                            {
                                name: 'Extension Empty ExternalId',
                                externalId: '',
                                extensionIos: [
                                    { name: 'Extension IO Empty ExternalId', externalId: '' },
                                ],
                            },
                        ],
                    },
                ],
            } as any);

            const controllerArg = mockControllerService.upsertByExternalId.mock.calls[0][0];
            const doorArg = mockDoorService.upsertByExternalId.mock.calls[0][0];
            const doorIoArg = mockDoorIoService.upsertByExternalId.mock.calls[0][0];
            const extensionArg = mockExtensionService.upsertByExternalId.mock.calls[0][0];
            const extensionIoArg = mockExtensionIoService.upsertByExternalId.mock.calls[0][0];

            expect(controllerArg.externalId).toMatch(/^gen:controller:/);
            expect(doorArg.externalId).toMatch(/^gen:door:/);
            expect(doorIoArg.externalId).toMatch(/^gen:door-io:/);
            expect(extensionArg.externalId).toMatch(/^gen:extension:/);
            expect(extensionIoArg.externalId).toMatch(/^gen:extension-io:/);
        });

        it('should process all doors and door IOs when externalId is missing', async () => {
            const result = await service.processCallback({
                controllers: [
                    {
                        name: 'Controller Multiple Doors',
                        doors: [
                            {
                                name: 'Door A',
                                doorIos: [
                                    { name: 'Door A IO 1' },
                                    { name: 'Door A IO 2' },
                                ],
                            },
                            {
                                name: 'Door B',
                                doorIos: [
                                    { name: 'Door B IO 1' },
                                    { name: 'Door B IO 2' },
                                ],
                            },
                        ],
                    },
                ],
            } as any);

            expect(result.created).toBe(1);
            expect(result.errors).toHaveLength(0);
            expect(mockDoorService.upsertByExternalId).toHaveBeenCalledTimes(2);
            expect(mockDoorIoService.upsertByExternalId).toHaveBeenCalledTimes(4);

            const [doorA, doorB] = mockDoorService.upsertByExternalId.mock.calls.map((c: any[]) => c[0]);
            expect(doorA.externalId).toMatch(/^gen:door:/);
            expect(doorB.externalId).toMatch(/^gen:door:/);
            expect(doorA.externalId).not.toBe(doorB.externalId);

            const doorOptionA = mockDoorService.upsertByExternalId.mock.calls[0][1];
            const doorOptionB = mockDoorService.upsertByExternalId.mock.calls[1][1];
            expect(doorOptionA).toEqual({ disableOnCreate: true });
            expect(doorOptionB).toEqual({ disableOnCreate: true });
        });
    });

    describe('triggerAccessLevelImport', () => {
        it('should call triggerAccessLevelImport and process the returned payload', async () => {
            mockAcApiService.triggerAccessLevelImport.mockResolvedValue({
                accessLevels: [{ name: 'VIP', active: true, visitorAccess: false }],
            });

            const result = await service.triggerAccessLevelImport();

            expect(mockAcApiService.triggerAccessLevelImport).toHaveBeenCalledTimes(1);
            expect(result.created).toBe(1);
            expect(result.updated).toBe(0);
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toEqual({ name: 'VIP', active: true, visitorAccess: false });
            expect(mockUsersGateway.broadcastToAll).toHaveBeenCalled();
        });

        it('should broadcast progress events during import', async () => {
            mockAcApiService.triggerAccessLevelImport.mockResolvedValue({
                accessLevels: [
                    { name: 'Level A', active: true },
                    { name: 'Level B', active: false, visitorAccess: true },
                ],
            });

            await service.triggerAccessLevelImport();

            // Should have: fetching, processing, per-item progress (x2), completed
            const calls = mockUsersGateway.broadcastToAll.mock.calls;
            expect(calls.length).toBeGreaterThanOrEqual(4);
            expect(calls[0][0]).toBe('access-control:access-levels:import-progress');
            expect(calls[calls.length - 1][0]).toBe('access-control:access-levels:import-completed');
        });

        it('should broadcast failure event on error', async () => {
            mockAcApiService.triggerAccessLevelImport.mockRejectedValue(new Error('AC server down'));

            await expect(service.triggerAccessLevelImport()).rejects.toThrow('AC server down');
            expect(mockUsersGateway.broadcastToAll).toHaveBeenCalledWith(
                'access-control:access-levels:import-failed',
                expect.objectContaining({ message: 'AC server down' }),
            );
        });

        it('should propagate errors from acApiService', async () => {
            mockAcApiService.triggerAccessLevelImport.mockRejectedValue(new Error('AC server down'));
            await expect(service.triggerAccessLevelImport()).rejects.toThrow('AC server down');
        });
    });

    describe('processAccessLevelCallback', () => {
        it('should return empty result for no access levels', async () => {
            const result = await service.processAccessLevelCallback({ accessLevels: [] });
            expect(result.created).toBe(0);
            expect(result.updated).toBe(0);
            expect(result.items).toHaveLength(0);
        });

        it('should skip entries without name', async () => {
            const result = await service.processAccessLevelCallback({
                accessLevels: [{ name: '' } as any],
            });
            expect(result.skipped).toBe(1);
            expect(result.items).toHaveLength(0);
        });

        it('should import access levels and include items in result', async () => {
            const result = await service.processAccessLevelCallback({
                accessLevels: [{ name: 'VIP', active: true, visitorAccess: true }],
            });
            expect(result.created).toBe(1);
            expect(result.updated).toBe(0);
            expect(result.items).toHaveLength(1);
            expect(result.items[0]).toEqual({ name: 'VIP', active: true, visitorAccess: true, externalId: undefined });
            expect(mockAccessLevelService.upsertByExternalId).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'VIP' }),
            );
        });

        it('should count updated items separately from created', async () => {
            mockAccessLevelService.upsertByExternalId
                .mockResolvedValueOnce({ entity: { id: 'al-1' }, action: 'created' })
                .mockResolvedValueOnce({ entity: { id: 'al-2' }, action: 'updated' });

            const result = await service.processAccessLevelCallback({
                accessLevels: [
                    { name: 'New Level', active: true },
                    { name: 'Existing Level', active: true },
                ],
            });
            expect(result.created).toBe(1);
            expect(result.updated).toBe(1);
            expect(result.items).toHaveLength(2);
        });
    });
});
