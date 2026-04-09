import {
    Controller,
    Post,
    Body,
    UseGuards,
    Req,
    HttpCode,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { IntegrationHmacGuard } from '../common/guards/integration-hmac.guard';
import { InboundEventLogService } from '../common/services/inbound-event-log.service';
import { AccessControlEventAdapter } from './adapters/access-control-event.adapter';
import { AccessControlEventsService } from './access-control-events.service';
import { CreateAccessControlEventDto } from './dto/create-access-control-event.dto';

@ApiTags('Integrations / Access Control')
@Controller('integrations/access-control')
export class AccessControlEventsController {
    private readonly logger = new Logger(AccessControlEventsController.name);

    constructor(
        private readonly adapter: AccessControlEventAdapter,
        private readonly eventsService: AccessControlEventsService,
        private readonly eventLogService: InboundEventLogService,
    ) { }

    @Post('events')
    @Public()
    @UseGuards(IntegrationHmacGuard)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Receive inbound access control events' })
    @ApiHeader({ name: 'x-client-id', required: true })
    @ApiHeader({ name: 'x-timestamp', required: true })
    @ApiHeader({ name: 'x-signature', required: true })
    async receiveEvent(
        @Body() dto: CreateAccessControlEventDto,
        @Req() req: Request,
    ): Promise<{ status: string; eventId: string }> {
        const client = (req as any).integrationClient;
        const signature = req.headers['x-signature'] as string;

        const event = this.adapter.toCanonical(dto);

        // Idempotency check before saving
        const isDuplicate = await this.eventLogService.isDuplicate(
            event.provider,
            event.externalEventId,
        );
        if (isDuplicate) {
            return { status: 'duplicate', eventId: event.externalEventId };
        }

        // Save raw log
        const log = await this.eventLogService.createLog(client.clientId, signature, event);

        try {
            await this.eventsService.processEvent(event, log.id);
            return { status: 'processed', eventId: log.id };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            await this.eventLogService.markFailed(log.id, message);
            this.logger.error(`Failed to process access-control event ${log.id}: ${message}`);
            return { status: 'failed', eventId: log.id };
        }
    }
}
