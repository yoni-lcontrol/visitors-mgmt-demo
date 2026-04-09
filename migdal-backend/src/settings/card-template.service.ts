import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardTemplate } from './entities/card-template.entity';
import { CreateCardTemplateDto } from './dto/create-card-template.dto';
import { UpdateCardTemplateDto } from './dto/update-card-template.dto';
import { UsersGateway } from '../websocket/gateways/users.gateway';
import { WsEvent } from '../websocket/enums/ws-events.enum';
import { PrintingService } from '../printing/services/printing.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CardTemplateService {
    constructor(
        @InjectRepository(CardTemplate)
        private readonly repo: Repository<CardTemplate>,
        private readonly wsGateway: UsersGateway,
        private readonly printingService: PrintingService,
        private readonly auditService: AuditService,
    ) { }

    async findAll(): Promise<CardTemplate[]> {
        return this.repo.find({
            where: { isActive: true },
            order: { updatedAt: 'DESC' },
        });
    }

    async findById(id: string): Promise<CardTemplate> {
        const template = await this.repo.findOne({ where: { id, isActive: true } });
        if (!template) throw new NotFoundException('Card template not found');
        return template;
    }

    async create(dto: CreateCardTemplateDto, currentUserId?: string): Promise<CardTemplate> {
        this.validateElementsJson(dto.elementsJson);

        const existing = await this.repo.findOne({
            where: { name: dto.name, isActive: true },
        });
        if (existing) throw new ConflictException('A card template with this name already exists');

        const entity = this.repo.create({
            ...dto,
            createdBy: currentUserId ?? null,
            updatedBy: currentUserId ?? null,
        });
        const saved = await this.repo.save(entity);

        this.wsGateway.broadcastToAll('settings:card-template:created', {
            id: saved.id,
            name: saved.name,
        });

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'CREATE',
            entity: 'CardTemplate',
            entityId: saved.id,
            description: `Created card template "${saved.name}"`,
            newValue: { name: saved.name, orientation: saved.orientation },
        }).catch(() => { });

        return saved;
    }

    async update(id: string, dto: UpdateCardTemplateDto, currentUserId?: string): Promise<CardTemplate> {
        const template = await this.findById(id);

        if (dto.elementsJson !== undefined) {
            this.validateElementsJson(dto.elementsJson);
        }

        if (dto.name && dto.name !== template.name) {
            const existing = await this.repo.findOne({
                where: { name: dto.name, isActive: true },
            });
            if (existing && existing.id !== id) {
                throw new ConflictException('A card template with this name already exists');
            }
        }

        const oldName = template.name;
        Object.assign(template, dto, { updatedBy: currentUserId ?? null });
        const saved = await this.repo.save(template);

        this.wsGateway.broadcastToAll('settings:card-template:updated', {
            id: saved.id,
            name: saved.name,
        });

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'UPDATE',
            entity: 'CardTemplate',
            entityId: saved.id,
            description: `Updated card template "${saved.name}"`,
            oldValue: { name: oldName },
            newValue: { name: saved.name },
        }).catch(() => { });

        return saved;
    }

    async remove(id: string, currentUserId?: string): Promise<void> {
        const template = await this.findById(id);
        template.isActive = false;
        template.updatedBy = currentUserId ?? null;
        await this.repo.save(template);

        this.wsGateway.broadcastToAll('settings:card-template:deleted', { id });

        this.auditService.log({
            userId: currentUserId,
            module: 'settings',
            action: 'DELETE',
            entity: 'CardTemplate',
            entityId: id,
            description: `Deleted card template "${template.name}"`,
        }).catch(() => { });
    }

    async testPrint(cardTemplateId: string, userId: string): Promise<{ correlationId: string; status: string }> {
        await this.findById(cardTemplateId);

        const routeResult = await this.printingService.requestTestPrintTemplate(
            userId,
            { cardTemplateId },
        );

        this.wsGateway.broadcastToRoom(`user:${userId}`, WsEvent.VisitsVisitorPrintQueued, {
            correlationId: routeResult.correlationId,
            cardTemplateId,
            testPrint: true,
        });

        this.wsGateway.emitToAgentNamespace(routeResult.agentSocketId, WsEvent.AgentExecutePrint, {
            correlationId: routeResult.correlationId,
            cardTemplateId,
            testPrint: true,
            printData: routeResult.printData,
        });

        return {
            correlationId: routeResult.correlationId,
            status: 'queued',
        };
    }

    private static readonly ALLOWED_ELEMENT_TYPES = ['visitor-field', 'static-text', 'image', 'shape', 'qr'];
    private static readonly ALLOWED_QR_SOURCE_TYPES = ['static', 'dynamic'];

    private validateElementsJson(json: string): void {
        try {
            const parsed = JSON.parse(json);
            if (!Array.isArray(parsed)) {
                throw new BadRequestException('elementsJson must be a JSON array');
            }
            for (const el of parsed) {
                if (el.type && !CardTemplateService.ALLOWED_ELEMENT_TYPES.includes(el.type)) {
                    throw new BadRequestException(`Invalid element type: ${el.type}`);
                }
                if (el.type === 'qr' && el.qrSourceType &&
                    !CardTemplateService.ALLOWED_QR_SOURCE_TYPES.includes(el.qrSourceType)) {
                    throw new BadRequestException(`Invalid QR source type: ${el.qrSourceType}`);
                }
            }
        } catch (e) {
            if (e instanceof BadRequestException) throw e;
            throw new BadRequestException('elementsJson must be valid JSON');
        }
    }
}
