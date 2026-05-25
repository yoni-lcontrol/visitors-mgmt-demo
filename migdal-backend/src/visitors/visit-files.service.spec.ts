import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { VisitFilesService } from './visit-files.service';
import { VisitFile } from './entities/visit-file.entity';
import { Visit } from './entities/visit.entity';
import { createMockRepository } from '../test-utils/mock.factory';
import * as fs from 'fs';

jest.mock('fs');

describe('VisitFilesService', () => {
    let service: VisitFilesService;
    let mockVisitFileRepo: ReturnType<typeof createMockRepository>;
    let mockVisitRepo: ReturnType<typeof createMockRepository>;

    beforeEach(async () => {
        mockVisitFileRepo = createMockRepository();
        mockVisitRepo = createMockRepository();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitFilesService,
                { provide: getRepositoryToken(VisitFile), useValue: mockVisitFileRepo },
                { provide: getRepositoryToken(Visit), useValue: mockVisitRepo },
            ],
        }).compile();

        service = module.get<VisitFilesService>(VisitFilesService);
    });

    describe('uploadFiles', () => {
        const visitId = 'visit-1';
        const userId = 'user-1';

        it('should throw NotFoundException when visit not found', async () => {
            mockVisitRepo.findOne.mockResolvedValue(null);

            await expect(
                service.uploadFiles(visitId, [createMockFile()], userId),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw BadRequestException when no files provided', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: visitId });

            await expect(
                service.uploadFiles(visitId, [], userId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for invalid MIME type', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: visitId });
            const file = createMockFile({ mimetype: 'application/exe' });

            await expect(
                service.uploadFiles(visitId, [file], userId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when file exceeds max size', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: visitId });
            const file = createMockFile({ size: 11 * 1024 * 1024 });

            await expect(
                service.uploadFiles(visitId, [file], userId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should save files and return entities', async () => {
            mockVisitRepo.findOne.mockResolvedValue({ id: visitId });
            (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
            (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

            const file = createMockFile();
            const result = await service.uploadFiles(visitId, [file], userId);

            expect(result).toHaveLength(1);
            expect(mockVisitFileRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    visitId,
                    originalName: 'test.pdf',
                    mimeType: 'application/pdf',
                    size: 1024,
                    createdBy: userId,
                }),
            );
            expect(mockVisitFileRepo.save).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    describe('getFiles', () => {
        it('should return files for a visit', async () => {
            const files = [{ id: 'f1', visitId: 'v1', originalName: 'test.pdf' }];
            mockVisitFileRepo.find.mockResolvedValue(files);

            const result = await service.getFiles('v1');
            expect(result).toEqual(files);
            expect(mockVisitFileRepo.find).toHaveBeenCalledWith({
                where: { visitId: 'v1', isActive: true },
                order: { createdAt: 'DESC' },
            });
        });
    });

    describe('getFile', () => {
        it('should throw NotFoundException when file not found', async () => {
            mockVisitFileRepo.findOne.mockResolvedValue(null);

            await expect(
                service.getFile('visit-1', 'file-1'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should return the file', async () => {
            const file = { id: 'f1', visitId: 'v1' };
            mockVisitFileRepo.findOne.mockResolvedValue(file);

            const result = await service.getFile('v1', 'f1');
            expect(result).toEqual(file);
        });
    });

    describe('deleteFile', () => {
        it('should throw NotFoundException when file not found', async () => {
            mockVisitFileRepo.findOne.mockResolvedValue(null);

            await expect(
                service.deleteFile('v1', 'f1', 'u1'),
            ).rejects.toThrow(NotFoundException);
        });

        it('should soft-delete and remove physical file', async () => {
            const file = { id: 'f1', visitId: 'v1', storedPath: 'abc.pdf', isActive: true };
            mockVisitFileRepo.findOne.mockResolvedValue(file);
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.unlinkSync as jest.Mock).mockReturnValue(undefined);

            await service.deleteFile('v1', 'f1', 'u1');

            expect(file.isActive).toBe(false);
            expect(mockVisitFileRepo.save).toHaveBeenCalledWith(file);
            expect(fs.unlinkSync).toHaveBeenCalled();
        });
    });
});

function createMockFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
    return {
        fieldname: 'files',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
        ...overrides,
    };
}
