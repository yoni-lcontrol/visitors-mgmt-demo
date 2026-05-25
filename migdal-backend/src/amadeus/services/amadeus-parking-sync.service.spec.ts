import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AmadeusParkingSyncService } from './amadeus-parking-sync.service';
import { AccessControlApiService } from '../../access-control/services/ac-api.service';
import { ParkingRequest } from '../../visitors/entities/parking-request.entity';
import { ParkingRequestStatus } from '../../visitors/enums/parking-request-status.enum';

describe('AmadeusParkingSyncService', () => {
    let service: AmadeusParkingSyncService;
    let acApi: { createCardholder: jest.Mock };
    let parkingRepo: { findOne: jest.Mock };
    let configService: { get: jest.Mock };

    beforeEach(async () => {
        acApi = { createCardholder: jest.fn().mockResolvedValue({ success: true, cardholderId: 'amadeus-uid-1' }) };
        parkingRepo = { findOne: jest.fn() };
        configService = { get: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AmadeusParkingSyncService,
                { provide: AccessControlApiService, useValue: acApi },
                { provide: getRepositoryToken(ParkingRequest), useValue: parkingRepo },
                { provide: ConfigService, useValue: configService },
            ],
        }).compile();

        service = module.get(AmadeusParkingSyncService);
    });

    const makeParkingRequest = (overrides: Partial<any> = {}) => ({
        id: 'pr-1',
        status: ParkingRequestStatus.Approved,
        visitVisitor: {
            id: 'vv-1',
            visitor: {
                id: 'visitor-1',
                firstName: 'John',
                lastName: 'Doe',
                personId: '123456789',
                carNumber: '12-345-67',
                ...overrides.visitor,
            },
            visit: {
                id: 'visit-1',
                plannedStartTimeUtc: new Date('2025-03-01T08:00:00Z'),
                plannedEndTimeUtc: new Date('2025-03-01T17:00:00Z'),
                ...overrides.visit,
            },
            ...overrides.visitVisitor,
        },
        ...overrides,
    });

    it('should call createCardholder with correct data when parking is approved', async () => {
        configService.get.mockImplementation((key: string, def?: string) => {
            if (key === 'AMADEUS_ENABLED') return 'true';
            if (key === 'AMADEUS_PARKING_ACCESS_GROUP') return 'Parking-Level-1';
            return def;
        });
        parkingRepo.findOne.mockResolvedValue(makeParkingRequest());

        await service.syncApprovedParkingVisitorToAmadeus('pr-1');

        expect(acApi.createCardholder).toHaveBeenCalledWith({
            personId: 'VIS-123456789',
            firstName: 'John',
            lastName: 'Doe',
            fromDate: '2025-03-01T08:00:00.000Z',
            toDate: '2025-03-01T17:00:00.000Z',
            accessLevelNames: ['Parking-Level-1'],
            licensePlate: '12-345-67',
            isVisitor: true,
        });
    });

    it('should skip sync when AMADEUS_ENABLED is not true', async () => {
        configService.get.mockImplementation((key: string, def?: string) => {
            if (key === 'AMADEUS_ENABLED') return 'false';
            return def;
        });

        await service.syncApprovedParkingVisitorToAmadeus('pr-1');

        expect(parkingRepo.findOne).not.toHaveBeenCalled();
        expect(acApi.createCardholder).not.toHaveBeenCalled();
    });

    it('should skip sync when parking request is not found', async () => {
        configService.get.mockImplementation((key: string, def?: string) => {
            if (key === 'AMADEUS_ENABLED') return 'true';
            return def;
        });
        parkingRepo.findOne.mockResolvedValue(null);

        await service.syncApprovedParkingVisitorToAmadeus('pr-1');

        expect(acApi.createCardholder).not.toHaveBeenCalled();
    });

    it('should skip sync when parking request status is not approved', async () => {
        configService.get.mockImplementation((key: string, def?: string) => {
            if (key === 'AMADEUS_ENABLED') return 'true';
            return def;
        });
        parkingRepo.findOne.mockResolvedValue(makeParkingRequest({ status: ParkingRequestStatus.Pending }));

        await service.syncApprovedParkingVisitorToAmadeus('pr-1');

        expect(acApi.createCardholder).not.toHaveBeenCalled();
    });

    it('should skip sync when visitor has no license plate', async () => {
        configService.get.mockImplementation((key: string, def?: string) => {
            if (key === 'AMADEUS_ENABLED') return 'true';
            return def;
        });
        parkingRepo.findOne.mockResolvedValue(makeParkingRequest({ visitor: { carNumber: null } }));

        await service.syncApprovedParkingVisitorToAmadeus('pr-1');

        expect(acApi.createCardholder).not.toHaveBeenCalled();
    });

    it('should skip sync when visit has no start date', async () => {
        configService.get.mockImplementation((key: string, def?: string) => {
            if (key === 'AMADEUS_ENABLED') return 'true';
            return def;
        });
        parkingRepo.findOne.mockResolvedValue(makeParkingRequest({ visit: { plannedStartTimeUtc: null } }));

        await service.syncApprovedParkingVisitorToAmadeus('pr-1');

        expect(acApi.createCardholder).not.toHaveBeenCalled();
    });

    it('should not throw when createCardholder fails (error is caught)', async () => {
        configService.get.mockImplementation((key: string, def?: string) => {
            if (key === 'AMADEUS_ENABLED') return 'true';
            if (key === 'AMADEUS_PARKING_ACCESS_GROUP') return 'Parking-Level-1';
            return def;
        });
        parkingRepo.findOne.mockResolvedValue(makeParkingRequest());
        acApi.createCardholder.mockRejectedValue(new Error('Network error'));

        await expect(service.syncApprovedParkingVisitorToAmadeus('pr-1')).resolves.toBeUndefined();
    });

    it('should omit accessLevelNames when AMADEUS_PARKING_ACCESS_GROUP is not configured', async () => {
        configService.get.mockImplementation((key: string, def?: string) => {
            if (key === 'AMADEUS_ENABLED') return 'true';
            if (key === 'AMADEUS_PARKING_ACCESS_GROUP') return undefined;
            return def;
        });
        parkingRepo.findOne.mockResolvedValue(makeParkingRequest());

        await service.syncApprovedParkingVisitorToAmadeus('pr-1');

        expect(acApi.createCardholder).toHaveBeenCalledWith(
            expect.objectContaining({ accessLevelNames: undefined }),
        );
    });
});
