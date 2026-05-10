import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AD_SYNC_QUEUE, AdSyncJobData } from '../users/ad-sync.processor';
import { AdSyncService } from '../users/ad-sync.service';

@Injectable()
export class AdSyncTask {
    private readonly logger = new Logger(AdSyncTask.name);
    private redisAvailable: boolean | null = null;
    private redisCheckedAt = 0;
    private static readonly REDIS_CHECK_INTERVAL_MS = 30_000;

    constructor(
        @Optional() @Inject(getQueueToken(AD_SYNC_QUEUE)) private readonly adSyncQueue: Queue<AdSyncJobData> | undefined,
        private readonly adSyncService: AdSyncService,
    ) { }

    private async isQueueAvailable(): Promise<boolean> {
        if (!this.adSyncQueue) return false;
        const now = Date.now();
        if (this.redisAvailable !== null && now - this.redisCheckedAt < AdSyncTask.REDIS_CHECK_INTERVAL_MS) {
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

    @Cron('0 1 * * *', { name: 'ad-user-sync' })
    async handleCron(): Promise<void> {
        const queueReady = await this.isQueueAvailable();

        if (queueReady) {
            const activeJobs = await this.adSyncQueue!.getJobs(['active', 'waiting']);
            if (activeJobs.length > 0) {
                this.logger.warn('AD sync already in progress, skipping scheduled run');
                return;
            }

            this.logger.log('Scheduled AD sync job queued');
            await this.adSyncQueue!.add('sync-all', { triggeredBy: undefined }, {
                jobId: `ad-sync-scheduled-${Date.now()}`,
            });
            return;
        }

        // Fallback — run directly when Redis is unavailable
        this.logger.warn('Redis unavailable, running scheduled AD sync directly');
        this.adSyncService.syncAll().catch(err => {
            this.logger.error('Scheduled direct AD sync failed', (err as Error).stack);
        });
    }
}
