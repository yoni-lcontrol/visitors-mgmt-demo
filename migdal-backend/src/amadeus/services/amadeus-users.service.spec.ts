import { Test, TestingModule } from '@nestjs/testing';
import { AmadeusUsersService } from './amadeus-users.service';
import { AccessControlApiService } from '../../access-control/services/ac-api.service';
import { BadGatewayException } from '@nestjs/common';

describe('AmadeusUsersService', () => {
    let service: AmadeusUsersService;
    let mockAcApi: Record<string, jest.Mock>;

    beforeEach(async () => {
        mockAcApi = {
            createCardholder: jest.fn().mockResolvedValue({ success: true, cardholderId: 'ch-1' }),
            deleteCardholder: jest.fn().mockResolvedValue({ success: true }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AmadeusUsersService,
                { provide: AccessControlApiService, useValue: mockAcApi },
            ],
        }).compile();

        service = module.get<AmadeusUsersService>(AmadeusUsersService);
    });

    describe('addUserToAmadeus', () => {
        it('should call acApi.createCardholder with mapped fields', async () => {
            const dto = {
                cardholderIdNumber: '123456789',
                firstName: 'John',
                lastName: 'Doe',
                fromDateValid: '2026-01-01T00:00:00Z',
                toDateValid: '2026-12-31T23:59:59Z',
                accessGroupApiKeys: ['group-1', 'group-2'],
                licensePlate: '12-345-67',
            };

            const result = await service.addUserToAmadeus(dto);

            expect(mockAcApi.createCardholder).toHaveBeenCalledWith({
                personId: '123456789',
                firstName: 'John',
                lastName: 'Doe',
                fromDate: '2026-01-01T00:00:00Z',
                toDate: '2026-12-31T23:59:59Z',
                accessLevelNames: ['group-1', 'group-2'],
                licensePlate: '12-345-67',
            });
            expect(result.success).toBe(true);
            expect(result.cardholderId).toBe('ch-1');
        });

        it('should call acApi.createCardholder without licensePlate when not provided', async () => {
            const dto = {
                cardholderIdNumber: '987654321',
                firstName: 'Jane',
                lastName: 'Smith',
            };

            const result = await service.addUserToAmadeus(dto);

            expect(mockAcApi.createCardholder).toHaveBeenCalledWith({
                personId: '987654321',
                firstName: 'Jane',
                lastName: 'Smith',
                fromDate: undefined,
                toDate: undefined,
                accessLevelNames: undefined,
                licensePlate: undefined,
            });
            expect(result.success).toBe(true);
        });

        it('should propagate errors from acApi', async () => {
            mockAcApi.createCardholder.mockRejectedValue(
                new BadGatewayException('AC server error: timeout'),
            );

            await expect(
                service.addUserToAmadeus({
                    cardholderIdNumber: '123',
                    firstName: 'John',
                    lastName: 'Doe',
                }),
            ).rejects.toThrow(BadGatewayException);
        });
    });

    describe('deleteUserFromAmadeus', () => {
        it('should call acApi.deleteCardholder with amadeusUid', async () => {
            const result = await service.deleteUserFromAmadeus('uid-abc-123');

            expect(mockAcApi.deleteCardholder).toHaveBeenCalledWith('uid-abc-123');
            expect(result.success).toBe(true);
        });

        it('should propagate errors from acApi', async () => {
            mockAcApi.deleteCardholder.mockRejectedValue(
                new BadGatewayException('AC server error: not found'),
            );

            await expect(
                service.deleteUserFromAmadeus('uid-abc-123'),
            ).rejects.toThrow(BadGatewayException);
        });
    });
});
