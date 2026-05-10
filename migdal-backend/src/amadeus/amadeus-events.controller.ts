import {
    Controller,
    Get,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Logger,
    BadRequestException,
    Query,
    DefaultValuePipe,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { InboundEventLogService } from '../integrations/common/services/inbound-event-log.service';
import { AmadeusEventAdapter } from './adapters/amadeus-event.adapter';
import { AmadeusEventsService } from './amadeus-events.service';
import { CreateAmadeusEventDto } from './dto/create-amadeus-event.dto';

interface AmadeusEventResult {
    status: 'processed' | 'duplicate' | 'failed';
    eventId: string;
    error?: string;
}

@ApiTags('Amadeus M2M / Events')
@ApiBearerAuth()
@Controller('events')
export class AmadeusEventsController {
    private readonly logger = new Logger(AmadeusEventsController.name);

    private static readonly DEFAULT_CLIENT_ID = 'amadeus-service';
    private static readonly DEFAULT_SIGNATURE = 'unsigned';

    constructor(
        private readonly adapter: AmadeusEventAdapter,
        private readonly eventsService: AmadeusEventsService,
        private readonly eventLogService: InboundEventLogService,
    ) { }

    @Get('amadeus')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List Amadeus realtime events from the event log with pagination' })
    async getRecentEvents(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    ) {
        return this.eventsService.getEvents(page, limit);
    }

    @Post('amadeus')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Receive batch of Amadeus access-control events' })
    async receiveEvents(
        @Body() dtos: CreateAmadeusEventDto[],
    ): Promise<{ received: number; results: AmadeusEventResult[] }> {
        if (!Array.isArray(dtos)) {
            throw new BadRequestException('Request body must be an array of events');
        }

        this.logger.log(`Received batch of ${dtos.length} Amadeus events`);

        const results: AmadeusEventResult[] = [];

        for (const dto of dtos) {
            const result = await this.processSingleEvent(dto);
            results.push(result);
        }

        const processed = results.filter((r) => r.status === 'processed').length;
        const duplicates = results.filter((r) => r.status === 'duplicate').length;
        const failed = results.filter((r) => r.status === 'failed').length;

        this.logger.log(
            `Amadeus batch complete: ${processed} processed, ${duplicates} duplicates, ${failed} failed`,
        );

        return { received: dtos.length, results };
    }

    private async processSingleEvent(dto: CreateAmadeusEventDto): Promise<AmadeusEventResult> {
        try {
            const event = this.adapter.toCanonical(dto);

            // Idempotency check
            const isDuplicate = await this.eventLogService.isDuplicate(
                event.provider,
                event.externalEventId,
            );
            if (isDuplicate) {
                this.logger.debug(
                    `Duplicate Amadeus event skipped: ${event.externalEventId} (${dto.internalEventType})`,
                );
                return { status: 'duplicate', eventId: event.externalEventId };
            }

            // Save raw event log
            const log = await this.eventLogService.createLog(
                AmadeusEventsController.DEFAULT_CLIENT_ID,
                AmadeusEventsController.DEFAULT_SIGNATURE,
                event,
            );

            // Process event
            await this.eventsService.processEvent(event, log.id);
            return { status: 'processed', eventId: log.id };
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            const eventId = dto.externalEventId ?? dto.eventUid ?? 'unknown';
            this.logger.error(
                `Failed to process Amadeus event ${eventId} (${dto.internalEventType}): ${message}`,
            );
            return { status: 'failed', eventId, error: message };
        }
    }
}
