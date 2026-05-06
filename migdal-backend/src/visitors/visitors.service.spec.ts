import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VisitorsService } from './visitors.service';
import { Visitor } from './entities/visitor.entity';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { AuditService } from '../audit/audit.service';
import { createMockAuditService } from '../test-utils/mock.factory';
import { VisitorPersistenceService } from './visitor-persistence.service';

describe('VisitorsService', () => {
    let service: VisitorsService;
    let mockRepo: any;
    let mockAuditService: ReturnType<typeof createMockAuditService>;
    let mockVisitorPersistence: { upsertByPersonId: jest.Mock; normalizePersonId: jest.Mock; findByPersonId: jest.Mock };

    beforeEach(async () => {
        mockRepo = {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        mockAuditService = createMockAuditService();
        mockVisitorPersistence = {
            upsertByPersonId: jest.fn(),
            normalizePersonId: jest.fn((personId: string) => personId.trim()),
            findByPersonId: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitorsService,
                { provide: getRepositoryToken(Visitor), useValue: mockRepo },
                { provide: VisitorPersistenceService, useValue: mockVisitorPersistence },
                { provide: UsersGateway, useValue: { broadcastToAll: jest.fn() } },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<VisitorsService>(VisitorsService);
    });

    function buildFindByIdQb(visitor: any) {
        return {
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(visitor),
        };
    }

    describe('searchByPersonId', () => {
        it('should return empty array for empty prefix', async () => {
            const result = await service.searchByPersonId('');
            expect(result).toEqual([]);
            expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should return empty array for prefix shorter than 3 chars', async () => {
            const result = await service.searchByPersonId('ab');
            expect(result).toEqual([]);
            expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should return empty array for whitespace-only prefix', async () => {
            const result = await service.searchByPersonId('   ');
            expect(result).toEqual([]);
            expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should query visitors with LIKE prefix for 3+ char input', async () => {
            const mockVisitors = [
                { id: '1', firstName: 'John', lastName: 'Doe', personId: '1234', phone: '050', email: 'j@d.com', carNumber: null },
            ];

            const qb = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockVisitors),
            };
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            const result = await service.searchByPersonId('1234');

            expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('v');
            expect(qb.select).toHaveBeenCalledWith(['v.id', 'v.firstName', 'v.lastName', 'v.personId', 'v.phone', 'v.email', 'v.carNumber', 'v.vehicleType']);
            expect(qb.where).toHaveBeenCalledWith('v.isActive = :active', { active: true });
            expect(qb.andWhere).toHaveBeenCalledWith('v.personId LIKE :prefix', { prefix: '1234%' });
            expect(qb.take).toHaveBeenCalledWith(10);
            expect(result).toEqual(mockVisitors);
        });

        it('should trim whitespace from prefix before querying', async () => {
            const qb = {
                select: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
            };
            mockRepo.createQueryBuilder.mockReturnValue(qb);

            await service.searchByPersonId('  5678  ');

            expect(qb.andWhere).toHaveBeenCalledWith('v.personId LIKE :prefix', { prefix: '5678%' });
        });
    });

    describe('create', () => {
        it('should audit log on create', async () => {
            mockVisitorPersistence.upsertByPersonId.mockResolvedValue({
                action: 'created',
                visitor: { id: 'v-1' },
            });
            mockRepo.createQueryBuilder.mockReturnValueOnce(buildFindByIdQb({ id: 'v-1', firstName: 'John', lastName: 'Doe', isActive: true }));
            await service.create({ firstName: 'John', lastName: 'Doe', personId: '123456789' } as any, 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'visitors', action: 'CREATE', entity: 'Visitor', userId: 'user-1',
            }));
        });
    });

    describe('update', () => {
        it('should audit log on update with old values', async () => {
            mockVisitorPersistence.findByPersonId.mockResolvedValue(null);
            mockRepo.createQueryBuilder
                .mockReturnValueOnce(buildFindByIdQb({ id: 'v-1', firstName: 'John', lastName: 'Doe', personId: '123', isActive: true }))
                .mockReturnValueOnce(buildFindByIdQb({ id: 'v-1', firstName: 'Jane', lastName: 'Doe', personId: '123', isActive: true }));
            mockRepo.save.mockResolvedValue({});
            await service.update('v-1', { firstName: 'Jane' } as any, 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'visitors', action: 'UPDATE', entity: 'Visitor',
                oldValue: expect.objectContaining({ firstName: 'John' }),
            }));
        });
    });

    describe('remove', () => {
        it('should audit log on delete', async () => {
            mockRepo.createQueryBuilder.mockReturnValueOnce(buildFindByIdQb({ id: 'v-1', firstName: 'John', lastName: 'Doe', isActive: true }));
            mockRepo.save.mockResolvedValue({});
            await service.remove('v-1', 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'visitors', action: 'DELETE', entity: 'Visitor', entityId: 'v-1',
            }));
        });
    });
});
