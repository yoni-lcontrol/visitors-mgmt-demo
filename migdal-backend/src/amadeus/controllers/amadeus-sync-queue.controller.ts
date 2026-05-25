import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    HttpCode,
    HttpStatus,
    Logger,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionKey } from '../../common/enums/permission-key.enum';
import { AmadeusSyncQueueService } from '../services/amadeus-sync-queue.service';
import { AmadeusParkingSyncService } from '../services/amadeus-parking-sync.service';
import { SyncQueueStatus, SyncQueueSource } from '../entities/amadeus-sync-queue.entity';

@ApiTags('Amadeus Sync Queue')
@Controller('amadeus-sync-queue')
export class AmadeusSyncQueueController {
    private readonly logger = new Logger(AmadeusSyncQueueController.name);

    constructor(
        private readonly syncQueueService: AmadeusSyncQueueService,
        private readonly parkingSyncService: AmadeusParkingSyncService,
    ) {}

    @Get()
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'List sync queue items' })
    @ApiQuery({ name: 'status', required: false, enum: SyncQueueStatus })
    @ApiQuery({ name: 'source', required: false, enum: SyncQueueSource })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async findAll(
        @Query('status') status?: SyncQueueStatus,
        @Query('source') source?: SyncQueueSource,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.syncQueueService.findAll({
            status,
            source,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    @Get('stats')
    @RequirePermissions(PermissionKey.AccessControlRead)
    @ApiOperation({ summary: 'Get queue statistics' })
    async getStats() {
        return this.syncQueueService.getStats();
    }

    @Post(':id/retry')
    @RequirePermissions(PermissionKey.AccessControlSync)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Retry a specific queue item' })
    async retryItem(@Param('id', ParseUUIDPipe) id: string) {
        this.logger.log(`Manual retry requested for sync queue item: ${id}`);
        return this.syncQueueService.retryItem(id);
    }

    @Post('retry-all-failed')
    @RequirePermissions(PermissionKey.AccessControlSync)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Reset all failed items for retry' })
    async retryAllFailed() {
        this.logger.log('Manual retry-all-failed requested');
        return this.syncQueueService.retryAllFailed();
    }

    @Post(':id/cancel')
    @RequirePermissions(PermissionKey.AccessControlSync)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel a pending/failed queue item' })
    async cancelItem(@Param('id', ParseUUIDPipe) id: string) {
        this.logger.log(`Cancel requested for sync queue item: ${id}`);
        return this.syncQueueService.cancelItem(id);
    }

    @Post('process')
    @RequirePermissions(PermissionKey.AccessControlSync)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Manually trigger queue processing' })
    async processQueue() {
        this.logger.log('Manual queue processing triggered');
        return this.syncQueueService.processQueue();
    }

    @Post('resync-parking/:id')
    @RequirePermissions(PermissionKey.AccessControlSync)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Re-trigger Amadeus sync for a specific parking request' })
    async resyncParking(@Param('id', ParseUUIDPipe) id: string) {
        this.logger.log(`Manual parking resync requested for parkingRequestId: ${id}`);
        await this.parkingSyncService.syncApprovedParkingVisitorToAmadeus(id);
        return { success: true, message: `Sync triggered for parking request ${id}` };
    }
}
