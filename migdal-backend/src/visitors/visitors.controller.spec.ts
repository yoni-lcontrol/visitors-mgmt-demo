import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';

describe('VisitorsController', () => {
    let controller: VisitorsController;
    let service: any;

    beforeEach(async () => {
        service = {
            findAll: jest.fn(),
            searchByPersonId: jest.fn(),
            exportToExcel: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [VisitorsController],
            providers: [
                { provide: VisitorsService, useValue: service },
            ],
        }).compile();

        controller = module.get<VisitorsController>(VisitorsController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should delegate to service with query and ownership context', async () => {
            const query = { page: 2, limit: 25, search: 'john' } as any;
            const expected = { items: [{ id: 'v1' }], total: 1, page: 2, limit: 25 };
            service.findAll.mockResolvedValue(expected);

            const result = await controller.findAll(query, 'user-1', ['visitors.read']);

            expect(service.findAll).toHaveBeenCalledWith(query, 'user-1', ['visitors.read']);
            expect(result).toEqual(expected);
        });
    });
});
