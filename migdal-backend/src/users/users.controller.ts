import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    Res,
    HttpCode,
    HttpStatus,
    Logger,
    NotFoundException,
    Optional,
    Inject,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { sendExcelResponse } from '../common/utils/excel.util';
import { UsersService } from './users.service';
import { AdSyncService } from './ad-sync.service';
import { AmadeusBadgeImportService } from './amadeus-badge-import.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionKey } from '../common/enums/permission-key.enum';
import { ParseUUIDPipe } from '../common/pipes/parse-uuid.pipe';
import { AD_SYNC_QUEUE, AdSyncJobData } from './ad-sync.processor';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
    private readonly logger = new Logger(UsersController.name);
    private redisAvailable: boolean | null = null;
    private redisCheckedAt = 0;
    private static readonly REDIS_CHECK_INTERVAL_MS = 30_000; // re-check every 30s

    constructor(
        private readonly usersService: UsersService,
        private readonly adSyncService: AdSyncService,
        private readonly badgeImportService: AmadeusBadgeImportService,
        @Optional() @Inject(getQueueToken(AD_SYNC_QUEUE)) private readonly adSyncQueue?: Queue<AdSyncJobData>,
    ) { }

    private async isQueueAvailable(): Promise<boolean> {
        if (!this.adSyncQueue) return false;
        const now = Date.now();
        if (this.redisAvailable !== null && now - this.redisCheckedAt < UsersController.REDIS_CHECK_INTERVAL_MS) {
            return this.redisAvailable;
        }
        try {
            await this.adSyncQueue.client;
            this.redisAvailable = true;
        } catch {
            this.redisAvailable = false;
        }
        this.redisCheckedAt = now;
        return this.redisAvailable;
    }

    @Get()
    @RequirePermissions(PermissionKey.UsersRead)
    @ApiOperation({ summary: 'List all users (paginated)' })
    findAll(@Query() query: PaginationQueryDto) {
        return this.usersService.findAll(query);
    }

    @Get('lookup')
    @RequirePermissions(PermissionKey.VisitsCreate)
    @ApiOperation({ summary: 'Search users for requester selection (visit on-behalf flow)' })
    lookup(@Query() query: PaginationQueryDto) {
        return this.usersService.findAll(query);
    }

    @Get('export')
    @RequirePermissions(PermissionKey.UsersRead)
    @ApiOperation({ summary: 'Export users as Excel' })
    async export(
        @Query() query: PaginationQueryDto,
        @Res() res: Response,
    ) {
        const file = await this.usersService.exportToExcel(query);
        sendExcelResponse(res, file, 'users.xlsx');
    }

    @Get(':id')
    @RequirePermissions(PermissionKey.UsersRead)
    @ApiOperation({ summary: 'Get user by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.findById(id);
    }

    @Post()
    @RequirePermissions(PermissionKey.UsersCreate)
    @ApiOperation({ summary: 'Create a new user' })
    create(
        @Body() dto: CreateUserDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.usersService.create(dto, currentUserId);
    }

    @Post('sync-ad')
    @RequirePermissions(PermissionKey.UsersSync)
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({ summary: 'Trigger full AD user synchronization (async via BullMQ, progress via WebSocket)' })
    async syncFromAd(@CurrentUser('sub') currentUserId: string) {
        const queueReady = await this.isQueueAvailable();

        if (queueReady) {
            // BullMQ path — queue the job
            const activeJobs = await this.adSyncQueue!.getJobs(['active', 'waiting']);
            if (activeJobs.length > 0) {
                return {
                    message: 'AD sync is already in progress',
                    jobId: activeJobs[0].id,
                };
            }

            const job = await this.adSyncQueue!.add('sync-all', { triggeredBy: currentUserId }, {
                jobId: `ad-sync-${Date.now()}`,
            });

            this.logger.log(`AD sync job queued: ${job.id} by user ${currentUserId}`);

            return {
                message: 'AD sync job queued, progress will be reported via WebSocket',
                jobId: job.id,
            };
        }

        // Fallback — run sync directly (fire-and-forget) when Redis is unavailable
        this.logger.warn('Redis unavailable, running AD sync directly (fire-and-forget)');
        this.adSyncService.syncAll(currentUserId).catch(err => {
            this.logger.error('Direct AD sync failed', (err as Error).stack);
        });

        return {
            message: 'AD sync started directly (Redis unavailable), progress via WebSocket',
            jobId: null,
        };
    }

    @Get('sync-ad/status')
    @RequirePermissions(PermissionKey.UsersSync)
    @ApiOperation({ summary: 'Get AD sync job status' })
    async getSyncStatus(@Query('jobId') jobId?: string) {
        const queueReady = await this.isQueueAvailable();
        if (!queueReady) {
            return { message: 'Queue unavailable (Redis not connected), sync runs directly' };
        }

        if (jobId) {
            const job = await this.adSyncQueue!.getJob(jobId);
            if (!job) {
                throw new NotFoundException(`Job ${jobId} not found`);
            }
            const state = await job.getState();
            return {
                jobId: job.id,
                state,
                progress: job.progress,
                data: job.data,
                result: job.returnvalue,
                failedReason: job.failedReason,
                attemptsMade: job.attemptsMade,
                timestamp: job.timestamp,
                finishedOn: job.finishedOn,
                processedOn: job.processedOn,
            };
        }

        // Return latest job status
        const completed = await this.adSyncQueue!.getJobs(['completed'], 0, 0);
        const active = await this.adSyncQueue!.getJobs(['active'], 0, 0);
        const waiting = await this.adSyncQueue!.getJobs(['waiting'], 0, 0);
        const failed = await this.adSyncQueue!.getJobs(['failed'], 0, 0);

        const latest = [...active, ...waiting, ...completed, ...failed]
            .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))[0];

        if (!latest) {
            return { message: 'No AD sync jobs found' };
        }

        const state = await latest.getState();
        return {
            jobId: latest.id,
            state,
            progress: latest.progress,
            result: latest.returnvalue,
            failedReason: latest.failedReason,
            attemptsMade: latest.attemptsMade,
            timestamp: latest.timestamp,
            finishedOn: latest.finishedOn,
            processedOn: latest.processedOn,
        };
    }

    @Patch(':id')
    @RequirePermissions(PermissionKey.UsersUpdate)
    @ApiOperation({ summary: 'Update user' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateUserDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.usersService.update(id, dto, currentUserId);
    }

    @Post(':id/role')
    @RequirePermissions(PermissionKey.UsersUpdate)
    @ApiOperation({ summary: 'Assign role to user' })
    assignRole(
        @Param('id', ParseUUIDPipe) id: string,
        @Body('roleId') roleId: string | null,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.usersService.assignRole(id, roleId, currentUserId);
    }

    @Post(':id/roles')
    @RequirePermissions(PermissionKey.UsersUpdate)
    @ApiOperation({ summary: 'Assign multiple roles to user' })
    assignRoles(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignUserRolesDto,
        @CurrentUser('sub') currentUserId: string,
    ) {
        return this.usersService.assignRoles(id, dto.roleIds, currentUserId);
    }

    @Post('sync-badges')
    @RequirePermissions(PermissionKey.UsersSync)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Import badge/card data from Amadeus and link to users by idNumber' })
    async syncBadges(@CurrentUser('sub') currentUserId: string) {
        this.logger.log(`Badge import triggered by user ${currentUserId}`);
        const result = await this.badgeImportService.importBadgesFromAmadeus(currentUserId);
        return result;
    }
}
