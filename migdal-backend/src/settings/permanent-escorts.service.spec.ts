import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { createMockRepository } from '../test-utils/mock.factory';
import { AuditService } from '../audit/audit.service';
import { PermanentEscortsService } from './permanent-escorts.service';
import { PermanentEscort } from './entities/permanent-escort.entity';
import { User } from '../users/entities/user.entity';
import { Sector } from '../sectors/entities/sector.entity';

describe('PermanentEscortsService', () => {
    let service: PermanentEscortsService;
    let mockPermanentEscortRepo: ReturnType<typeof createMockRepository>;
    let mockUserRepo: ReturnType<typeof createMockRepository>;
    let mockSectorRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        mockPermanentEscortRepo = createMockRepository();
        mockUserRepo = createMockRepository();
        mockSectorRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PermanentEscortsService,
                { provide: getRepositoryToken(PermanentEscort), useValue: mockPermanentEscortRepo },
                { provide: getRepositoryToken(User), useValue: mockUserRepo },
                { provide: getRepositoryToken(Sector), useValue: mockSectorRepo },
                { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
            ],
        }).compile();

        service = module.get<PermanentEscortsService>(PermanentEscortsService);
    });

    it('should return permanent escorts with user details', async () => {
        mockPermanentEscortRepo.find.mockResolvedValue([
            {
                id: 'pe-1',
                userId: 'u-1',
                user: {
                    firstName: 'Jane',
                    lastName: 'Doe',
                    username: 'jane',
                    email: 'jane@company.com',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    sector: { id: 's-1', name: 'Operations' },
                },
            },
        ]);

        const result = await service.getAll();

        expect(result).toHaveLength(1);
        expect(result[0].fullName).toBe('Jane Doe');
        expect(result[0].domain?.name).toBe('Operations');
    });

    it('should reject add when user is not in selected domain', async () => {
        mockSectorRepo.findOne.mockResolvedValue({ id: 's-1', name: 'Operations', isActive: true });
        mockUserRepo.findOne.mockResolvedValue({
            id: 'u-1',
            isActive: true,
            sectorId: 's-2',
            username: 'jane',
        });

        await expect(service.add({ domainId: 's-1', userId: 'u-1' } as any))
            .rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate permanent escort', async () => {
        mockSectorRepo.findOne.mockResolvedValue({ id: 's-1', name: 'Operations', isActive: true });
        mockUserRepo.findOne.mockResolvedValue({ id: 'u-1', isActive: true, sectorId: 's-1', username: 'jane' });
        mockPermanentEscortRepo.findOne.mockResolvedValue({ id: 'pe-1', userId: 'u-1' });

        await expect(service.add({ domainId: 's-1', userId: 'u-1' } as any))
            .rejects.toThrow(ConflictException);
    });

    it('should remove existing permanent escort', async () => {
        mockPermanentEscortRepo.findOne.mockResolvedValue({ id: 'pe-1', userId: 'u-1', user: { username: 'jane' } });
        mockPermanentEscortRepo.remove.mockResolvedValue(undefined);

        await service.remove('u-1', 'admin-1');

        expect(mockPermanentEscortRepo.remove).toHaveBeenCalled();
    });

    it('should throw NotFoundException when removing missing escort', async () => {
        mockPermanentEscortRepo.findOne.mockResolvedValue(null);

        await expect(service.remove('u-missing')).rejects.toThrow(NotFoundException);
    });
});
