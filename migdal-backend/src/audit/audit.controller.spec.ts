import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
    let controller: AuditController;
    let mockService: {
        findAll: jest.Mock;
        findOne: jest.Mock;
        exportToExcel: jest.Mock;
    };

    beforeEach(async () => {
        mockService = {
            findAll: jest.fn(),
            findOne: jest.fn(),
            exportToExcel: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuditController],
            providers: [
                { provide: AuditService, useValue: mockService },
            ],
        }).compile();

        controller = module.get<AuditController>(AuditController);
    });

    describe('findAll', () => {
        it('should return paginated audit logs', async () => {
            const result = {
                items: [{ id: '1', action: 'CREATE', entity: 'User' }],
                total: 1,
                page: 1,
                limit: 25,
                totalPages: 1,
            };
            mockService.findAll.mockResolvedValue(result);

            const response = await controller.findAll({ page: 1, limit: 25 });

            expect(response).toEqual(result);
            expect(mockService.findAll).toHaveBeenCalledWith({ page: 1, limit: 25 });
        });

        it('should pass filter parameters to the service', async () => {
            const query = {
                page: 1,
                limit: 10,
                module: 'auth',
                action: 'LOGIN',
                entity: 'User',
                userId: 'user-1',
                dateFrom: '2024-01-01T00:00:00Z',
                dateTo: '2024-12-31T23:59:59Z',
            };
            mockService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10, totalPages: 0 });

            await controller.findAll(query);

            expect(mockService.findAll).toHaveBeenCalledWith(query);
        });

        it('should pass sort parameters to the service', async () => {
            const query = {
                page: 1,
                limit: 25,
                sortBy: 'createdAt',
                sortOrder: 'DESC' as const,
            };
            mockService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 25, totalPages: 0 });

            await controller.findAll(query);

            expect(mockService.findAll).toHaveBeenCalledWith(query);
        });
    });

    describe('findOne', () => {
        it('should return a single audit log entry', async () => {
            const log = { id: 'log-1', action: 'CREATE', entity: 'User', createdAt: new Date() };
            mockService.findOne.mockResolvedValue(log);

            const result = await controller.findOne('log-1');

            expect(result).toEqual(log);
            expect(mockService.findOne).toHaveBeenCalledWith('log-1');
        });

        it('should propagate NotFoundException', async () => {
            mockService.findOne.mockRejectedValue(new NotFoundException());

            await expect(controller.findOne('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('export', () => {
        it('should set correct headers and send the Excel buffer', async () => {
            const buffer = Buffer.from('mock-excel');
            mockService.exportToExcel.mockResolvedValue(buffer);

            const res = {
                setHeader: jest.fn(),
                send: jest.fn(),
            } as any;

            await controller.export({ page: 1, limit: 25, module: 'auth' }, res);

            expect(mockService.exportToExcel).toHaveBeenCalledWith({ page: 1, limit: 25, module: 'auth' });
            expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="audit-logs.xlsx"');
            expect(res.send).toHaveBeenCalledWith(buffer);
        });

        it('should pass filter parameters to exportToExcel', async () => {
            mockService.exportToExcel.mockResolvedValue(Buffer.from(''));
            const res = { setHeader: jest.fn(), send: jest.fn() } as any;

            const query = {
                page: 1,
                limit: 25,
                module: 'visitors',
                action: 'CREATE',
                dateFrom: '2024-01-01T00:00:00Z',
                dateTo: '2024-12-31T23:59:59Z',
            };

            await controller.export(query, res);

            expect(mockService.exportToExcel).toHaveBeenCalledWith(query);
        });
    });
});
