import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { VisitFile } from './entities/visit-file.entity';
import { Visit } from './entities/visit.entity';

const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'visit-files');

@Injectable()
export class VisitFilesService {
    constructor(
        @InjectRepository(VisitFile)
        private readonly visitFileRepo: Repository<VisitFile>,
        @InjectRepository(Visit)
        private readonly visitRepo: Repository<Visit>,
    ) { }

    async uploadFiles(
        visitId: string,
        files: Express.Multer.File[],
        currentUserId: string,
    ): Promise<VisitFile[]> {
        const visit = await this.visitRepo.findOne({ where: { id: visitId, isActive: true } });
        if (!visit) throw new NotFoundException('Visit not found');

        if (!files || files.length === 0) {
            throw new BadRequestException('At least one file is required');
        }

        for (const file of files) {
            if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
                throw new BadRequestException(
                    `File type "${file.mimetype}" is not allowed. Allowed types: PDF, images, Word, Excel`,
                );
            }
            if (file.size > MAX_FILE_SIZE) {
                throw new BadRequestException(
                    `File "${file.originalname}" exceeds the maximum size of 10MB`,
                );
            }
        }

        fs.mkdirSync(UPLOAD_DIR, { recursive: true });

        const savedFiles: VisitFile[] = [];

        for (const file of files) {
            const ext = path.extname(file.originalname);
            const storedName = `${uuidv4()}${ext}`;
            const storedPath = path.join(UPLOAD_DIR, storedName);

            fs.writeFileSync(storedPath, file.buffer);

            const visitFile = this.visitFileRepo.create({
                visitId,
                originalName: file.originalname,
                storedPath: storedName,
                mimeType: file.mimetype,
                size: file.size,
                createdBy: currentUserId,
                updatedBy: currentUserId,
            });

            savedFiles.push(await this.visitFileRepo.save(visitFile));
        }

        return savedFiles;
    }

    async getFiles(visitId: string): Promise<VisitFile[]> {
        return this.visitFileRepo.find({
            where: { visitId, isActive: true },
            order: { createdAt: 'DESC' },
        });
    }

    async getFile(visitId: string, fileId: string): Promise<VisitFile> {
        const file = await this.visitFileRepo.findOne({
            where: { id: fileId, visitId, isActive: true },
        });
        if (!file) throw new NotFoundException('File not found');
        return file;
    }

    async deleteFile(visitId: string, fileId: string, currentUserId: string): Promise<void> {
        const file = await this.visitFileRepo.findOne({
            where: { id: fileId, visitId, isActive: true },
        });
        if (!file) throw new NotFoundException('File not found');

        file.isActive = false;
        file.updatedBy = currentUserId;
        await this.visitFileRepo.save(file);

        // Remove physical file
        const fullPath = path.join(UPLOAD_DIR, file.storedPath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }

    getFilePath(file: VisitFile): string {
        return path.join(UPLOAD_DIR, file.storedPath);
    }
}
