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
import { PrinterEventAdapter } from './adapters/printer-event.adapter';
import { PrinterEventsService } from './printer-events.service';
import { CreatePrinterEventDto } from './dto/create-printer-event.dto';

@ApiTags('Integrations / Printer')
@Controller('integrations/printer')
export class PrinterEventsController {
    private readonly logger = new Logger(PrinterEventsController.name);

    constructor(
        private readonly adapter: PrinterEventAdapter,
        private readonly eventsService: PrinterEventsService,
        private readonly eventLogService: InboundEventLogService,
    ) { }

    @Post('events')
    @Public()
    @UseGuards(IntegrationHmacGuard)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Receive inbound printer events' })
    @ApiHeader({ name: 'x-client-id', required: true })
    @ApiHeader({ name: 'x-timestamp', required: true })
    @ApiHeader({ name: 'x-signature', required: true })
    async receiveEvent(
        @Body() dto: CreatePrinterEventDto,
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

        const log = await this.eventLogService.createLog(client.clientId, signature, event);

        try {
            await this.eventsService.processEvent(event, log.id);
            return { status: 'processed', eventId: log.id };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            await this.eventLogService.markFailed(log.id, message);
            this.logger.error(`Failed to process printer event ${log.id}: ${message}`);
            return { status: 'failed', eventId: log.id };
        }
    }
}
