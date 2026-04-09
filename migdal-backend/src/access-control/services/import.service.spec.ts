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

    beforeEach(async () => {
        mockAcApiService = {
            triggerFullImport: jest.fn().mockResolvedValue(undefined),
            triggerAccessLevelImport: jest.fn().mockResolvedValue(undefined),
        };
        mockControllerService = { create: jest.fn().mockResolvedValue({ id: 'ctrl-1' }) };
        mockDoorService = { create: jest.fn().mockResolvedValue({ id: 'door-1' }) };
        mockExtensionService = { create: jest.fn().mockResolvedValue({ id: 'ext-1' }) };
        mockDoorIoService = { create: jest.fn().mockResolvedValue({ id: 'dio-1' }) };
        mockExtensionIoService = { create: jest.fn().mockResolvedValue({ id: 'eio-1' }) };
        mockAccessLevelService = { create: jest.fn().mockResolvedValue({ id: 'al-1' }) };
        mockAuditService = createMockAuditService();

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
            ],
        }).compile();

        service = module.get<ImportService>(ImportService);
    });

    describe('triggerRemoteImport', () => {
        it('should delegate to acApiService.triggerFullImport', async () => {
            await service.triggerRemoteImport();
            expect(mockAcApiService.triggerFullImport).toHaveBeenCalledTimes(1);
        });

        it('should propagate errors from acApiService', async () => {
            mockAcApiService.triggerFullImport.mockRejectedValue(new Error('AC server down'));
            await expect(service.triggerRemoteImport()).rejects.toThrow('AC server down');
        });
    });

    describe('processCallback', () => {
        it('should return empty result for no controllers', async () => {
            const result = await service.processCallback({ controllers: [] });
            expect(result.imported).toBe(0);
            expect(result.errors).toContain('No controllers in callback payload');
        });

        it('should skip controllers without name', async () => {
            const result = await service.processCallback({
                controllers: [{ name: '' } as any],
            });
            expect(result.skipped).toBe(1);
        });

        it('should import controller with doors and extensions', async () => {
            const result = await service.processCallback({
                controllers: [{
                    name: 'Main Controller',
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

            expect(result.imported).toBe(1);
            expect(mockControllerService.create).toHaveBeenCalled();
            expect(mockDoorService.create).toHaveBeenCalled();
            expect(mockDoorIoService.create).toHaveBeenCalled();
            expect(mockExtensionService.create).toHaveBeenCalled();
            expect(mockExtensionIoService.create).toHaveBeenCalled();
        });

        it('should handle errors per controller and continue', async () => {
            mockControllerService.create
                .mockRejectedValueOnce(new Error('DB error'))
                .mockResolvedValueOnce({ id: 'ctrl-2' });

            const result = await service.processCallback({
                controllers: [
                    { name: 'Bad Controller' },
                    { name: 'Good Controller' },
                ],
            });

            expect(result.imported).toBe(1);
            expect(result.skipped).toBe(1);
            expect(result.errors).toHaveLength(1);
        });
    });

    describe('triggerAccessLevelImport', () => {
        it('should delegate to acApiService.triggerAccessLevelImport', async () => {
            await service.triggerAccessLevelImport();
            expect(mockAcApiService.triggerAccessLevelImport).toHaveBeenCalledTimes(1);
        });

        it('should propagate errors from acApiService', async () => {
            mockAcApiService.triggerAccessLevelImport.mockRejectedValue(new Error('AC server down'));
            await expect(service.triggerAccessLevelImport()).rejects.toThrow('AC server down');
        });
    });

    describe('processAccessLevelCallback', () => {
        it('should return empty result for no access levels', async () => {
            const result = await service.processAccessLevelCallback({ accessLevels: [] });
            expect(result.imported).toBe(0);
        });

        it('should skip entries without name', async () => {
            const result = await service.processAccessLevelCallback({
                accessLevels: [{ name: '' } as any],
            });
            expect(result.skipped).toBe(1);
        });

        it('should import access levels', async () => {
            const result = await service.processAccessLevelCallback({
                accessLevels: [{ name: 'VIP', active: true, visitorAccess: true }],
            });
            expect(result.imported).toBe(1);
            expect(mockAccessLevelService.create).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'VIP' }),
            );
        });
    });
});
