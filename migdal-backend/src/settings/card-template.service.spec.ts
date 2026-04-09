import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { CardTemplateService } from './card-template.service';
import { CardTemplate } from './entities/card-template.entity';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { PrintingService } from '../printing/services/printing.service';
import { AuditService } from '../audit/audit.service';
import { createMockRepository } from '../test-utils/mock.factory';

describe('CardTemplateService', () => {
    let service: CardTemplateService;
    let repo: ReturnType<typeof createMockRepository>;
    let wsGateway: { broadcastToAll: jest.Mock; broadcastToRoom: jest.Mock; emitToAgentNamespace: jest.Mock };
    let printingService: { requestTestPrintTemplate: jest.Mock<any> };
    let auditService: { log: jest.Mock };

    const mockTemplate: CardTemplate = {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Test Template',
        description: 'A test template',
        cardWidthMm: 54,
        cardHeightMm: 86,
        orientation: 'landscape',
        elementsJson: '[]',
        backgroundColor: '#ffffff',
        backgroundImageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
        updatedBy: null,
        isActive: true,
    };

    beforeEach(async () => {
        repo = createMockRepository();
        wsGateway = { broadcastToAll: jest.fn(), broadcastToRoom: jest.fn(), emitToAgentNamespace: jest.fn() };
        printingService = {
            requestTestPrintTemplate: jest.fn().mockResolvedValue({
                correlationId: 'corr-1',
                agentSocketId: 'agent-socket-1',
                printData: { fullName: 'Israel Israeli', personId: '123456789' },
            }),
        };
        auditService = { log: jest.fn().mockResolvedValue(undefined) };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CardTemplateService,
                { provide: getRepositoryToken(CardTemplate), useValue: repo },
                { provide: UsersGateway, useValue: wsGateway },
                { provide: PrintingService, useValue: printingService },
                { provide: AuditService, useValue: auditService },
            ],
        }).compile();

        service = module.get<CardTemplateService>(CardTemplateService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('findAll', () => {
        it('should return all active templates ordered by updatedAt DESC', async () => {
            repo.find!.mockResolvedValue([mockTemplate]);
            const result = await service.findAll();
            expect(result).toEqual([mockTemplate]);
            expect(repo.find).toHaveBeenCalledWith({
                where: { isActive: true },
                order: { updatedAt: 'DESC' },
            });
        });

        it('should return empty array when no templates exist', async () => {
            repo.find!.mockResolvedValue([]);
            const result = await service.findAll();
            expect(result).toEqual([]);
        });
    });

    describe('findById', () => {
        it('should return template when found', async () => {
            repo.findOne!.mockResolvedValue(mockTemplate);
            const result = await service.findById(mockTemplate.id);
            expect(result).toEqual(mockTemplate);
        });

        it('should throw NotFoundException when not found', async () => {
            repo.findOne!.mockResolvedValue(null);
            await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('create', () => {
        const createDto = {
            name: 'New Template',
            elementsJson: '[{"type":"visitor-field","visitorField":"firstName","x":10,"y":10,"width":100,"height":30}]',
        };
        const userId = '22222222-2222-2222-2222-222222222222';

        it('should create a template successfully', async () => {
            repo.findOne!.mockResolvedValue(null); // no duplicate
            const created = { ...mockTemplate, ...createDto, id: 'new-id' };
            repo.create!.mockReturnValue(created as any);
            repo.save!.mockResolvedValue(created);

            const result = await service.create(createDto, userId);

            expect(result.name).toBe('New Template');
            expect(repo.create).toHaveBeenCalled();
            expect(repo.save).toHaveBeenCalled();
            expect(wsGateway.broadcastToAll).toHaveBeenCalledWith(
                'settings:card-template:created',
                expect.objectContaining({ name: 'New Template' }),
            );
            expect(auditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'CREATE', entity: 'CardTemplate' }),
            );
        });

        it('should throw ConflictException on duplicate name', async () => {
            repo.findOne!.mockResolvedValue(mockTemplate); // name exists
            await expect(service.create(createDto, userId)).rejects.toThrow(ConflictException);
        });

        it('should throw BadRequestException for invalid JSON', async () => {
            repo.findOne!.mockResolvedValue(null);
            await expect(
                service.create({ ...createDto, elementsJson: 'not-json' }, userId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException when elementsJson is not an array', async () => {
            repo.findOne!.mockResolvedValue(null);
            await expect(
                service.create({ ...createDto, elementsJson: '{"key":"value"}' }, userId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should accept QR elements with valid qrSourceType', async () => {
            repo.findOne!.mockResolvedValue(null);
            const qrDto = {
                name: 'QR Template',
                elementsJson: '[{"type":"qr","qrSourceType":"dynamic","qrDynamicField":"personId","x":10,"y":10,"width":80,"height":80}]',
            };
            const created = { ...mockTemplate, ...qrDto, id: 'qr-id' };
            repo.create!.mockReturnValue(created as any);
            repo.save!.mockResolvedValue(created);

            const result = await service.create(qrDto, userId);
            expect(result.name).toBe('QR Template');
        });

        it('should throw BadRequestException for invalid element type', async () => {
            repo.findOne!.mockResolvedValue(null);
            await expect(
                service.create({ ...createDto, elementsJson: '[{"type":"invalid"}]' }, userId),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for invalid QR source type', async () => {
            repo.findOne!.mockResolvedValue(null);
            await expect(
                service.create({
                    ...createDto,
                    elementsJson: '[{"type":"qr","qrSourceType":"invalid"}]',
                }, userId),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('update', () => {
        const updateDto = { name: 'Updated Name', elementsJson: '[]' };
        const userId = '22222222-2222-2222-2222-222222222222';

        it('should update a template successfully', async () => {
            repo.findOne
                .mockResolvedValueOnce({ ...mockTemplate }) // findById - copy to avoid mutation
                .mockResolvedValueOnce(null); // no duplicate name
            const updated = { ...mockTemplate, ...updateDto };
            repo.save.mockResolvedValue(updated);

            const result = await service.update(mockTemplate.id, updateDto, userId);

            expect(result.name).toBe('Updated Name');
            expect(wsGateway.broadcastToAll).toHaveBeenCalledWith(
                'settings:card-template:updated',
                expect.objectContaining({ name: 'Updated Name' }),
            );
            expect(auditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'UPDATE' }),
            );
        });

        it('should throw NotFoundException when template not found', async () => {
            repo.findOne.mockResolvedValueOnce(null);
            await expect(service.update('nonexistent', updateDto, userId)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ConflictException on duplicate name with different id', async () => {
            const otherTemplate = { ...mockTemplate, id: 'other-id', name: 'Updated Name' };
            repo.findOne
                .mockResolvedValueOnce({ ...mockTemplate }) // findById - copy
                .mockResolvedValueOnce(otherTemplate); // name conflict
            await expect(service.update(mockTemplate.id, updateDto, userId)).rejects.toThrow(
                ConflictException,
            );
        });

        it('should allow updating with same name as current', async () => {
            repo.findOne
                .mockResolvedValueOnce({ ...mockTemplate }) // findById - copy
                .mockResolvedValueOnce({ ...mockTemplate }); // same template found by name
            repo.save.mockResolvedValue({ ...mockTemplate, name: mockTemplate.name });

            await expect(
                service.update(mockTemplate.id, { name: mockTemplate.name }, userId),
            ).resolves.toBeDefined();
        });

        it('should throw BadRequestException for invalid elementsJson', async () => {
            repo.findOne.mockResolvedValueOnce({ ...mockTemplate });
            await expect(
                service.update(mockTemplate.id, { elementsJson: 'invalid' }, userId),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('remove', () => {
        const userId = '22222222-2222-2222-2222-222222222222';

        it('should soft-delete a template', async () => {
            repo.findOne.mockResolvedValue({ ...mockTemplate });
            repo.save.mockResolvedValue({ ...mockTemplate, isActive: false });

            await service.remove(mockTemplate.id, userId);

            expect(repo.save).toHaveBeenCalledWith(
                expect.objectContaining({ isActive: false }),
            );
            expect(wsGateway.broadcastToAll).toHaveBeenCalledWith(
                'settings:card-template:deleted',
                { id: mockTemplate.id },
            );
            expect(auditService.log).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'DELETE' }),
            );
        });

        it('should throw NotFoundException when template not found', async () => {
            repo.findOne.mockResolvedValueOnce(null);
            await expect(service.remove('nonexistent', userId)).rejects.toThrow(NotFoundException);
        });
    });

    describe('testPrint', () => {
        const userId = '22222222-2222-2222-2222-222222222222';

        it('should route print job and notify via WS', async () => {
            repo.findOne.mockResolvedValue(mockTemplate);

            const result = await service.testPrint(mockTemplate.id, userId);

            expect(result).toEqual({ correlationId: 'corr-1', status: 'queued' });
            expect(printingService.requestTestPrintTemplate).toHaveBeenCalledWith(
                userId,
                { cardTemplateId: mockTemplate.id },
            );
            expect(wsGateway.broadcastToRoom).toHaveBeenCalledWith(
                `user:${userId}`,
                expect.anything(),
                expect.objectContaining({ correlationId: 'corr-1', testPrint: true }),
            );
            expect(wsGateway.emitToAgentNamespace).toHaveBeenCalledWith(
                'agent-socket-1',
                expect.anything(),
                expect.objectContaining({
                    correlationId: 'corr-1',
                    testPrint: true,
                    printData: { fullName: 'Israel Israeli', personId: '123456789' },
                }),
            );
        });

        it('should throw NotFoundException when template not found', async () => {
            repo.findOne.mockResolvedValue(null);

            await expect(service.testPrint('nonexistent', userId)).rejects.toThrow(NotFoundException);
        });
    });
});
