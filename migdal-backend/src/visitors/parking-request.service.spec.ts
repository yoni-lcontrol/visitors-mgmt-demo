import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ParkingRequestService } from './parking-request.service';
import { ParkingRequest } from './entities/parking-request.entity';
import { ParkingRequestStatus } from './enums/parking-request-status.enum';
import { SmsNotificationService } from '../settings/sms-notification.service';
import { EmailNotificationService } from '../settings/email-notification.service';
import { NotificationEvent } from '../settings/enums/notification-event.enum';
import { AuditService } from '../audit/audit.service';

describe('ParkingRequestService', () => {
    let service: ParkingRequestService;
    let repo: Record<string, jest.Mock>;
    let mockSmsNotification: { triggerSms: jest.Mock };
    let mockEmailNotification: { triggerEmail: jest.Mock };
    let mockAuditService: { log: jest.Mock };

    beforeEach(async () => {
        repo = {
            findOne: jest.fn(),
            create: jest.fn((dto) => dto),
            save: jest.fn((entity) => Promise.resolve({ id: 'new-id', ...entity })),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        mockSmsNotification = {
            triggerSms: jest.fn().mockResolvedValue(undefined),
        };
        mockEmailNotification = {
            triggerEmail: jest.fn().mockResolvedValue(undefined),
        };
        mockAuditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ParkingRequestService,
                { provide: getRepositoryToken(ParkingRequest), useValue: repo },
                { provide: SmsNotificationService, useValue: mockSmsNotification },
                { provide: EmailNotificationService, useValue: mockEmailNotification },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<ParkingRequestService>(ParkingRequestService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('should return paginated results with creator join', async () => {
            const mockQb = {
                innerJoinAndSelect: jest.fn().mockReturnThis(),
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(1),
                getMany: jest.fn().mockResolvedValue([{
                    id: 'pr-1',
                    visitVisitor: {
                        visit: { title: 'V1', createdByUser: { firstName: 'John', lastName: 'Doe' } },
                        visitor: { firstName: 'Jane', lastName: 'Smith', carNumber: 'ABC' },
                    },
                }]),
            };
            repo.createQueryBuilder.mockReturnValue(mockQb);

            const result = await service.findAll({ page: 1, limit: 10 });

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.items[0].visitVisitor.visit.createdByUser.firstName).toBe('John');
            expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith('visit.createdByUser', 'creator');
        });

        it('should apply column filters when provided', async () => {
            const mockQb = {
                innerJoinAndSelect: jest.fn().mockReturnThis(),
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(0),
                getMany: jest.fn().mockResolvedValue([]),
            };
            repo.createQueryBuilder.mockReturnValue(mockQb);

            const filters = JSON.stringify({ carNumber: { value: 'ABC', matchMode: 'contains' } });
            await service.findAll({ page: 1, limit: 10, filters });

            expect(mockQb.andWhere).toHaveBeenCalledWith(
                expect.stringContaining('vis.carNumber LIKE'),
                expect.objectContaining({ f_carNumber_0: '%ABC%' }),
            );
        });

        it('should sort by carNumber when requested', async () => {
            const mockQb = {
                innerJoinAndSelect: jest.fn().mockReturnThis(),
                leftJoinAndSelect: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getCount: jest.fn().mockResolvedValue(0),
                getMany: jest.fn().mockResolvedValue([]),
            };
            repo.createQueryBuilder.mockReturnValue(mockQb);

            await service.findAll({ page: 1, limit: 10, sortBy: 'carNumber', sortOrder: 'ASC' });

            expect(mockQb.orderBy).toHaveBeenCalledWith('vis.carNumber', 'ASC');
        });
    });

    describe('createRequest', () => {
        it('should create a pending request when autoApprove=false', async () => {
            repo.findOne.mockResolvedValue(null);

            const result = await service.createRequest('vv-1', false, 'user-1');

            expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
                visitVisitorId: 'vv-1',
                status: ParkingRequestStatus.Pending,
                reviewedByUserId: null,
                reviewedAt: null,
                createdBy: 'user-1',
            }));
            expect(repo.save).toHaveBeenCalled();
            expect(result.status).toBe(ParkingRequestStatus.Pending);
        });

        it('should create an approved request when autoApprove=true', async () => {
            repo.findOne.mockResolvedValue(null);

            const result = await service.createRequest('vv-1', true, 'user-1');

            expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
                visitVisitorId: 'vv-1',
                status: ParkingRequestStatus.Approved,
                reviewedByUserId: 'user-1',
            }));
            expect(result.status).toBe(ParkingRequestStatus.Approved);
        });

        it('should return existing request if one already exists', async () => {
            const existing = { id: 'existing-id', visitVisitorId: 'vv-1', status: ParkingRequestStatus.Pending };
            repo.findOne.mockResolvedValue(existing);

            const result = await service.createRequest('vv-1', false, 'user-1');

            expect(repo.save).not.toHaveBeenCalled();
            expect(result).toEqual(existing);
        });
    });

    describe('review', () => {
        const mockRequest = {
            id: 'req-1',
            status: ParkingRequestStatus.Pending,
            isActive: true,
            visitVisitor: {
                visitor: { firstName: 'John', lastName: 'Doe', personId: '123', phone: '0501234567', carNumber: '12-345-67' },
                visit: {
                    title: 'Test Visit',
                    plannedStartTimeUtc: new Date('2026-01-01T09:00:00Z'),
                    plannedEndTimeUtc: new Date('2026-01-01T17:00:00Z'),
                    siteId: 'site-1',
                    purposeOfVisit: 'Meeting',
                    createdByUser: { firstName: 'Admin', lastName: 'User' },
                },
            },
        };

        it('should approve a pending request', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            const result = await service.review('req-1', { status: ParkingRequestStatus.Approved } as any, 'reviewer-1');

            expect(result.status).toBe(ParkingRequestStatus.Approved);
            expect(result.reviewedByUserId).toBe('reviewer-1');
            expect(result.reviewedAt).toBeDefined();
        });

        it('should deny a pending request with note', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            const result = await service.review('req-1', { status: ParkingRequestStatus.Denied, reviewNote: 'No spaces' } as any, 'reviewer-1');

            expect(result.status).toBe(ParkingRequestStatus.Denied);
            expect(result.reviewNote).toBe('No spaces');
        });

        it('should throw NotFoundException for non-existent request', async () => {
            repo.findOne.mockResolvedValue(null);

            await expect(service.review('non-existent', { status: ParkingRequestStatus.Approved } as any, 'user-1'))
                .rejects.toThrow(NotFoundException);
        });

        it('should load createdByUser relation for notification', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            await service.review('req-1', { status: ParkingRequestStatus.Approved } as any, 'reviewer-1');

            expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({
                relations: expect.arrayContaining(['visitVisitor.visit.createdByUser']),
            }));
        });

        it('should trigger SMS notification on approval', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            await service.review('req-1', { status: ParkingRequestStatus.Approved } as any, 'reviewer-1');

            // Wait for fire-and-forget to complete
            await new Promise((r) => setTimeout(r, 10));

            expect(mockSmsNotification.triggerSms).toHaveBeenCalledWith(
                NotificationEvent.ParkingRequestDecision,
                expect.objectContaining({
                    visitor: expect.objectContaining({ firstName: 'John', lastName: 'Doe', carNumber: '12-345-67' }),
                    parking: expect.objectContaining({ status: ParkingRequestStatus.Approved }),
                }),
            );
        });

        it('should trigger email notification on denial', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            await service.review('req-1', { status: ParkingRequestStatus.Denied, reviewNote: 'Full' } as any, 'reviewer-1');

            await new Promise((r) => setTimeout(r, 10));

            expect(mockEmailNotification.triggerEmail).toHaveBeenCalledWith(
                NotificationEvent.ParkingRequestDecision,
                expect.objectContaining({
                    parking: expect.objectContaining({ status: ParkingRequestStatus.Denied, reviewNote: 'Full' }),
                }),
            );
        });

        it('should include visit and visitor data in notification', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            await service.review('req-1', { status: ParkingRequestStatus.Approved } as any, 'reviewer-1');

            await new Promise((r) => setTimeout(r, 10));

            expect(mockSmsNotification.triggerSms).toHaveBeenCalledWith(
                NotificationEvent.ParkingRequestDecision,
                expect.objectContaining({
                    visit: expect.objectContaining({ title: 'Test Visit', hostName: 'Admin User' }),
                    visitor: expect.objectContaining({ firstName: 'John' }),
                    parking: expect.objectContaining({ status: ParkingRequestStatus.Approved }),
                }),
            );
        });

        it('should not fail if notification trigger throws', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));
            mockSmsNotification.triggerSms.mockRejectedValue(new Error('SMS down'));
            mockEmailNotification.triggerEmail.mockRejectedValue(new Error('Email down'));

            // Should not throw
            const result = await service.review('req-1', { status: ParkingRequestStatus.Approved } as any, 'reviewer-1');
            expect(result.status).toBe(ParkingRequestStatus.Approved);
        });

        it('should change an approved request to denied', async () => {
            const approvedRequest = {
                ...mockRequest,
                status: ParkingRequestStatus.Approved,
                reviewedByUserId: 'old-reviewer',
                reviewedAt: new Date('2026-01-01T10:00:00Z'),
            };
            repo.findOne.mockResolvedValue({ ...approvedRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            const result = await service.review('req-1', { status: ParkingRequestStatus.Denied, reviewNote: 'Changed decision' } as any, 'reviewer-2');

            expect(result.status).toBe(ParkingRequestStatus.Denied);
            expect(result.reviewedByUserId).toBe('reviewer-2');
            expect(result.reviewNote).toBe('Changed decision');
            expect(result.reviewedAt).toBeDefined();
        });

        it('should change a denied request to approved', async () => {
            const deniedRequest = {
                ...mockRequest,
                status: ParkingRequestStatus.Denied,
                reviewedByUserId: 'old-reviewer',
                reviewedAt: new Date('2026-01-01T10:00:00Z'),
                reviewNote: 'No spaces',
            };
            repo.findOne.mockResolvedValue({ ...deniedRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            const result = await service.review('req-1', { status: ParkingRequestStatus.Approved } as any, 'reviewer-2');

            expect(result.status).toBe(ParkingRequestStatus.Approved);
            expect(result.reviewedByUserId).toBe('reviewer-2');
            expect(result.reviewNote).toBeNull();
        });

        it('should trigger notification when changing an existing decision', async () => {
            const approvedRequest = {
                ...mockRequest,
                status: ParkingRequestStatus.Approved,
                reviewedByUserId: 'old-reviewer',
                reviewedAt: new Date('2026-01-01T10:00:00Z'),
            };
            repo.findOne.mockResolvedValue({ ...approvedRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            await service.review('req-1', { status: ParkingRequestStatus.Denied, reviewNote: 'Reversed' } as any, 'reviewer-2');

            await new Promise((r) => setTimeout(r, 10));

            expect(mockSmsNotification.triggerSms).toHaveBeenCalledWith(
                NotificationEvent.ParkingRequestDecision,
                expect.objectContaining({
                    parking: expect.objectContaining({ status: ParkingRequestStatus.Denied, reviewNote: 'Reversed' }),
                }),
            );
        });

        it('should create audit log with PARKING_REQUEST_APPROVED on approval', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            await service.review('req-1', { status: ParkingRequestStatus.Approved } as any, 'reviewer-1');

            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'reviewer-1',
                module: 'visitors',
                action: 'PARKING_REQUEST_APPROVED',
                entity: 'ParkingRequest',
                entityId: 'req-1',
                oldValue: { status: ParkingRequestStatus.Pending },
                newValue: { status: ParkingRequestStatus.Approved, reviewNote: null },
            }));
        });

        it('should create audit log with PARKING_REQUEST_DENIED on denial', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            await service.review('req-1', { status: ParkingRequestStatus.Denied, reviewNote: 'Full' } as any, 'reviewer-1');

            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'reviewer-1',
                module: 'visitors',
                action: 'PARKING_REQUEST_DENIED',
                entity: 'ParkingRequest',
                entityId: 'req-1',
                oldValue: { status: ParkingRequestStatus.Pending },
                newValue: { status: ParkingRequestStatus.Denied, reviewNote: 'Full' },
            }));
        });

        it('should include previous status in audit log when changing decision', async () => {
            const approvedRequest = {
                ...mockRequest,
                status: ParkingRequestStatus.Approved,
                reviewedByUserId: 'old-reviewer',
                reviewedAt: new Date('2026-01-01T10:00:00Z'),
            };
            repo.findOne.mockResolvedValue({ ...approvedRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));

            await service.review('req-1', { status: ParkingRequestStatus.Denied, reviewNote: 'Changed' } as any, 'reviewer-2');

            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'PARKING_REQUEST_DENIED',
                oldValue: { status: ParkingRequestStatus.Approved },
                newValue: { status: ParkingRequestStatus.Denied, reviewNote: 'Changed' },
            }));
        });

        it('should not fail if audit log throws', async () => {
            repo.findOne.mockResolvedValue({ ...mockRequest });
            repo.save.mockImplementation((e) => Promise.resolve(e));
            mockAuditService.log.mockRejectedValue(new Error('Audit down'));

            const result = await service.review('req-1', { status: ParkingRequestStatus.Approved } as any, 'reviewer-1');
            expect(result.status).toBe(ParkingRequestStatus.Approved);
        });
    });

    describe('getPendingCount', () => {
        it('should return count of pending active requests', async () => {
            repo.count.mockResolvedValue(3);

            const result = await service.getPendingCount();

            expect(repo.count).toHaveBeenCalledWith({
                where: { status: ParkingRequestStatus.Pending, isActive: true },
            });
            expect(result).toBe(3);
        });
    });

    describe('findByVisitVisitorIds', () => {
        it('should return empty array for empty input', async () => {
            const result = await service.findByVisitVisitorIds([]);
            expect(result).toEqual([]);
        });

        it('should query by visitVisitorIds', async () => {
            const mockQb = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]),
            };
            repo.createQueryBuilder.mockReturnValue(mockQb);

            const result = await service.findByVisitVisitorIds(['vv-1', 'vv-2']);

            expect(mockQb.where).toHaveBeenCalledWith('pr.visitVisitorId IN (:...ids)', { ids: ['vv-1', 'vv-2'] });
            expect(result).toHaveLength(2);
        });
    });
});
