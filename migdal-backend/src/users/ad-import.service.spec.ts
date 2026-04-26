import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdImportService } from './ad-import.service';
import { User } from './entities/user.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { SectorsService } from '../sectors/sectors.service';

describe('AdImportService', () => {
    let service: AdImportService;
    let mockUserRepo: any;
    let mockAdConfigRepo: any;
    let mockSectorsService: any;

    beforeEach(async () => {
        mockUserRepo = {
            findOne: jest.fn(),
            create: jest.fn((data) => ({ ...data })),
            save: jest.fn((entity) => Promise.resolve({ id: 'new-id', ...entity })),
        };
        mockAdConfigRepo = {
            find: jest.fn(),
        };
        mockSectorsService = {
            findOrCreateByName: jest.fn().mockResolvedValue({ id: 'sector-1', name: 'Test' }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdImportService,
                { provide: getRepositoryToken(User), useValue: mockUserRepo },
                { provide: getRepositoryToken(AdConfiguration), useValue: mockAdConfigRepo },
                { provide: SectorsService, useValue: mockSectorsService },
            ],
        }).compile();

        service = module.get<AdImportService>(AdImportService);
    });

    it('should return NO_AD_CONFIG error when no AD configurations exist', async () => {
        mockAdConfigRepo.find.mockResolvedValue([]);
        const result = await service.importFromAllAds('user-1');
        expect(result).toEqual({
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: ['NO_AD_CONFIG'],
        });
    });

    it('should query active AD configurations ordered by name', async () => {
        mockAdConfigRepo.find.mockResolvedValue([]);
        await service.importFromAllAds();
        expect(mockAdConfigRepo.find).toHaveBeenCalledWith({
            where: { isActive: true },
            order: { name: 'ASC' },
        });
    });

    it('should catch AD connection errors and add config name to errors', async () => {
        mockAdConfigRepo.find.mockResolvedValue([
            {
                id: 'c1',
                name: 'TestAD',
                domain: 'test.local',
                ldapUrl: 'ldap://nonexistent:389',
                baseDn: null,
                username: 'admin',
                password: 'pass',
                port: 389,
                useSsl: false,
                isActive: true,
            },
        ]);

        const result = await service.importFromAllAds('user-1');
        expect(result.errors).toContain('TestAD');
        expect(result.imported).toBe(0);
        expect(result.updated).toBe(0);
        expect(result.skipped).toBe(0);
    });
});
