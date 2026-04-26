import { Test, TestingModule } from '@nestjs/testing';
import { AmadeusController } from './amadeus.controller';
import { AmadeusService } from './amadeus.service';

describe('AmadeusController', () => {
    let controller: AmadeusController;
    let mockService: {
        getControllers: jest.Mock;
        getDoors: jest.Mock;
        getDoorIos: jest.Mock;
        getExtensions: jest.Mock;
        getExtensionIos: jest.Mock;
        triggerFullSync: jest.Mock;
    };

    beforeEach(async () => {
        mockService = {
            getControllers: jest.fn(),
            getDoors: jest.fn(),
            getDoorIos: jest.fn(),
            getExtensions: jest.fn(),
            getExtensionIos: jest.fn(),
            triggerFullSync: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AmadeusController],
            providers: [
                { provide: AmadeusService, useValue: mockService },
            ],
        }).compile();

        controller = module.get<AmadeusController>(AmadeusController);
    });

    describe('getControllers', () => {
        it('should delegate to service and return result', async () => {
            const expected = [{ id: 'c1', name: 'Controller 1', externalId: 'ext-1', amadeusUid: null, isActive: true }];
            mockService.getControllers.mockResolvedValue(expected);

            const result = await controller.getControllers();

            expect(result).toEqual(expected);
            expect(mockService.getControllers).toHaveBeenCalled();
        });
    });

    describe('getDoors', () => {
        it('should delegate to service and return result', async () => {
            const expected = [{ id: 'd1', name: 'Door 1', externalId: 'ext-d1', amadeusUid: null, controllerExternalId: 'ext-c1' }];
            mockService.getDoors.mockResolvedValue(expected);

            const result = await controller.getDoors();

            expect(result).toEqual(expected);
            expect(mockService.getDoors).toHaveBeenCalled();
        });
    });

    describe('getDoorIos', () => {
        it('should delegate to service and return result', async () => {
            const expected = [{ id: 'dio1', name: 'DoorIO 1' }];
            mockService.getDoorIos.mockResolvedValue(expected);

            const result = await controller.getDoorIos();

            expect(result).toEqual(expected);
        });
    });

    describe('getExtensions', () => {
        it('should delegate to service and return result', async () => {
            const expected = [{ id: 'e1', name: 'Extension 1' }];
            mockService.getExtensions.mockResolvedValue(expected);

            const result = await controller.getExtensions();

            expect(result).toEqual(expected);
        });
    });

    describe('getExtensionIos', () => {
        it('should delegate to service and return result', async () => {
            const expected = [{ id: 'eio1', name: 'ExtensionIO 1' }];
            mockService.getExtensionIos.mockResolvedValue(expected);

            const result = await controller.getExtensionIos();

            expect(result).toEqual(expected);
        });
    });

    describe('triggerFullSync', () => {
        it('should delegate to service and return sync result', async () => {
            const expected = {
                success: true,
                operation: 'FullStartup',
                startedUtc: new Date(),
                completedUtc: new Date(),
                totalReceived: 10,
                created: 0,
                updated: 0,
                unchanged: 10,
                skipped: 0,
                failed: 0,
                errorMessage: null,
            };
            mockService.triggerFullSync.mockResolvedValue(expected);

            const result = await controller.triggerFullSync();

            expect(result).toEqual(expected);
            expect(mockService.triggerFullSync).toHaveBeenCalled();
        });
    });
});
