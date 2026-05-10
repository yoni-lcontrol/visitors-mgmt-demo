import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalEventLog } from '../entities/external-event-log.entity';
import { InboundEventStatus } from '../enums/inbound-event-status.enum';
import { InboundEvent } from '../interfaces/inbound-event.interface';

@Injectable()
export class InboundEventLogService {
    private readonly logger = new Logger(InboundEventLogService.name);

    constructor(
        @InjectRepository(ExternalEventLog)
        private readonly repo: Repository<ExternalEventLog>,
    ) { }

    async createLog(
        clientId: string,
        signature: string,
        event: InboundEvent,
    ): Promise<ExternalEventLog> {
        const log = this.repo.create({
            provider: event.provider,
            clientId,
            externalEventId: event.externalEventId,
            eventType: event.eventType,
            payloadJson: JSON.stringify(event.payload),
            signature,
            receivedAt: new Date(),
            status: InboundEventStatus.Received,
        });
        return this.repo.save(log);
    }

    async isDuplicate(provider: string, externalEventId: string): Promise<boolean> {
        if (!externalEventId) return false;
        const existing = await this.repo.findOne({
            where: { provider, externalEventId },
        });
        return !!existing;
    }

    async markProcessed(id: string): Promise<void> {
        await this.repo.update(id, {
            status: InboundEventStatus.Processed,
            processedAt: new Date(),
        });
    }

    async markDuplicate(id: string): Promise<void> {
        await this.repo.update(id, {
            status: InboundEventStatus.Duplicate,
            processedAt: new Date(),
        });
    }

    async markFailed(id: string, errorMessage: string): Promise<void> {
        await this.repo.update(id, {
            status: InboundEventStatus.Failed,
            errorMessage,
            processedAt: new Date(),
        });
    }

    async markIgnored(id: string, reason: string): Promise<void> {
        await this.repo.update(id, {
            status: InboundEventStatus.Ignored,
            errorMessage: reason,
            processedAt: new Date(),
        });
    }

    async findRecentByProvider(provider: string, limit = 200): Promise<ExternalEventLog[]> {
        return this.repo.find({
            where: {
                provider,
                isActive: true,
            },
            order: {
                receivedAt: 'DESC',
            },
            take: limit,
        });
    }

    async findByProviderPaginated(
        provider: string,
        page: number,
        limit: number,
    ): Promise<{ items: ExternalEventLog[]; total: number }> {
        const [items, total] = await this.repo.findAndCount({
            where: { provider },
            order: { receivedAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { items, total };
    }
}
