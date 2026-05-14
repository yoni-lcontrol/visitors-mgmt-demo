import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BlacklistOverrideService } from './blacklist-override.service';
import { BlacklistOverrideRequest } from './entities/blacklist-override-request.entity';
import { BlacklistOverrideStatus } from './enums/blacklist-override-status.enum';
import { AuditService } from '../audit/audit.service';

describe('BlacklistOverrideService', () => {
    let service: BlacklistOverrideService;
    let repo: Record<string, jest.Mock>;
    let mockAuditService: { log: jest.Mock };

    beforeEach(async () => {
        repo = {
            findOne: jest.fn(),
            create: jest.fn((dto) => dto),
            save: jest.fn((entity) => Promise.resolve({ id: 'new-id', ...entity })),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
        };

        mockAuditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BlacklistOverrideService,
                { provide: getRepositoryToken(BlacklistOverrideRequest), useValue: repo },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<BlacklistOverrideService>(BlacklistOverrideService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('should return paginated results', async () => {
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
                    id: 'bor-1',
                    visitVisitor: {
                        visit: { title: 'V1', createdByUser: { firstName: 'John', lastName: 'Doe' } },
                        visitor: { firstName: 'Jane', lastName: 'Smith', personId: '123' },
                    },
                    blacklistReason: 'Banned person',
                }]),
            };
            repo.createQueryBuilder.mockReturnValue(mockQb);

            const result = await service.findAll({ page: 1, limit: 10 });

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
            expect(result.items[0].blacklistReason).toBe('Banned person');
        });

        it('should filter by status', async () => {
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

            await service.findAll({ page: 1, limit: 10, status: BlacklistOverrideStatus.Pending });

            expect(mockQb.andWhere).toHaveBeenCalledWith('bor.status = :status', { status: 'pending' });
        });
    });

    describe('review', () => {
        it('should approve a blacklist override request', async () => {
            repo.findOne.mockResolvedValue({
                id: 'bor-1',
                status: BlacklistOverrideStatus.Pending,
                visitVisitor: {
                    visitor: { firstName: 'Jane', lastName: 'Smith' },
                    visit: { title: 'Test Visit' },
                },
            });
            repo.save.mockImplementation((e: any) => Promise.resolve(e));

            const result = await service.review('bor-1', {
                status: BlacklistOverrideStatus.Approved,
                reviewNote: 'Approved by security',
            }, 'reviewer-1');

            expect(result.status).toBe(BlacklistOverrideStatus.Approved);
            expect(result.reviewedByUserId).toBe('reviewer-1');
            expect(result.reviewNote).toBe('Approved by security');
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'BLACKLIST_OVERRIDE_APPROVED' }),
            );
        });

        it('should deny a blacklist override request', async () => {
            repo.findOne.mockResolvedValue({
                id: 'bor-1',
                status: BlacklistOverrideStatus.Pending,
                visitVisitor: {
                    visitor: { firstName: 'Jane', lastName: 'Smith' },
                    visit: { title: 'Test Visit' },
                },
            });
            repo.save.mockImplementation((e: any) => Promise.resolve(e));

            const result = await service.review('bor-1', {
                status: BlacklistOverrideStatus.Denied,
            }, 'reviewer-1');

            expect(result.status).toBe(BlacklistOverrideStatus.Denied);
            expect(mockAuditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'BLACKLIST_OVERRIDE_DENIED' }),
            );
        });

        it('should throw NotFoundException when request not found', async () => {
            repo.findOne.mockResolvedValue(null);

            await expect(service.review('bad-id', {
                status: BlacklistOverrideStatus.Approved,
            }, 'reviewer-1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('getPendingCount', () => {
        it('should return count of pending requests', async () => {
            repo.count.mockResolvedValue(5);

            const result = await service.getPendingCount();

            expect(result).toBe(5);
            expect(repo.count).toHaveBeenCalledWith({
                where: { status: BlacklistOverrideStatus.Pending, isActive: true },
            });
        });
    });

    describe('findByVisitVisitorIds', () => {
        it('should return empty array for empty input', async () => {
            const result = await service.findByVisitVisitorIds([]);
            expect(result).toEqual([]);
        });

        it('should query by visit visitor IDs', async () => {
            const mockQb = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([{ id: 'bor-1', visitVisitorId: 'vv-1' }]),
            };
            repo.createQueryBuilder.mockReturnValue(mockQb);

            const result = await service.findByVisitVisitorIds(['vv-1']);

            expect(result).toHaveLength(1);
        });
    });
});
