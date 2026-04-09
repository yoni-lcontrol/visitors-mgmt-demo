import { Test, TestingModule } from '@nestjs/testing';
import { CardTemplateController } from './card-template.controller';
import { CardTemplateService } from './card-template.service';

describe('CardTemplateController', () => {
    let controller: CardTemplateController;
    let cardTemplateService: Record<string, jest.Mock>;

    beforeEach(async () => {
        cardTemplateService = {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            testPrint: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [CardTemplateController],
            providers: [
                { provide: CardTemplateService, useValue: cardTemplateService },
            ],
        }).compile();

        controller = module.get<CardTemplateController>(CardTemplateController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('testPrint', () => {
        it('should delegate to service testPrint', async () => {
            cardTemplateService.testPrint.mockResolvedValue({
                correlationId: 'corr-1',
                status: 'queued',
            });

            const result = await controller.testPrint('tpl-1', 'user-1');

            expect(cardTemplateService.testPrint).toHaveBeenCalledWith('tpl-1', 'user-1');
            expect(result).toEqual({ correlationId: 'corr-1', status: 'queued' });
        });

        it('should throw when template not found', async () => {
            cardTemplateService.testPrint.mockRejectedValue(new Error('Not found'));

            await expect(controller.testPrint('bad-id', 'user-1')).rejects.toThrow('Not found');
        });
    });

    describe('findAll', () => {
        it('should delegate to service findAll', async () => {
            const templates = [{ id: 'tpl-1', name: 'Test' }];
            cardTemplateService.findAll.mockResolvedValue(templates);

            const result = await controller.findAll();

            expect(result).toEqual(templates);
            expect(cardTemplateService.findAll).toHaveBeenCalled();
        });
    });
});
