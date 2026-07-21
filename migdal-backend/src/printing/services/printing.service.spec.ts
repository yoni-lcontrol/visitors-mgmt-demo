import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { PrintingService } from './printing.service';
import { DeviceCommandRoutingService } from '../../device-commands/services/device-command-routing.service';
import { WorkstationSessionService } from '../../workstations/services/workstation-session.service';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { CardTemplate } from '../../settings/entities/card-template.entity';
import { Visitor } from '../../visitors/entities/visitor.entity';
import { Visit } from '../../visitors/entities/visit.entity';
import { UsersGateway } from '../../websocket/gateways/users.gateway';

describe('PrintingService', () => {
    let service: PrintingService;
    let commandRouting: { routeCommand: jest.Mock };
    let workstationSession: { getActiveSession: jest.Mock };
    let cardTemplateRepo: { findOne: jest.Mock };
    let visitorRepo: { findOne: jest.Mock };
    let visitRepo: { findOne: jest.Mock };
    let mockUsersGateway: { broadcastToRoom: jest.Mock; emitToAgentNamespace: jest.Mock };

    beforeEach(async () => {
        commandRouting = { routeCommand: jest.fn() };
        workstationSession = { getActiveSession: jest.fn().mockResolvedValue(null) };
        cardTemplateRepo = { findOne: jest.fn().mockResolvedValue(null) };
        visitorRepo = { findOne: jest.fn().mockResolvedValue(null) };
        visitRepo = { findOne: jest.fn().mockResolvedValue(null) };
        mockUsersGateway = { broadcastToRoom: jest.fn(), emitToAgentNamespace: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PrintingService,
                { provide: DeviceCommandRoutingService, useValue: commandRouting },
                { provide: WorkstationSessionService, useValue: workstationSession },
                { provide: getRepositoryToken(CardTemplate), useValue: cardTemplateRepo },
                { provide: getRepositoryToken(Visitor), useValue: visitorRepo },
                { provide: getRepositoryToken(Visit), useValue: visitRepo },
                { provide: UsersGateway, useValue: mockUsersGateway },
            ],
        }).compile();

        service = module.get<PrintingService>(PrintingService);
    });

    describe('requestPrintCard', () => {
        it('should route print command with correct provider', async () => {
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            const result = await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
                cardTemplateId: 'template-1',
            });

            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-1',
                    providerType: IntegrationProvider.Printer,
                    commandType: 'print-card',
                }),
                undefined,
            );
            expect(result.correlationId).toBe('corr-1');
        });

        it('should pass userSocketId when provided', async () => {
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
            }, 'socket-1');

            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'user-1' }),
                'socket-1',
            );
        });

        it('should throw when visitId is missing', async () => {
            await expect(
                service.requestPrintCard('user-1', { visitId: '', visitorId: 'v1' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw when visitorId is missing', async () => {
            await expect(
                service.requestPrintCard('user-1', { visitId: 'v1', visitorId: '' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('should use explicit cardTemplateId when provided', async () => {
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
                cardTemplateId: 'explicit-template',
            });

            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestPayload: expect.objectContaining({
                        cardTemplateId: 'explicit-template',
                    }),
                }),
                undefined,
            );
            // Should not query the workstation session
            expect(workstationSession.getActiveSession).not.toHaveBeenCalled();
        });

        it('should resolve cardTemplateId from workstation when not explicitly provided', async () => {
            workstationSession.getActiveSession.mockResolvedValue({
                workstationId: 'ws-1',
                workstation: { defaultCardTemplateId: 'ws-default-template' },
            });
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
            });

            expect(workstationSession.getActiveSession).toHaveBeenCalledWith('user-1');
            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestPayload: expect.objectContaining({
                        cardTemplateId: 'ws-default-template',
                    }),
                }),
                undefined,
            );
        });

        it('should pass undefined cardTemplateId when no explicit template and no workstation default', async () => {
            workstationSession.getActiveSession.mockResolvedValue({
                workstationId: 'ws-1',
                workstation: { defaultCardTemplateId: null },
            });
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
            });

            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestPayload: expect.objectContaining({
                        cardTemplateId: undefined,
                    }),
                }),
                undefined,
            );
        });

        it('should include visitor data in printData', async () => {
            visitorRepo.findOne.mockResolvedValue({
                id: 'visitor-1',
                firstName: 'John',
                lastName: 'Doe',
                personId: '123456',
            });
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
            });

            expect(visitorRepo.findOne).toHaveBeenCalledWith({ where: { id: 'visitor-1' } });
            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestPayload: expect.objectContaining({
                        printData: expect.objectContaining({
                            fullName: 'John Doe',
                            department: '',
                            cardNumber: '123456',
                            qrValue: '123456',
                            id: '123456',
                        }),
                    }),
                }),
                undefined,
            );
        });

        it('should include visitRequester fields from visit in printData', async () => {
            visitorRepo.findOne.mockResolvedValue({
                id: 'visitor-1',
                firstName: 'John',
                lastName: 'Doe',
                personId: '123456',
            });
            visitRepo.findOne.mockResolvedValue({
                id: 'visit-1',
                visitRequesterUser: { firstName: 'Sarah', lastName: 'Connor' },
            });
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
            });

            expect(visitRepo.findOne).toHaveBeenCalledWith({
                where: { id: 'visit-1' },
                relations: ['visitRequesterUser'],
            });
            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    requestPayload: expect.objectContaining({
                        printData: expect.objectContaining({
                            visitRequesterFirstName: 'Sarah',
                            visitRequesterLastName: 'Connor',
                        }),
                    }),
                }),
                undefined,
            );
        });

        it('should include templateJson in printData when card template exists', async () => {
            visitorRepo.findOne.mockResolvedValue({
                id: 'visitor-1',
                firstName: 'Jane',
                lastName: 'Smith',
                personId: '789',
            });
            cardTemplateRepo.findOne.mockResolvedValue({
                id: 'template-1',
                name: 'Badge Template',
                elementsJson: '[{"type":"text","name":"FullName"}]',
                cardWidthMm: 86,
                cardHeightMm: 54,
                orientation: 'landscape',
                backgroundColor: '#ffffff',
            });
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
                cardTemplateId: 'template-1',
            });

            expect(cardTemplateRepo.findOne).toHaveBeenCalledWith({ where: { id: 'template-1' } });
            const payload = commandRouting.routeCommand.mock.calls[0][0].requestPayload;
            const parsed = JSON.parse(payload.printData.templateJson);
            expect(parsed.width).toBe(Math.round(86 * 3.78));
            expect(parsed.height).toBe(Math.round(54 * 3.78));
            expect(parsed.backgroundColor).toBe('#ffffff');
            expect(parsed.elements).toEqual([{ type: 'text', name: 'FullName' }]);
            expect(payload.printData.fullName).toBe('Jane Smith');
        });

        it('should not include templateJson when no card template is resolved', async () => {
            visitorRepo.findOne.mockResolvedValue({
                id: 'visitor-1',
                firstName: 'Bob',
                lastName: 'Jones',
                personId: '555',
            });
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
            });

            const payload = commandRouting.routeCommand.mock.calls[0][0].requestPayload;
            expect(payload.printData.fullName).toBe('Bob Jones');
            expect(payload.printData.templateJson).toBeUndefined();
            // Should have id for simple card printing fallback
            expect(payload.printData.id).toBe('555');
        });

        it('should handle visitor not found gracefully', async () => {
            visitorRepo.findOne.mockResolvedValue(null);
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestPrintCard('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
            });

            const payload = commandRouting.routeCommand.mock.calls[0][0].requestPayload;
            expect(payload.printData).toBeDefined();
            expect(payload.printData.fullName).toBeUndefined();
        });
    });

    describe('requestTestPrintTemplate', () => {
        it('should route test print command with correct provider and command type', async () => {
            cardTemplateRepo.findOne.mockResolvedValue({
                id: 'template-1',
                name: 'Badge Template',
                elementsJson: '[{"type":"visitor-field","visitorField":"fullName"}]',
                cardWidthMm: 86,
                cardHeightMm: 54,
                orientation: 'landscape',
                backgroundColor: '#ffffff',
            });
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            const result = await service.requestTestPrintTemplate('user-1', {
                cardTemplateId: 'template-1',
            });

            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-1',
                    providerType: IntegrationProvider.Printer,
                    commandType: 'test-print-template',
                    requestPayload: expect.objectContaining({
                        cardTemplateId: 'template-1',
                        testPrint: true,
                        printData: expect.objectContaining({
                            fullName: 'Israel Israeli',
                            personId: '123456789',
                        }),
                    }),
                }),
                undefined,
            );
            expect(result.correlationId).toBe('corr-1');
            expect(result.printData).toBeDefined();
            expect(result.printData.fullName).toBe('Israel Israeli');
            expect(result.printData.templateJson).toBeDefined();
        });

        it('should include templateJson with correct dimensions in mock printData', async () => {
            cardTemplateRepo.findOne.mockResolvedValue({
                id: 'template-1',
                elementsJson: '[{"type":"static-text","text":"Hello"}]',
                cardWidthMm: 86,
                cardHeightMm: 54,
                orientation: 'landscape',
                backgroundColor: '#ff0000',
            });
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            const result = await service.requestTestPrintTemplate('user-1', {
                cardTemplateId: 'template-1',
            });

            const parsed = JSON.parse(result.printData.templateJson as string);
            expect(parsed.width).toBe(Math.round(86 * 3.78));
            expect(parsed.height).toBe(Math.round(54 * 3.78));
            expect(parsed.backgroundColor).toBe('#ff0000');
            expect(parsed.elements).toEqual([{ type: 'static-text', text: 'Hello' }]);
        });

        it('should return mock printData without templateJson when template not found', async () => {
            cardTemplateRepo.findOne.mockResolvedValue(null);
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            const result = await service.requestTestPrintTemplate('user-1', {
                cardTemplateId: 'template-1',
            });

            expect(result.printData.fullName).toBe('Israel Israeli');
            expect(result.printData.templateJson).toBeUndefined();
        });

        it('should pass userSocketId when provided', async () => {
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1' },
                agentSocketId: 'agent-1',
                correlationId: 'corr-1',
            });

            await service.requestTestPrintTemplate('user-1', {
                cardTemplateId: 'template-1',
            }, 'socket-1');

            expect(commandRouting.routeCommand).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'user-1' }),
                'socket-1',
            );
        });

        it('should throw when cardTemplateId is missing', async () => {
            await expect(
                service.requestTestPrintTemplate('user-1', { cardTemplateId: '' }),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('requestPrintCardAndNotify', () => {
        it('should route print command and send WS notifications', async () => {
            commandRouting.routeCommand.mockResolvedValue({
                commandLog: { id: 'log-1', requestPayloadJson: JSON.stringify({ cardTemplateId: 'tpl-1', printData: { fullName: 'Test' } }) },
                agentSocketId: 'agent-sock-1',
                correlationId: 'corr-1',
            });

            const result = await service.requestPrintCardAndNotify('user-1', {
                visitId: 'visit-1',
                visitorId: 'visitor-1',
                cardTemplateId: 'tpl-1',
                printOptions: { copies: 1 },
            });

            expect(result).toEqual({ correlationId: 'corr-1', status: 'queued' });
            expect(mockUsersGateway.broadcastToRoom).toHaveBeenCalledWith(
                'user:user-1',
                expect.any(String),
                expect.objectContaining({ correlationId: 'corr-1', visitId: 'visit-1', visitorId: 'visitor-1' }),
            );
            expect(mockUsersGateway.emitToAgentNamespace).toHaveBeenCalledWith(
                'agent-sock-1',
                expect.any(String),
                expect.objectContaining({ correlationId: 'corr-1', printOptions: { copies: 1 } }),
            );
        });
    });
});
