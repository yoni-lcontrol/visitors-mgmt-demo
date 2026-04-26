import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VisitParticipantService } from './visit-participant.service';
import { Visit } from './entities/visit.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { VisitEscort } from './entities/visit-escort.entity';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { Visitor } from './entities/visitor.entity';
import { ParkingRequest } from './entities/parking-request.entity';
import { VisitorStatus } from './enums/visitor-status.enum';
import { BlacklistService } from './blacklist.service';
import { VisitCheckInCodeService } from './visit-check-in-code.service';
import { AuditService } from '../audit/audit.service';
import {
    createMockRepository,
    createMockQueryBuilder,
    createMockBlacklistService,
    createMockDataSource,
    createMockAuditService,
} from '../test-utils/mock.factory';

describe('VisitParticipantService', () => {
    let service: VisitParticipantService;
    let mockVisitRepo: ReturnType<typeof createMockRepository>;
    let mockVvRepo: ReturnType<typeof createMockRepository>;
    let mockEscortRepo: ReturnType<typeof createMockRepository>;
    let mockStatusRepo: ReturnType<typeof createMockRepository>;
    let mockVisitorRepo: ReturnType<typeof createMockRepository>;
    let mockParkingRepo: ReturnType<typeof createMockRepository>;
    let mockDs: ReturnType<typeof createMockDataSource>;
    let mockBl: ReturnType<typeof createMockBlacklistService>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockVisitRepo = createMockRepository();
        mockVvRepo = createMockRepository();
        mockEscortRepo = createMockRepository();
        mockStatusRepo = createMockRepository();
        mockVisitorRepo = createMockRepository();
        mockParkingRepo = createMockRepository();
        mockDs = createMockDataSource();
        mockBl = createMockBlacklistService();
        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitParticipantService,
                { provide: getRepositoryToken(Visit), useValue: mockVisitRepo },
                { provide: getRepositoryToken(VisitVisitor), useValue: mockVvRepo },
                { provide: getRepositoryToken(VisitEscort), useValue: mockEscortRepo },
                { provide: getRepositoryToken(VisitVisitorStatus), useValue: mockStatusRepo },
                { provide: getRepositoryToken(Visitor), useValue: mockVisitorRepo },
                { provide: getRepositoryToken(ParkingRequest), useValue: mockParkingRepo },
                { provide: DataSource, useValue: mockDs },
                { provide: BlacklistService, useValue: mockBl },
                { provide: VisitCheckInCodeService, useValue: { generateCodesForVisit: jest.fn().mockResolvedValue([]), sendCodeNotifications: jest.fn().mockResolvedValue({}) } },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<VisitParticipantService>(VisitParticipantService);
    });

    // ── Visit Visitors ──

    describe('getVisitVisitors', () => {
        it('should return mapped visit visitors with parkingRequest null when none exists', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });
            mockVvRepo.find.mockResolvedValue([{
                id: 'vv1', visitId: 'v1', visitorId: 'vis1', notes: null,
                createdAt: new Date(),
                visitor: { id: 'vis1', firstName: 'Jane', lastName: 'Smith', email: null, phone: '+972501234567', personId: '123', carNumber: null, vehicleType: null },
                status: { currentStatus: VisitorStatus.Pending, arrivedAtUtc: null, checkedInAtUtc: null, checkedOutAtUtc: null, lastEventTimeUtc: null },
            }]);
            mockParkingRepo.find.mockResolvedValue([]);

            const result = await service.getVisitVisitors('v1');

            expect(result).toHaveLength(1);
            expect(result[0].visitor.firstName).toBe('Jane');
            expect(result[0].parkingRequest).toBeNull();
        });

        it('should return parkingRequest status when one exists', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });
            mockVvRepo.find.mockResolvedValue([{
                id: 'vv1', visitId: 'v1', visitorId: 'vis1', notes: null,
                createdAt: new Date(),
                visitor: { id: 'vis1', firstName: 'Jane', lastName: 'Smith', email: null, phone: '+972501234567', personId: '123', carNumber: 'ABC123', vehicleType: 'car' },
                status: null,
            }]);
            mockParkingRepo.find.mockResolvedValue([{ visitVisitorId: 'vv1', status: 'Pending', isActive: true }]);

            const result = await service.getVisitVisitors('v1');

            expect(result).toHaveLength(1);
            expect(result[0].parkingRequest).toEqual({ status: 'Pending' });
        });

        it('should throw NotFoundException on missing visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.getVisitVisitors('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateVisitVisitor', () => {
        it('should update visitor and visit-visitor fields', async () => {
            mockVvRepo.findOne.mockResolvedValue({ id: 'vv1', visitId: 'v1', visitorId: 'vis1', isActive: true });
            mockVisitorRepo.findOne.mockResolvedValue({ id: 'vis1', firstName: 'Jane', lastName: 'Smith', isActive: true });
            mockVisitorRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockVvRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            // Mock getVisitVisitors return
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });
            mockVvRepo.find.mockResolvedValue([]);

            await service.updateVisitVisitor('v1', 'vv1', { firstName: 'Updated' } as any, 'user-1');

            expect(mockVisitorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Updated' }));
        });

        it('should throw if updated personId is blacklisted', async () => {
            mockVvRepo.findOne.mockResolvedValue({ id: 'vv1', visitId: 'v1', visitorId: 'vis1', isActive: true });
            mockVisitorRepo.findOne.mockResolvedValue({ id: 'vis1', isActive: true });
            mockBl.checkBlacklistStatus.mockResolvedValue({ isBlacklisted: true, reason: 'Banned' });

            await expect(service.updateVisitVisitor('v1', 'vv1', { personId: '999' } as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException on missing visit-visitor', async () => {
            mockVvRepo.findOne.mockResolvedValue(null);
            await expect(service.updateVisitVisitor('v1', 'bad', {} as any)).rejects.toThrow(NotFoundException);
        });

        it('should clear carNumber and vehicleType when hasVehicle is false', async () => {
            mockVvRepo.findOne.mockResolvedValue({ id: 'vv1', visitId: 'v1', visitorId: 'vis1', isActive: true });
            mockVisitorRepo.findOne.mockResolvedValue({ id: 'vis1', firstName: 'Jane', lastName: 'Smith', isActive: true, carNumber: 'ABC', vehicleType: 'private' });
            mockVisitorRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockVvRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });
            mockVvRepo.find.mockResolvedValue([]);

            await service.updateVisitVisitor('v1', 'vv1', { hasVehicle: false } as any, 'user-1');

            expect(mockVisitorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ carNumber: null, vehicleType: null }));
        });

        it('should set vehicleType when provided', async () => {
            mockVvRepo.findOne.mockResolvedValue({ id: 'vv1', visitId: 'v1', visitorId: 'vis1', isActive: true });
            mockVisitorRepo.findOne.mockResolvedValue({ id: 'vis1', firstName: 'Jane', lastName: 'Smith', isActive: true, carNumber: null, vehicleType: null });
            mockVisitorRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockVvRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });
            mockVvRepo.find.mockResolvedValue([]);

            await service.updateVisitVisitor('v1', 'vv1', { vehicleType: 'truck' } as any, 'user-1');

            expect(mockVisitorRepo.save).toHaveBeenCalledWith(expect.objectContaining({ vehicleType: 'truck' }));
        });
    });

    describe('removeVisitVisitor', () => {
        it('should soft-delete visit visitor', async () => {
            mockVvRepo.findOne.mockResolvedValue({ id: 'vv1', visitId: 'v1', isActive: true });
            mockVvRepo.count.mockResolvedValue(2);
            mockVvRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.removeVisitVisitor('v1', 'vv1', 'user-1');

            expect(mockVvRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
        });

        it('should throw NotFoundException', async () => {
            mockVvRepo.findOne.mockResolvedValue(null);
            await expect(service.removeVisitVisitor('v1', 'bad')).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when removing the last visitor', async () => {
            mockVvRepo.findOne.mockResolvedValue({ id: 'vv1', visitId: 'v1', isActive: true });
            mockVvRepo.count.mockResolvedValue(1);

            await expect(service.removeVisitVisitor('v1', 'vv1', 'user-1')).rejects.toThrow(BadRequestException);
            expect(mockVvRepo.save).not.toHaveBeenCalled();
        });
    });

    // ── Visit Escorts ──

    describe('getVisitEscorts', () => {
        it('should return escorts for visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });
            mockEscortRepo.find.mockResolvedValue([{ id: 'e1', firstName: 'Bob' }]);

            const result = await service.getVisitEscorts('v1');
            expect(result).toHaveLength(1);
        });

        it('should throw NotFoundException on missing visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.getVisitEscorts('bad')).rejects.toThrow(NotFoundException);
        });
    });

    describe('addVisitEscorts', () => {
        it('should add escorts to visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });
            mockEscortRepo.find.mockResolvedValue([]);

            await service.addVisitEscorts('v1', {
                escorts: [{ firstName: 'Bob', lastName: 'Guard', phone: '555', email: 'b@g.com' }],
            } as any, 'user-1');

            expect(mockEscortRepo.create).toHaveBeenCalled();
            expect(mockEscortRepo.save).toHaveBeenCalled();
        });
    });

    describe('removeVisitEscort', () => {
        it('should soft-delete escort', async () => {
            mockEscortRepo.findOne.mockResolvedValue({ id: 'e1', visitId: 'v1', isActive: true });
            mockEscortRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            await service.removeVisitEscort('v1', 'e1', 'user-1');

            expect(mockEscortRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
        });

        it('should throw NotFoundException', async () => {
            mockEscortRepo.findOne.mockResolvedValue(null);
            await expect(service.removeVisitEscort('v1', 'bad')).rejects.toThrow(NotFoundException);
        });
    });
});
