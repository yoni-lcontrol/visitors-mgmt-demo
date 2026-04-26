import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VisitorPersistenceService } from './visitor-persistence.service';
import { Visitor } from './entities/visitor.entity';
import { createMockRepository } from '../test-utils/mock.factory';

describe('VisitorPersistenceService', () => {
    let service: VisitorPersistenceService;
    let mockRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        mockRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitorPersistenceService,
                { provide: getRepositoryToken(Visitor), useValue: mockRepo },
            ],
        }).compile();

        service = module.get<VisitorPersistenceService>(VisitorPersistenceService);
    });

    it('should create a visitor when personId does not exist', async () => {
        mockRepo.findOne.mockResolvedValue(null);

        const result = await service.upsertByPersonId({
            firstName: ' Jane ',
            lastName: ' Smith ',
            email: ' jane@example.com ',
            phone: ' 0501234567 ',
            personId: ' 123456789 ',
            carNumber: ' 12-345-67 ',
            vehicleType: 'private',
        }, 'user-1');

        expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane@example.com',
            phone: '0501234567',
            personId: '123456789',
            carNumber: '12-345-67',
            vehicleType: 'private',
            createdBy: 'user-1',
            updatedBy: 'user-1',
        }));
        expect(result.action).toBe('created');
    });

    it('should update and reactivate an existing visitor when personId already exists', async () => {
        mockRepo.findOne.mockResolvedValue({
            id: 'visitor-1',
            personId: '123456789',
            isActive: false,
            firstName: 'Old',
            lastName: 'Name',
        });

        const result = await service.upsertByPersonId({
            firstName: 'New',
            lastName: 'Person',
            email: '',
            phone: '0507654321',
            personId: '123456789',
            carNumber: '',
            vehicleType: '',
        }, 'user-2');

        expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            id: 'visitor-1',
            firstName: 'New',
            lastName: 'Person',
            email: null,
            phone: '0507654321',
            personId: '123456789',
            carNumber: null,
            vehicleType: null,
            isActive: true,
            updatedBy: 'user-2',
        }));
        expect(result.action).toBe('updated');
    });

    it('should trim personId when searching', async () => {
        mockRepo.findOne.mockResolvedValue(null);

        await service.findByPersonId(' 123456789 ');

        expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { personId: '123456789' } });
    });
});