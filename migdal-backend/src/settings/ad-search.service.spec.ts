import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdSearchService, AdSearchException } from './ad-search.service';
import { AdConfiguration } from './entities/ad-configuration.entity';

describe('AdSearchService', () => {
    let service: AdSearchService;
    let mockRepo: any;

    beforeEach(async () => {
        mockRepo = {
            findOne: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdSearchService,
                { provide: getRepositoryToken(AdConfiguration), useValue: mockRepo },
            ],
        }).compile();

        service = module.get<AdSearchService>(AdSearchService);
    });

    it('should throw AdSearchException with AD_NO_CONFIG when no active AD config exists', async () => {
        mockRepo.findOne.mockResolvedValue(null);
        await expect(service.searchPeople('john')).rejects.toThrow(AdSearchException);
        await expect(service.searchPeople('john')).rejects.toMatchObject({ code: 'AD_NO_CONFIG' });
    });

    it('should call findOne with isActive true', async () => {
        mockRepo.findOne.mockResolvedValue(null);
        await service.searchPeople('john').catch(() => {});
        expect(mockRepo.findOne).toHaveBeenCalledWith({
            where: { isActive: true },
            order: { createdAt: 'ASC' },
        });
    });
});
