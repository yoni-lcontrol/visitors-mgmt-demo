import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VisitorsService } from './visitors.service';
import { Visitor } from './entities/visitor.entity';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { BlacklistService } from './blacklist.service';
import { AuditService } from '../audit/audit.service';
import { createMockAuditService } from '../test-utils/mock.factory';

describe('VisitorsService', () => {
    let service: VisitorsService;
    let mockRepo: any;
    let mockAuditService: ReturnType<typeof createMockAuditService>;

    beforeEach(async () => {
        mockRepo = {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
        };

        mockAuditService = createMockAuditService();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitorsService,
                { provide: getRepositoryToken(Visitor), useValue: mockRepo },
                { provide: UsersGateway, useValue: { broadcastToAll: jest.fn() } },
                { provide: BlacklistService, useValue: { findActiveByName: jest.fn().mockResolvedValue([]) } },
                { provide: AuditService, useValue: mockAuditService },
            ],
        }).compile();

        service = module.get<VisitorsService>(VisitorsService);
    });

    describe('searchByPersonId', () => {
        it('should return empty array for empty prefix', async () => {
            const result = await service.searchByPersonId('');
            expect(result).toEqual([]);
            expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should return empty array for prefix shorter than 4 chars', async () => {
            const result = await service.searchByPersonId('abc');
            expect(result).toEqual([]);
            expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should return empty array for whitespace-only prefix', async () => {
            const result = await service.searchByPersonId('   ');
            expect(result).toEqual([]);
            expect(mockRepo.createQueryBuilder).not.toHaveBeenCalled();
        });

        it('should query visitors with LIKE prefix for 4+ char input', async () => {
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
            mockRepo.findOne.mockResolvedValue({ id: 'v-1', firstName: 'John', lastName: 'Doe', isActive: true });
            mockRepo.save.mockImplementation((e: any) => Promise.resolve({ id: 'v-1', ...e }));
            await service.create({ firstName: 'John', lastName: 'Doe', personId: '123456789' } as any, 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'visitors', action: 'CREATE', entity: 'Visitor', userId: 'user-1',
            }));
        });
    });

    describe('update', () => {
        it('should audit log on update with old values', async () => {
            mockRepo.findOne.mockResolvedValue({ id: 'v-1', firstName: 'John', lastName: 'Doe', personId: '123', isActive: true });
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
            mockRepo.findOne.mockResolvedValue({ id: 'v-1', firstName: 'John', lastName: 'Doe', isActive: true });
            mockRepo.save.mockResolvedValue({});
            await service.remove('v-1', 'user-1');
            expect(mockAuditService.log).toHaveBeenCalledWith(expect.objectContaining({
                module: 'visitors', action: 'DELETE', entity: 'Visitor', entityId: 'v-1',
            }));
        });
    });
});
