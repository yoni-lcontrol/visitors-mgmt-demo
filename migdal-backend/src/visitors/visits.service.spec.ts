import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VisitsService } from './visits.service';
import { Visit } from './entities/visit.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { VisitEscort } from './entities/visit-escort.entity';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { Visitor } from './entities/visitor.entity';
import { User } from '../users/entities/user.entity';
import { VisitorStatus } from './enums/visitor-status.enum';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { PermissionKey } from '../common/enums/permission-key.enum';

import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { AuditService } from '../audit/audit.service';
import { VisitParticipantService } from './visit-participant.service';
import { VisitCheckInCodeService } from './visit-check-in-code.service';
import { VisitorPersistenceService } from './visitor-persistence.service';
import {
    createMockRepository,
    createMockQueryBuilder,
    createMockWsGateway,
    createMockDataSource,
    createMockAuditService,
} from '../test-utils/mock.factory';

describe('VisitsService', () => {
    let service: VisitsService;
    let mockVisitRepo: ReturnType<typeof createMockRepository>;
    let mockVvRepo: ReturnType<typeof createMockRepository>;
    let mockEscortRepo: ReturnType<typeof createMockRepository>;
    let mockStatusRepo: ReturnType<typeof createMockRepository>;
    let mockVisitorRepo: ReturnType<typeof createMockRepository>;
    let mockUserRepo: ReturnType<typeof createMockRepository>;
    let mockDs: ReturnType<typeof createMockDataSource>;
    let mockWs: ReturnType<typeof createMockWsGateway>;
    let mockAuditService: ReturnType<typeof createMockAuditService>;
    let mockParticipantService: { validateVisitorsNotBlacklisted: jest.Mock };
    let mockVisitorPersistence: { upsertByPersonId: jest.Mock };

    beforeEach(async () => {
        mockVisitRepo = createMockRepository();
        mockVvRepo = createMockRepository();
        mockEscortRepo = createMockRepository();
        mockStatusRepo = createMockRepository();
        mockVisitorRepo = createMockRepository();
        mockUserRepo = createMockRepository();
        mockDs = createMockDataSource();
        mockWs = createMockWsGateway();
        mockAuditService = createMockAuditService();
        mockParticipantService = { validateVisitorsNotBlacklisted: jest.fn() };
        mockVisitorPersistence = {
            upsertByPersonId: jest.fn().mockResolvedValue({
                action: 'created',
                visitor: { id: 'visitor-1' },
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitsService,
                { provide: getRepositoryToken(Visit), useValue: mockVisitRepo },
                { provide: getRepositoryToken(VisitVisitor), useValue: mockVvRepo },
                { provide: getRepositoryToken(VisitEscort), useValue: mockEscortRepo },
                { provide: getRepositoryToken(VisitVisitorStatus), useValue: mockStatusRepo },
                { provide: getRepositoryToken(Visitor), useValue: mockVisitorRepo },
                { provide: getRepositoryToken(User), useValue: mockUserRepo },
                { provide: DataSource, useValue: mockDs },
                { provide: UsersGateway, useValue: mockWs },
                { provide: SmsNotificationService, useValue: { triggerSms: jest.fn().mockResolvedValue(undefined) } },
                { provide: EmailNotificationService, useValue: { triggerEmail: jest.fn().mockResolvedValue(undefined) } },
                { provide: AuditService, useValue: mockAuditService },
                { provide: VisitorPersistenceService, useValue: mockVisitorPersistence },
                { provide: VisitParticipantService, useValue: mockParticipantService },
                { provide: VisitCheckInCodeService, useValue: { generateCodesForVisit: jest.fn().mockResolvedValue([]), sendCodeNotifications: jest.fn().mockResolvedValue({}) } },
            ],
        }).compile();

        service = module.get<VisitsService>(VisitsService);
    });

    // ── resolveVisitRequester ──

    describe('resolveVisitRequester', () => {
        it('should return user data when visitRequesterUserId is set with loaded user', () => {
            const visit = {
                visitRequesterUserId: 'u1',
                visitRequesterUser: { firstName: 'Alice', lastName: 'Admin', phone: '+972501111111', email: 'alice@example.com' },
                visitRequesterFirstName: null,
                visitRequesterLastName: null,
            } as any;
            const result = service.resolveVisitRequester(visit);
            expect(result).toEqual({ firstName: 'Alice', lastName: 'Admin', phone: '+972501111111', email: 'alice@example.com' });
        });

        it('should return stored fields when visitRequesterUserId is null', () => {
            const visit = {
                visitRequesterUserId: null,
                visitRequesterUser: null,
                visitRequesterFirstName: 'Manual', visitRequesterLastName: 'Person',
                visitRequesterPhone: '555', visitRequesterEmail: 'm@p.com',
            } as any;
            const result = service.resolveVisitRequester(visit);
            expect(result).toEqual({ firstName: 'Manual', lastName: 'Person', phone: '555', email: 'm@p.com' });
        });

        it('should return null when no requester data exists', () => {
            const visit = {
                visitRequesterUserId: null, visitRequesterUser: null,
                visitRequesterFirstName: null, visitRequesterLastName: null,
            } as any;
            expect(service.resolveVisitRequester(visit)).toBeNull();
        });
    });

    // ── Visits CRUD ──

    describe('findAllVisits', () => {
        it('should return paginated visits with status summaries', async () => {
            const visits = [{ id: 'v1', title: 'Meeting', visitRequesterFirstName: 'John', visitRequesterLastName: 'Doe', visitRequesterPhone: '123', visitRequesterEmail: 'j@d.com' }];
            const visitQb = createMockQueryBuilder(visits, 1);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const statusQb = createMockQueryBuilder([{ visitId: 'v1', total: '2', pending: '1', arrived: '1', checkedIn: '0', checkedOut: '0' }]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.findAllVisits({ page: 1, limit: 10 });

            expect(result.items).toHaveLength(1);
            expect(result.items[0].visitRequester).toBeDefined();
            expect(result.items[0].visitRequester.firstName).toBe('John');
            expect(result.items[0].statusSummary).toBeDefined();
            expect(result.total).toBe(1);
        });

        it('should apply search filter', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            await service.findAllVisits({ page: 1, limit: 10, search: 'meeting' });

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                '(v.title LIKE :s OR v.purposeOfVisit LIKE :s OR building.name LIKE :s)',
                { s: '%meeting%' },
            );
        });

        it('should apply timeFilter=today', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            await service.findAllVisits({ page: 1, limit: 10, timeFilter: 'today' });

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                'v.plannedStartTimeUtc < :dayEnd',
                expect.objectContaining({ dayEnd: expect.any(Date) }),
            );
            expect(visitQb.andWhere).toHaveBeenCalledWith(
                '(v.plannedStartTimeUtc >= :dayStart OR (v.plannedEndTimeUtc IS NOT NULL AND v.plannedEndTimeUtc >= :dayStartBound))',
                expect.objectContaining({ dayStart: expect.any(Date), dayStartBound: expect.any(Date) }),
            );
        });

        it('should apply timeFilter=future', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            await service.findAllVisits({ page: 1, limit: 10, timeFilter: 'future' });

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                'v.plannedStartTimeUtc > :now',
                expect.objectContaining({ now: expect.any(String) }),
            );
        });

        it('should apply timeFilter=history', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            await service.findAllVisits({ page: 1, limit: 10, timeFilter: 'history' });

            expect(visitQb.andWhere).toHaveBeenCalledWith('v.plannedEndTimeUtc IS NOT NULL');
            expect(visitQb.andWhere).toHaveBeenCalledWith(
                'v.plannedEndTimeUtc < :now',
                expect.objectContaining({ now: expect.any(String) }),
            );
        });

        it('should combine search and timeFilter', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            await service.findAllVisits({ page: 1, limit: 10, search: 'test', timeFilter: 'future' });

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                'v.plannedStartTimeUtc > :now',
                expect.objectContaining({ now: expect.any(String) }),
            );
            expect(visitQb.andWhere).toHaveBeenCalledWith(
                '(v.title LIKE :s OR v.purposeOfVisit LIKE :s OR building.name LIKE :s)',
                { s: '%test%' },
            );
        });

        it('should scope visits list to current user for own-scope permission', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            await service.findAllVisits({ page: 1, limit: 10 }, 'user-1', [PermissionKey.VisitsScopeOwn]);

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                'v.createdByUserId IN (:...creatorUserIds)',
                { creatorUserIds: ['user-1'] },
            );
        });

        it('should scope visits list to creators with training-center scope permission', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            const usersQb = createMockQueryBuilder([{ id: 'user-2' }, { id: 'user-3' }]);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);
            mockUserRepo.createQueryBuilder.mockReturnValue(usersQb);

            await service.findAllVisits({ page: 1, limit: 10 }, 'user-1', [PermissionKey.VisitsScopeTrainingCenter]);

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                'v.createdByUserId IN (:...creatorUserIds)',
                { creatorUserIds: ['user-2', 'user-3'] },
            );
        });
    });

    describe('exportVisitsToExcel', () => {
        it('should return an Excel buffer with visit data', async () => {
            const visits = [{
                id: 'v1', title: 'Meeting', floor: 3, purposeOfVisit: 'Business',
                plannedStartTimeUtc: new Date('2025-06-01T09:00:00Z'),
                plannedEndTimeUtc: new Date('2025-06-01T17:00:00Z'),
                building: { name: 'HQ' },
                visitRequesterFirstName: 'John', visitRequesterLastName: 'Doe',
                visitRequesterPhone: '123', visitRequesterEmail: 'j@d.com',
                visitRequesterUserId: null, visitRequesterUser: null,
                visitVisitors: [{
                    visitor: { firstName: 'Alice', lastName: 'Smith', phone: '555', email: 'a@s.com', personId: 'ID1', carNumber: 'ABC' },
                    status: { currentStatus: 2 },
                }],
                visitEscorts: [{ firstName: 'Bob', lastName: 'Guard', phone: '666', email: 'b@g.com' }],
            }];
            const visitQb = createMockQueryBuilder(visits, 1);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const result = await service.exportVisitsToExcel({ page: 1, limit: 10 });

            expect(result).toBeInstanceOf(Buffer);
            expect(result.length).toBeGreaterThan(0);
        });

        it('should produce rows for each visitor and escort', async () => {
            const visits = [{
                id: 'v1', title: 'Team Visit', floor: null, purposeOfVisit: null,
                plannedStartTimeUtc: new Date('2025-06-01T09:00:00Z'),
                plannedEndTimeUtc: null,
                building: null,
                visitRequesterFirstName: null, visitRequesterLastName: null,
                visitRequesterPhone: null, visitRequesterEmail: null,
                visitRequesterUserId: null, visitRequesterUser: null,
                visitVisitors: [
                    { visitor: { firstName: 'V1', lastName: 'L1', phone: '1', email: '1@e.com', personId: 'P1', carNumber: null }, status: { currentStatus: 0 } },
                    { visitor: { firstName: 'V2', lastName: 'L2', phone: '2', email: '2@e.com', personId: 'P2', carNumber: null }, status: null },
                ],
                visitEscorts: [{ firstName: 'E1', lastName: 'EL1', phone: '3', email: '3@e.com' }],
            }];
            const visitQb = createMockQueryBuilder(visits, 1);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const result = await service.exportVisitsToExcel({ page: 1, limit: 10 });

            expect(result).toBeInstanceOf(Buffer);
            // 2 visitors + 1 escort = 3 data rows
            expect(visitQb.leftJoinAndSelect).toHaveBeenCalledWith('v.visitVisitors', 'vv');
            expect(visitQb.leftJoinAndSelect).toHaveBeenCalledWith('vv.visitor', 'visitor');
            expect(visitQb.leftJoinAndSelect).toHaveBeenCalledWith('v.visitEscorts', 'escort');
        });

        it('should apply time filter and search for export', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            await service.exportVisitsToExcel({ page: 1, limit: 10, timeFilter: 'today', search: 'test' });

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                'v.plannedStartTimeUtc < :dayEnd',
                expect.objectContaining({ dayEnd: expect.any(Date) }),
            );
            expect(visitQb.andWhere).toHaveBeenCalledWith(
                '(v.plannedStartTimeUtc >= :dayStart OR (v.plannedEndTimeUtc IS NOT NULL AND v.plannedEndTimeUtc >= :dayStartBound))',
                expect.objectContaining({ dayStart: expect.any(Date), dayStartBound: expect.any(Date) }),
            );
            expect(visitQb.andWhere).toHaveBeenCalledWith(
                '(v.title LIKE :s OR v.purposeOfVisit LIKE :s OR building.name LIKE :s)',
                { s: '%test%' },
            );
        });

        it('should produce a row with empty fields when visit has no visitors or escorts', async () => {
            const visits = [{
                id: 'v1', title: 'Empty Visit', floor: null, purposeOfVisit: null,
                plannedStartTimeUtc: new Date('2025-06-01T09:00:00Z'),
                plannedEndTimeUtc: null,
                building: null,
                visitRequesterFirstName: null, visitRequesterLastName: null,
                visitRequesterPhone: null, visitRequesterEmail: null,
                visitRequesterUserId: null, visitRequesterUser: null,
                visitVisitors: [],
                visitEscorts: [],
            }];
            const visitQb = createMockQueryBuilder(visits, 1);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const result = await service.exportVisitsToExcel({ page: 1, limit: 10 });

            expect(result).toBeInstanceOf(Buffer);
        });
    });

    describe('findVisitsByDateRange', () => {
        it('should return visits within date range with status summaries', async () => {
            const visits = [{ id: 'v1', title: 'Meeting', visitRequesterFirstName: 'John', visitRequesterLastName: 'Doe', visitRequesterPhone: '123', visitRequesterEmail: 'j@d.com' }];
            const visitQb = createMockQueryBuilder(visits);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const statusQb = createMockQueryBuilder([{ visitId: 'v1', total: '2', pending: '1', arrived: '1', checkedIn: '0', checkedOut: '0' }]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.findVisitsByDateRange('2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z', undefined, 'user-1');

            expect(result).toHaveLength(1);
            expect(result[0].visitRequester).toBeDefined();
            expect(result[0].visitRequester.firstName).toBe('John');
            expect(result[0].statusSummary).toBeDefined();
            expect(visitQb.andWhere).toHaveBeenCalledWith('v.visitRequesterUserId = :calendarUserId', { calendarUserId: 'user-1' });
        });

        it('should apply search filter when provided', async () => {
            const visitQb = createMockQueryBuilder([]);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            await service.findVisitsByDateRange('2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z', 'test', 'user-1');

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                '(v.title LIKE :s OR v.purposeOfVisit LIKE :s OR v.visitRequesterFirstName LIKE :s OR v.visitRequesterLastName LIKE :s OR reqUser.firstName LIKE :s OR reqUser.lastName LIKE :s)',
                { s: '%test%' },
            );
        });

        it('should return empty array when no currentUserId provided', async () => {
            const visitQb = createMockQueryBuilder([]);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const result = await service.findVisitsByDateRange('2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z');

            expect(result).toEqual([]);
            expect(visitQb.andWhere).toHaveBeenCalledWith('1 = 0');
        });
    });

    describe('findMyCalendarVisits', () => {
        it('should filter visits to created by or requested for the logged user', async () => {
            const visits = [{ id: 'v1', title: 'My Visit', visitRequesterFirstName: 'John', visitRequesterLastName: 'Doe', visitRequesterPhone: '123', visitRequesterEmail: 'j@d.com' }];
            const visitQb = createMockQueryBuilder(visits);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const statusQb = createMockQueryBuilder([{ visitId: 'v1', total: '1', pending: '1', arrived: '0', checkedIn: '0', checkedOut: '0' }]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.findMyCalendarVisits('2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z', undefined, 'user-1');

            expect(result).toHaveLength(1);
            expect(visitQb.andWhere).toHaveBeenCalledWith(
                'v.visitRequesterUserId = :myUserId',
                { myUserId: 'user-1' },
            );
        });

        it('should return no visits when currentUserId is not provided', async () => {
            const visitQb = createMockQueryBuilder([]);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const result = await service.findMyCalendarVisits('2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z');

            expect(result).toEqual([]);
            expect(visitQb.andWhere).toHaveBeenCalledWith('1 = 0');
        });

        it('should apply search filter when provided', async () => {
            const visitQb = createMockQueryBuilder([]);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            await service.findMyCalendarVisits('2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z', 'test', 'user-1');

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                '(v.title LIKE :s OR v.purposeOfVisit LIKE :s OR v.visitRequesterFirstName LIKE :s OR v.visitRequesterLastName LIKE :s OR reqUser.firstName LIKE :s OR reqUser.lastName LIKE :s)',
                { s: '%test%' },
            );
        });
    });

    describe('findVisitById', () => {
        it('should return visit with status summary', async () => {
            const visit = { id: 'v1', title: 'Meeting', visitRequesterFirstName: 'John', visitRequesterLastName: 'Doe', visitRequesterPhone: '123', visitRequesterEmail: 'j@d.com' };
            mockVisitRepo.findOne.mockResolvedValue(visit);

            const statusQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.findVisitById('v1');

            expect(result.title).toBe('Meeting');
            expect(result.visitRequester.firstName).toBe('John');
            expect(result.statusSummary).toBeDefined();
        });

        it('should throw NotFoundException', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.findVisitById('bad')).rejects.toThrow(NotFoundException);
        });

        it('should hide non-owned visit for עובד מגדל', async () => {
            const visit = {
                id: 'v1',
                title: 'Meeting',
                createdByUserId: 'another-user',
                visitRequesterFirstName: 'John',
                visitRequesterLastName: 'Doe',
                visitRequesterPhone: '123',
                visitRequesterEmail: 'j@d.com',
            };
            mockVisitRepo.findOne.mockResolvedValue(visit);

            await expect(service.findVisitById('v1', 'user-1', [PermissionKey.VisitsScopeOwn])).rejects.toThrow(NotFoundException);
        });

        it('should hide visit created outside מרכז הדרכות scope', async () => {
            const visit = {
                id: 'v1',
                title: 'Meeting',
                createdByUserId: 'outside-user',
                visitRequesterFirstName: 'John',
                visitRequesterLastName: 'Doe',
                visitRequesterPhone: '123',
                visitRequesterEmail: 'j@d.com',
            };
            const usersQb = createMockQueryBuilder([{ id: 'center-user' }]);
            mockVisitRepo.findOne.mockResolvedValue(visit);
            mockUserRepo.createQueryBuilder.mockReturnValue(usersQb);

            await expect(service.findVisitById('v1', 'user-1', [PermissionKey.VisitsScopeTrainingCenter])).rejects.toThrow(NotFoundException);
        });
    });

    describe('createVisit', () => {
        const validDto = {
            title: 'Meeting',
            plannedStartTimeUtc: '2025-01-15T09:00:00.000Z',
            plannedEndTimeUtc: '2025-01-15T17:00:00.000Z',
            visitRequester: { firstName: 'John', lastName: 'Doe', phone: '123', email: 'j@d.com' },
            visitors: [{
                firstName: 'Jane', lastName: 'Smith', personId: '123456789',
            }],
            escorts: [{ firstName: 'Bob', lastName: 'Guard', phone: '555', email: 'b@g.com' }],
        };

        beforeEach(() => {
            mockUserRepo.findOne.mockResolvedValue({
                id: 'user-1',
                firstName: 'Current',
                lastName: 'User',
                phone: '+972501112233',
                email: 'current.user@example.com',
                sectorId: 'sector-1',
                sector: { id: 'sector-1', name: 'Operations' },
            });
            // Mock findVisitById for return after creation
            mockVisitRepo.findOne.mockResolvedValue({
                id: 'new-visit', title: 'Meeting',
                sector: { id: 'sector-1', name: 'Operations' },
                visitRequesterFirstName: 'John', visitRequesterLastName: 'Doe',
                visitRequesterPhone: '123', visitRequesterEmail: 'j@d.com',
            });
            const statusQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);
        });

        it('should throw if no visitors provided', async () => {
            await expect(service.createVisit({ ...validDto, visitors: [] } as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw if visitor is blacklisted', async () => {
            mockParticipantService.validateVisitorsNotBlacklisted.mockRejectedValue(
                new BadRequestException('Visitor is blacklisted: Banned'),
            );
            await expect(service.createVisit(validDto as any, 'user-1'))
                .rejects.toThrow(BadRequestException);
        });

        it('should throw if end datetime is before start datetime', async () => {
            const badDto = {
                ...validDto,
                plannedEndTimeUtc: '2025-01-14T08:00:00.000Z',
            };
            await expect(service.createVisit(badDto as any, 'user-1'))
                .rejects.toThrow(BadRequestException);
        });

        it('should create visit with visitors and escorts in transaction', async () => {
            await service.createVisit(validDto as any, 'user-1');

            expect(mockDs._queryRunner.connect).toHaveBeenCalled();
            expect(mockDs._queryRunner.startTransaction).toHaveBeenCalled();
            expect(mockDs._queryRunner.commitTransaction).toHaveBeenCalled();
            expect(mockDs._queryRunner.release).toHaveBeenCalled();
            expect(mockWs.broadcastToAll).toHaveBeenCalledWith('visits:created', expect.any(Object));
            // When visitRequester is provided, store manual fields with no userId
            expect(mockDs._qrManager.create).toHaveBeenCalledWith(
                Visit,
                expect.objectContaining({
                    sectorId: 'sector-1',
                    visitRequesterUserId: null,
                    visitRequesterFirstName: 'John',
                    visitRequesterLastName: 'Doe',
                }),
            );
        });

        it('should rollback transaction on error', async () => {
            mockDs._qrManager.save.mockRejectedValueOnce(new Error('DB error'));

            await expect(service.createVisit(validDto as any, 'user-1')).rejects.toThrow('DB error');
            expect(mockDs._queryRunner.rollbackTransaction).toHaveBeenCalled();
            expect(mockDs._queryRunner.release).toHaveBeenCalled();
        });

        it('should store visitRequesterUserId when visitRequester not provided', async () => {
            const dtoWithoutRequester = { ...validDto, visitRequester: undefined };

            await service.createVisit(dtoWithoutRequester as any, 'user-1');

            expect(mockDs._qrManager.create).toHaveBeenCalledWith(
                Visit,
                expect.objectContaining({
                    sectorId: 'sector-1',
                    visitRequesterUserId: 'user-1',
                    visitRequesterFirstName: null,
                    visitRequesterLastName: null,
                    visitRequesterPhone: null,
                    visitRequesterEmail: null,
                }),
            );
        });

        it('should auto-assign current user as escort when no escort was selected', async () => {
            const dtoWithoutRequesterAndEscort = {
                ...validDto,
                visitRequester: undefined,
                escorts: [],
            };

            await service.createVisit(dtoWithoutRequesterAndEscort as any, 'user-1');

            expect(mockDs._qrManager.create).toHaveBeenCalledWith(
                VisitEscort,
                expect.objectContaining({
                    firstName: 'Current',
                    lastName: 'User',
                    phone: '+972501112233',
                    email: 'current.user@example.com',
                    sector: 'Operations',
                }),
            );
        });

        it('should auto-assign visit requester as escort when no escort was selected on behalf flow', async () => {
            const dtoWithoutEscort = {
                ...validDto,
                escorts: [],
            };

            await service.createVisit(dtoWithoutEscort as any, 'user-1');

            expect(mockDs._qrManager.create).toHaveBeenCalledWith(
                VisitEscort,
                expect.objectContaining({
                    firstName: 'John',
                    lastName: 'Doe',
                    phone: '123',
                    email: 'j@d.com',
                }),
            );
        });

        it('should not override explicitly provided escorts on create', async () => {
            await service.createVisit(validDto as any, 'user-1');

            expect(mockDs._qrManager.create).toHaveBeenCalledWith(
                VisitEscort,
                expect.objectContaining({
                    firstName: 'Bob',
                    lastName: 'Guard',
                    phone: '555',
                    email: 'b@g.com',
                }),
            );
        });

        it('should skip auto-assigned escort when current user profile is incomplete and escort not required', async () => {
            mockUserRepo.findOne.mockResolvedValue({
                id: 'user-1',
                firstName: 'Current',
                lastName: 'User',
                phone: null,
                email: null,
                sectorId: 'sector-1',
                sector: { id: 'sector-1', name: 'Operations' },
            });

            const dtoWithoutRequesterAndEscort = {
                ...validDto,
                visitRequester: undefined,
                escorts: [],
            };

            const result = await service.createVisit(dtoWithoutRequesterAndEscort as any, 'user-1');
            expect(result).toBeDefined();
            expect(mockDs._qrManager.create).not.toHaveBeenCalledWith(
                VisitEscort,
                expect.anything(),
            );
        });

        it('should throw if visitRequester not provided and no currentUserId', async () => {
            const dtoWithoutRequester = { ...validDto, visitRequester: undefined };
            await expect(service.createVisit(dtoWithoutRequester as any))
                .rejects.toThrow(BadRequestException);
        });

        it('should require escort when escort-required permission exists', async () => {
            const dtoWithoutEscorts = { ...validDto, escorts: [] };

            await expect(service.createVisit(dtoWithoutEscorts as any, 'user-1', [PermissionKey.VisitsEscortRequired]))
                .rejects.toThrow(new BadRequestException('At least one escort is required for the current user'));
        });

        it('should require escort for self requester when self-requester escort permission exists', async () => {
            const dtoSelfRequesterNoEscorts = { ...validDto, visitRequester: undefined, escorts: [] };

            await expect(service.createVisit(dtoSelfRequesterNoEscorts as any, 'user-1', [PermissionKey.VisitsEscortRequiredSelfRequester]))
                .rejects.toThrow(new BadRequestException('At least one escort is required for the current user'));
        });

        it('should not require escort for manual requester with self-requester escort permission', async () => {
            const dtoNoEscorts = { ...validDto, escorts: [] };

            await expect(service.createVisit(dtoNoEscorts as any, 'user-1', [PermissionKey.VisitsEscortRequiredSelfRequester]))
                .resolves.toBeDefined();
        });

        it('should forbid self requester when on-behalf-only permission exists', async () => {
            const dtoSelfRequester = { ...validDto, visitRequester: undefined };

            await expect(service.createVisit(dtoSelfRequester as any, 'user-1', [PermissionKey.VisitsOnBehalfOnly]))
                .rejects.toThrow(new BadRequestException('This role must create visits on behalf of another requester'));
        });

        it('should allow on-behalf invitation when on-behalf-only permission exists', async () => {
            await expect(service.createVisit(validDto as any, 'user-1', [PermissionKey.VisitsOnBehalfOnly]))
                .resolves.toBeDefined();
        });

        it('should forbid self requester with on-behalf-only permission regardless of role name', async () => {
            const dtoSelfRequester = { ...validDto, visitRequester: undefined };

            await expect(service.createVisit(dtoSelfRequester as any, 'user-1', [PermissionKey.VisitsOnBehalfOnly]))
                .rejects.toThrow(new BadRequestException('This role must create visits on behalf of another requester'));
        });

        it('should allow on-behalf invitation with on-behalf-only permission', async () => {
            await expect(service.createVisit(validDto as any, 'user-1', [PermissionKey.VisitsOnBehalfOnly]))
                .resolves.toBeDefined();
        });

        it('should return sector details on the created visit payload', async () => {
            const result = await service.createVisit(validDto as any, 'user-1');

            expect(result.sector).toEqual({ id: 'sector-1', name: 'Operations' });
        });

        it('should pass vehicle fields when hasVehicle is true', async () => {
            const dtoWithVehicle = {
                ...validDto,
                visitors: [{
                    firstName: 'Jane', lastName: 'Smith', personId: '123456789',
                    hasVehicle: true, carNumber: 'ABC123', vehicleType: 'private',
                }],
            };

            await service.createVisit(dtoWithVehicle as any, 'user-1');

            expect(mockVisitorPersistence.upsertByPersonId).toHaveBeenCalledWith(
                expect.objectContaining({ carNumber: 'ABC123', vehicleType: 'private' }),
                'user-1',
                mockDs._qrManager,
            );
        });

        it('should clear vehicle fields when hasVehicle is false', async () => {
            const dtoNoVehicle = {
                ...validDto,
                visitors: [{
                    firstName: 'Jane', lastName: 'Smith', personId: '123456789',
                    hasVehicle: false, carNumber: 'ABC123', vehicleType: 'private',
                }],
            };

            await service.createVisit(dtoNoVehicle as any, 'user-1');

            expect(mockVisitorPersistence.upsertByPersonId).toHaveBeenCalledWith(
                expect.objectContaining({ carNumber: null, vehicleType: null }),
                'user-1',
                mockDs._qrManager,
            );
        });

    });

    describe('updateVisit', () => {
        beforeEach(() => {
            mockEscortRepo.count.mockResolvedValue(1);
        });

        it('should update visit fields', async () => {
            const existing = {
                id: 'v1', title: 'Old', plannedStartTimeUtc: new Date('2025-01-15T09:00:00Z'),
                plannedEndTimeUtc: new Date('2025-01-15T17:00:00Z'), isActive: true,
                visitRequesterFirstName: 'J', visitRequesterLastName: 'D', visitRequesterPhone: '1', visitRequesterEmail: 'j@d.com',
            };
            mockVisitRepo.findOne.mockResolvedValue(existing);
            mockVisitRepo.save.mockImplementation((e: any) => Promise.resolve(e));

            // Mock findVisitById return
            const statusQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.updateVisit('v1', { title: 'New Title' } as any, 'user-1');

            expect(mockVisitRepo.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }));
        });

        it('should throw NotFoundException on missing visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.updateVisit('bad', {} as any)).rejects.toThrow(NotFoundException);
        });

        it('should throw if end datetime is before start datetime', async () => {
            const existing = {
                id: 'v1', title: 'Test', isActive: true,
                plannedStartTimeUtc: new Date('2025-01-15T09:00:00Z'),
                plannedEndTimeUtc: new Date('2025-01-15T17:00:00Z'),
            };
            mockVisitRepo.findOne.mockResolvedValue(existing);

            await expect(service.updateVisit('v1', {
                plannedStartTimeUtc: '2025-01-15T18:00:00.000Z',
                plannedEndTimeUtc: '2025-01-15T08:00:00.000Z',
            } as any)).rejects.toThrow(BadRequestException);
        });

        it('should set visitRequesterUserId and clear fields when visitRequester is null', async () => {
            const existing = {
                id: 'v1', title: 'Test', isActive: true,
                plannedStartTimeUtc: new Date('2025-01-15T09:00:00Z'),
                plannedEndTimeUtc: new Date('2025-01-15T17:00:00Z'),
                visitRequesterFirstName: 'Old', visitRequesterLastName: 'Requester',
                visitRequesterPhone: '000', visitRequesterEmail: 'old@test.com',
                visitRequesterUserId: null,
            };
            mockVisitRepo.findOne.mockResolvedValue(existing);
            mockVisitRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockUserRepo.findOne.mockResolvedValue({
                id: 'user-1', firstName: 'Alice', lastName: 'Admin',
                phone: '+972501111111', email: 'alice@example.com',
            });
            const statusQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.updateVisit('v1', { visitRequester: null } as any, 'user-1');

            expect(mockVisitRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                visitRequesterUserId: 'user-1',
                visitRequesterFirstName: null,
                visitRequesterLastName: null,
                visitRequesterPhone: null,
                visitRequesterEmail: null,
            }));
        });

        it('should auto-assign requester user as escort on update when no escort exists', async () => {
            const existing = {
                id: 'v1',
                title: 'Visit',
                isActive: true,
                plannedStartTimeUtc: new Date('2025-01-15T09:00:00Z'),
                plannedEndTimeUtc: new Date('2025-01-15T17:00:00Z'),
                visitRequesterUserId: 'requester-1',
                visitRequesterUser: null,
                visitRequesterFirstName: null,
                visitRequesterLastName: null,
                visitRequesterPhone: null,
                visitRequesterEmail: null,
            };
            mockVisitRepo.findOne.mockResolvedValue(existing);
            mockVisitRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockEscortRepo.count.mockResolvedValue(0);
            mockUserRepo.findOne.mockResolvedValue({
                id: 'requester-1',
                firstName: 'Req',
                lastName: 'User',
                phone: '+972500000001',
                email: 'req.user@example.com',
                sector: { id: 'sector-1', name: 'Operations' },
            });
            const statusQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.updateVisit('v1', { title: 'Updated' } as any, 'editor-1');

            expect(mockEscortRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                visitId: 'v1',
                firstName: 'Req',
                lastName: 'User',
                phone: '+972500000001',
                email: 'req.user@example.com',
                sector: 'Operations',
            }));
            expect(mockEscortRepo.save).toHaveBeenCalled();
        });

        it('should auto-assign current user as escort on update when switching requester to self and no escort exists', async () => {
            const existing = {
                id: 'v1',
                title: 'Visit',
                isActive: true,
                plannedStartTimeUtc: new Date('2025-01-15T09:00:00Z'),
                plannedEndTimeUtc: new Date('2025-01-15T17:00:00Z'),
                visitRequesterUserId: null,
                visitRequesterUser: null,
                visitRequesterFirstName: 'Manual',
                visitRequesterLastName: 'Requester',
                visitRequesterPhone: '+972500000002',
                visitRequesterEmail: 'manual@example.com',
            };
            mockVisitRepo.findOne.mockResolvedValue(existing);
            mockVisitRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockEscortRepo.count.mockResolvedValue(0);
            mockUserRepo.findOne.mockResolvedValue({
                id: 'user-1',
                firstName: 'Current',
                lastName: 'User',
                phone: '+972500000003',
                email: 'current.user@example.com',
                sector: { id: 'sector-2', name: 'Security' },
            });
            const statusQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.updateVisit('v1', { visitRequester: null } as any, 'user-1');

            expect(mockEscortRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                visitId: 'v1',
                firstName: 'Current',
                lastName: 'User',
                phone: '+972500000003',
                email: 'current.user@example.com',
                sector: 'Security',
            }));
            expect(mockEscortRepo.save).toHaveBeenCalled();
        });

        it('should not override existing escort on update', async () => {
            const existing = {
                id: 'v1',
                title: 'Visit',
                isActive: true,
                plannedStartTimeUtc: new Date('2025-01-15T09:00:00Z'),
                plannedEndTimeUtc: new Date('2025-01-15T17:00:00Z'),
                visitRequesterUserId: null,
                visitRequesterUser: null,
                visitRequesterFirstName: 'Manual',
                visitRequesterLastName: 'Requester',
                visitRequesterPhone: '+972500000002',
                visitRequesterEmail: 'manual@example.com',
            };
            mockVisitRepo.findOne.mockResolvedValue(existing);
            mockVisitRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockEscortRepo.count.mockResolvedValue(2);
            const statusQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.updateVisit('v1', { title: 'Updated' } as any, 'user-1');

            expect(mockEscortRepo.create).not.toHaveBeenCalled();
            expect(mockEscortRepo.save).not.toHaveBeenCalled();
        });

        it('should validate auto-assigned escort data on update when no escort exists', async () => {
            const existing = {
                id: 'v1',
                title: 'Visit',
                isActive: true,
                plannedStartTimeUtc: new Date('2025-01-15T09:00:00Z'),
                plannedEndTimeUtc: new Date('2025-01-15T17:00:00Z'),
                visitRequesterUserId: null,
                visitRequesterUser: null,
                visitRequesterFirstName: null,
                visitRequesterLastName: null,
                visitRequesterPhone: null,
                visitRequesterEmail: null,
            };
            mockVisitRepo.findOne.mockResolvedValue(existing);
            mockVisitRepo.save.mockImplementation((e: any) => Promise.resolve(e));
            mockEscortRepo.count.mockResolvedValue(0);

            await expect(service.updateVisit('v1', { title: 'Updated' } as any, 'user-1'))
                .rejects.toThrow(new BadRequestException('Cannot auto-assign escort from visit requester: firstName, lastName, phone and email are required'));
        });
    });

    describe('removeVisit', () => {
        it('should soft-delete visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: 'v1', isActive: true });
            await service.removeVisit('v1', 'user-1');
            expect(mockVisitRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
        });

        it('should throw NotFoundException on missing visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);
            await expect(service.removeVisit('bad')).rejects.toThrow(NotFoundException);
        });

        it('should allow own-only delete permission to remove own visit', async () => {
            mockVisitRepo.findOne.mockResolvedValue({
                id: 'v1',
                title: 'Own Visit',
                isActive: true,
                createdByUserId: 'user-1',
            });

            await service.removeVisit('v1', 'user-1', [PermissionKey.VisitsDeleteOwnOnly]);

            expect(mockVisitRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
        });

        it('should hide other users visits when own-only delete permission exists', async () => {
            mockVisitRepo.findOne.mockResolvedValue({
                id: 'v1',
                title: 'Foreign Visit',
                isActive: true,
                createdByUserId: 'user-2',
            });

            await expect(service.removeVisit('v1', 'user-1', [PermissionKey.VisitsDeleteOwnOnly])).rejects.toThrow(NotFoundException);
        });
    });

    // ── getTodaySummary ──

    describe('getTodaySummary', () => {
        it('should return summary with counts for today', async () => {
            const visitQb = createMockQueryBuilder([], 5);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const statusQb = createMockQueryBuilder([
                { currentStatus: VisitorStatus.Arrived, cnt: '3' },
                { currentStatus: VisitorStatus.CheckedIn, cnt: '2' },
                { currentStatus: VisitorStatus.CheckedOut, cnt: '4' },
            ]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.getTodaySummary();

            expect(result).toEqual({
                totalVisitsToday: 5,
                arrivedToday: 3,
                checkedInToday: 2,
                completedToday: 4,
            });
        });

        it('should return zeros when no data exists', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const statusQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.getTodaySummary();

            expect(result).toEqual({
                totalVisitsToday: 0,
                arrivedToday: 0,
                checkedInToday: 0,
                completedToday: 0,
            });
        });

        it('should handle partial statuses', async () => {
            const visitQb = createMockQueryBuilder([], 2);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const statusQb = createMockQueryBuilder([
                { currentStatus: VisitorStatus.Arrived, cnt: '1' },
            ]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            const result = await service.getTodaySummary();

            expect(result).toEqual({
                totalVisitsToday: 2,
                arrivedToday: 1,
                checkedInToday: 0,
                completedToday: 0,
            });
        });

        it('should query with correct date range', async () => {
            const visitQb = createMockQueryBuilder([], 0);
            mockVisitRepo.createQueryBuilder.mockReturnValue(visitQb);

            const statusQb = createMockQueryBuilder([]);
            mockStatusRepo.createQueryBuilder.mockReturnValue(statusQb);

            await service.getTodaySummary();

            expect(visitQb.andWhere).toHaveBeenCalledWith(
                'v.plannedStartTimeUtc < :dayEnd',
                expect.objectContaining({ dayEnd: expect.any(Date) }),
            );
            expect(visitQb.andWhere).toHaveBeenCalledWith(
                '(v.plannedStartTimeUtc >= :dayStart OR (v.plannedEndTimeUtc IS NOT NULL AND v.plannedEndTimeUtc >= :dayStartBound))',
                expect.objectContaining({ dayStart: expect.any(Date), dayStartBound: expect.any(Date) }),
            );
        });
    });
});
