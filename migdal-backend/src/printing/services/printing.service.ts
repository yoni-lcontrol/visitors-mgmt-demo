import { Injectable, Logger, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceCommandRoutingService, CommandRouteResult } from '../../device-commands/services/device-command-routing.service';
import { WorkstationSessionService } from '../../workstations/services/workstation-session.service';
import { WorkstationsService } from '../../workstations/services/workstations.service';
import { AgentRegistryService } from '../../agents/services/agent-registry.service';
import { IntegrationProvider } from '../../integrations/common/enums/integration-provider.enum';
import { CardTemplate } from '../../settings/entities/card-template.entity';
import { Visitor } from '../../visitors/entities/visitor.entity';
import { Visit } from '../../visitors/entities/visit.entity';
import { UsersGateway } from '../../websocket/gateways/users.gateway';
import { WsEvent } from '../../websocket/enums/ws-events.enum';

export interface PrintCardRequest {
    visitId: string;
    visitorId: string;
    cardTemplateId?: string;
    printOptions?: Record<string, unknown>;
}

export interface TestPrintTemplateRequest {
    cardTemplateId: string;
}

@Injectable()
export class PrintingService {
    private readonly logger = new Logger(PrintingService.name);

    constructor(
        private readonly commandRouting: DeviceCommandRoutingService,
        private readonly workstationSession: WorkstationSessionService,
        private readonly workstationsService: WorkstationsService,
        private readonly agentRegistry: AgentRegistryService,
        @InjectRepository(CardTemplate)
        private readonly cardTemplateRepo: Repository<CardTemplate>,
        @InjectRepository(Visitor)
        private readonly visitorRepo: Repository<Visitor>,
        @InjectRepository(Visit)
        private readonly visitRepo: Repository<Visit>,
        private readonly usersGateway: UsersGateway,
    ) { }

    /**
     * Resolve the card template ID: use explicit value if provided,
     * otherwise fall back to the workstation's default card template.
     */
    private async resolveCardTemplateId(userId: string, explicitTemplateId?: string): Promise<string | undefined> {
        if (explicitTemplateId) return explicitTemplateId;

        const session = await this.workstationSession.getActiveSession(userId);
        if (session?.workstation?.defaultCardTemplateId) {
            this.logger.log(
                `Using workstation default card template: ${session.workstation.defaultCardTemplateId}`,
            );
            return session.workstation.defaultCardTemplateId;
        }

        return undefined;
    }

    async requestPrintCard(
        userId: string,
        payload: PrintCardRequest,
        userSocketId?: string,
    ): Promise<CommandRouteResult> {
        if (!payload.visitId || !payload.visitorId) {
            throw new BadRequestException('visitId and visitorId are required');
        }

        const cardTemplateId = await this.resolveCardTemplateId(userId, payload.cardTemplateId);
        const printData = await this.buildPrintData(payload.visitId, payload.visitorId, cardTemplateId);

        this.logger.log(
            `Print card requested: user=${userId}, visit=${payload.visitId}, visitor=${payload.visitorId}, template=${cardTemplateId || 'none'}`,
        );

        return this.commandRouting.routeCommand(
            {
                userId,
                providerType: IntegrationProvider.Printer,
                commandType: 'print-card',
                requestPayload: {
                    visitId: payload.visitId,
                    visitorId: payload.visitorId,
                    cardTemplateId,
                    printOptions: payload.printOptions,
                    printData,
                },
            },
            userSocketId,
        );
    }

    /**
     * Request a print card and send WS notifications to the user and agent.
     */
    async requestPrintCardAndNotify(
        userId: string,
        payload: PrintCardRequest,
    ): Promise<{ correlationId: string; status: string }> {
        const routeResult = await this.requestPrintCard(userId, payload);

        // Notify the user via WebSocket that the print job is queued
        this.usersGateway.broadcastToRoom(`user:${userId}`, WsEvent.VisitsVisitorPrintQueued, {
            correlationId: routeResult.correlationId,
            visitId: payload.visitId,
            visitorId: payload.visitorId,
        });

        // Send the print command to the agent
        const resolvedPayload = routeResult.commandLog.requestPayloadJson
            ? JSON.parse(routeResult.commandLog.requestPayloadJson)
            : {};
        this.usersGateway.emitToAgentNamespace(routeResult.agentSocketId, WsEvent.AgentExecutePrint, {
            correlationId: routeResult.correlationId,
            visitId: payload.visitId,
            visitorId: payload.visitorId,
            cardTemplateId: resolvedPayload.cardTemplateId,
            printData: resolvedPayload.printData || {},
            printOptions: payload.printOptions,
        });

        return { correlationId: routeResult.correlationId, status: 'queued' };
    }

    /**
     * Kiosk print: route print command by workstation code (no user session required).
     */
    async requestKioskPrintCard(
        workstationCode: string,
        visitId: string,
        visitorId: string,
        cardTemplateId?: string,
    ): Promise<{ ok: boolean; correlationId?: string; status?: string }> {
        const workstation = await this.workstationsService.findByCode(workstationCode);
        if (!workstation) {
            throw new BadRequestException(`Unknown workstation: ${workstationCode}`);
        }

        const resolvedTemplateId = cardTemplateId || workstation.defaultCardTemplateId || undefined;

        const agent = await this.agentRegistry.findActiveConnection(
            workstation.id,
            IntegrationProvider.Printer,
        );
        if (!agent || !agent.socketId) {
            throw new ServiceUnavailableException('No printer agent connected on this workstation');
        }

        const printData = await this.buildPrintData(visitId, visitorId, resolvedTemplateId);
        const correlationId = `kiosk-print-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        this.usersGateway.emitToAgentNamespace(agent.socketId, WsEvent.AgentExecutePrint, {
            correlationId,
            visitId,
            visitorId,
            cardTemplateId: resolvedTemplateId,
            printData,
        });

        this.logger.log(
            `Kiosk print card: workstation=${workstationCode}, visit=${visitId}, visitor=${visitorId}, template=${resolvedTemplateId || 'none'}, correlationId=${correlationId}`,
        );

        return { ok: true, correlationId, status: 'queued' };
    }

    async requestTestPrintTemplate(
        userId: string,
        payload: TestPrintTemplateRequest,
        userSocketId?: string,
    ): Promise<CommandRouteResult & { printData: Record<string, unknown> }> {
        if (!payload.cardTemplateId) {
            throw new BadRequestException('cardTemplateId is required');
        }

        this.logger.log(
            `Test print template requested: user=${userId}, template=${payload.cardTemplateId}`,
        );

        const printData = await this.buildTestPrintData(payload.cardTemplateId);

        const routeResult = await this.commandRouting.routeCommand(
            {
                userId,
                providerType: IntegrationProvider.Printer,
                commandType: 'test-print-template',
                requestPayload: {
                    cardTemplateId: payload.cardTemplateId,
                    testPrint: true,
                    printData,
                },
            },
            userSocketId,
        );

        return { ...routeResult, printData };
    }

    /**
     * Build mock printData for test printing a card template.
     * Uses sample values for all visitor fields so the printer can render a preview.
     */
    private async buildTestPrintData(cardTemplateId: string): Promise<Record<string, unknown>> {
        const printData: Record<string, unknown> = {
            fullName: 'Israel Israeli',
            firstName: 'Israel',
            lastName: 'Israeli',
            department: '',
            cardNumber: '123456789',
            personId: '123456789',
            qrValue: '123456789',
            id: '123456789',
            title: '',
            image: '',
            phone: '050-1234567',
            email: 'israel@example.com',
            hostName: 'David Cohen',
            visitDate: new Date().toLocaleDateString('he-IL'),
            startTime: '09:00',
            endTime: '17:00',
            carNumber: '12-345-67',
            visitRequesterFirstName: 'David',
            visitRequesterLastName: 'Cohen',
        };

        const template = await this.cardTemplateRepo.findOne({ where: { id: cardTemplateId } });
        if (template) {
            const PX_PER_MM = 3.78;
            const isLandscape = template.orientation === 'landscape';
            const w = isLandscape
                ? Math.max(template.cardWidthMm, template.cardHeightMm)
                : Math.min(template.cardWidthMm, template.cardHeightMm);
            const h = isLandscape
                ? Math.min(template.cardWidthMm, template.cardHeightMm)
                : Math.max(template.cardWidthMm, template.cardHeightMm);

            printData.templateJson = JSON.stringify({
                width: Math.round(w * PX_PER_MM),
                height: Math.round(h * PX_PER_MM),
                rotated: false,
                backgroundColor: template.backgroundColor || '#ffffff',
                elements: JSON.parse(template.elementsJson),
            });
        }

        return printData;
    }

    /**
     * Build the printData payload with card template JSON and visitor fields.
     * If a template exists, sends templateJson for template-based printing.
     * If no template, sends fullName + id for simple card printing.
     */
    private async buildPrintData(
        visitId: string,
        visitorId: string,
        cardTemplateId?: string,
    ): Promise<Record<string, unknown>> {
        const printData: Record<string, unknown> = {};

        // Load visitor data
        const visitor = await this.visitorRepo.findOne({ where: { id: visitorId } });
        if (visitor) {
            printData.fullName = `${visitor.firstName} ${visitor.lastName}`;
            printData.department = '';
            printData.cardNumber = visitor.personId || '';
            printData.qrValue = visitor.personId || '';
            printData.title = '';
            printData.image = '';
            printData.id = visitor.personId || '';
        }

        // Load visit data for visitRequester fields
        const visit = await this.visitRepo.findOne({ where: { id: visitId }, relations: ['visitRequesterUser'] });
        if (visit) {
            if (visit.visitRequesterUser) {
                printData.visitRequesterFirstName = visit.visitRequesterUser.firstName || '';
                printData.visitRequesterLastName = visit.visitRequesterUser.lastName || '';
            } else {
                printData.visitRequesterFirstName = visit.visitRequesterFirstName || '';
                printData.visitRequesterLastName = visit.visitRequesterLastName || '';
            }
        }

        // Load card template if resolved
        if (cardTemplateId) {
            const template = await this.cardTemplateRepo.findOne({ where: { id: cardTemplateId } });
            if (template) {
                const PX_PER_MM = 3.78;
                const isLandscape = template.orientation === 'landscape';
                const w = isLandscape
                    ? Math.max(template.cardWidthMm, template.cardHeightMm)
                    : Math.min(template.cardWidthMm, template.cardHeightMm);
                const h = isLandscape
                    ? Math.min(template.cardWidthMm, template.cardHeightMm)
                    : Math.max(template.cardWidthMm, template.cardHeightMm);

                printData.templateJson = JSON.stringify({
                    width: Math.round(w * PX_PER_MM),
                    height: Math.round(h * PX_PER_MM),
                    rotated: false,
                    backgroundColor: template.backgroundColor || '#ffffff',
                    elements: JSON.parse(template.elementsJson),
                });
            }
        }

        return printData;
    }
}
