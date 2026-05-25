import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { AccessControlApiService } from '../../access-control/services/ac-api.service';
import { RemoteCardholder } from '../../access-control/interfaces/ac-api.interface';
import {
    AmadeusSyncQueue,
    SyncQueueOperation,
    SyncQueueStatus,
    SyncQueueSource,
} from '../entities/amadeus-sync-queue.entity';

export interface EnqueueOptions {
    operation: SyncQueueOperation;
    source: SyncQueueSource;
    payload: RemoteCardholder | { amadeusUid: string } | { personId: string; isVisitor?: boolean };
    personId?: string;
    cardholderId?: string;
    referenceId?: string;
    referenceType?: string;
    createdBy?: string;
    maxRetries?: number;
}

@Injectable()
export class AmadeusSyncQueueService {
    private readonly logger = new Logger(AmadeusSyncQueueService.name);
    private processing = false;

    constructor(
        @InjectRepository(AmadeusSyncQueue)
        private readonly queueRepo: Repository<AmadeusSyncQueue>,
        private readonly acApi: AccessControlApiService,
    ) {}

    /**
     * Enqueue a cardholder operation. First attempts immediate execution;
     * on failure, persists to the queue for later retry.
     */
    async enqueueAndExecute(options: EnqueueOptions): Promise<{ queued: boolean; executed: boolean; queueId?: string; error?: string }> {
        const entry = this.queueRepo.create({
            operation: options.operation,
            source: options.source,
            payload: JSON.stringify(options.payload),
            personId: options.personId ?? null,
            cardholderId: options.cardholderId ?? null,
            referenceId: options.referenceId ?? null,
            referenceType: options.referenceType ?? null,
            createdBy: options.createdBy ?? null,
            maxRetries: options.maxRetries ?? 10,
            status: SyncQueueStatus.InProgress,
            nextRetryAt: null,
        });

        const saved = await this.queueRepo.save(entry);

        try {
            await this.executeOperation(saved);
            saved.status = SyncQueueStatus.Completed;
            saved.completedAt = new Date();
            await this.queueRepo.save(saved);
            return { queued: false, executed: true };
        } catch (error: any) {
            saved.status = SyncQueueStatus.Pending;
            saved.retryCount = 0;
            saved.errorMessage = error.message?.substring(0, 500) ?? 'Unknown error';
            saved.nextRetryAt = this.calculateNextRetry(0);
            await this.queueRepo.save(saved);
            this.logger.warn(`Operation queued for retry. id: ${saved.id}, personId: ${saved.personId}, error: ${error.message}`);
            return { queued: true, executed: false, queueId: saved.id, error: error.message };
        }
    }

    /**
     * Process all pending items that are due for retry.
     */
    async processQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
        if (this.processing) return { processed: 0, succeeded: 0, failed: 0 };
        this.processing = true;

        try {
            const now = new Date();
            const pending = await this.queueRepo.find({
                where: {
                    status: SyncQueueStatus.Pending,
                    isActive: true,
                    nextRetryAt: LessThanOrEqual(now),
                },
                order: { createdAt: 'ASC' },
                take: 50,
            });

            if (pending.length === 0) return { processed: 0, succeeded: 0, failed: 0 };

            this.logger.log(`Processing ${pending.length} pending Amadeus sync items`);
            let succeeded = 0;
            let failed = 0;

            for (const entry of pending) {
                entry.status = SyncQueueStatus.InProgress;
                await this.queueRepo.save(entry);

                try {
                    await this.executeOperation(entry);
                    entry.status = SyncQueueStatus.Completed;
                    entry.completedAt = new Date();
                    entry.errorMessage = null;
                    await this.queueRepo.save(entry);
                    succeeded++;
                } catch (error: any) {
                    entry.retryCount++;
                    entry.errorMessage = error.message?.substring(0, 500) ?? 'Unknown error';

                    if (this.isClientError(error)) {
                        // 4xx errors are non-retryable (bad payload, validation failure, etc.)
                        entry.status = SyncQueueStatus.Failed;
                        this.logger.error(`Non-retryable client error for sync queue item ${entry.id}: ${entry.errorMessage}`);
                    } else if (entry.retryCount >= entry.maxRetries) {
                        entry.status = SyncQueueStatus.Failed;
                        this.logger.error(`Max retries reached for sync queue item ${entry.id}. Marking as failed.`);
                    } else {
                        entry.status = SyncQueueStatus.Pending;
                        entry.nextRetryAt = this.calculateNextRetry(entry.retryCount);
                    }

                    await this.queueRepo.save(entry);
                    failed++;

                    // If first item fails with connection error, stop processing (service likely down)
                    if (this.isConnectionError(error)) {
                        this.logger.warn('Amadeus service appears unreachable. Stopping queue processing.');
                        break;
                    }
                }
            }

            this.logger.log(`Queue processing complete. succeeded: ${succeeded}, failed: ${failed}`);
            return { processed: succeeded + failed, succeeded, failed };
        } finally {
            this.processing = false;
        }
    }

    /**
     * Retry a specific failed item manually.
     */
    async retryItem(id: string): Promise<{ success: boolean; error?: string }> {
        const entry = await this.queueRepo.findOne({ where: { id, isActive: true } });
        if (!entry) return { success: false, error: 'Item not found' };
        if (entry.status === SyncQueueStatus.Completed) return { success: false, error: 'Item already completed' };

        entry.status = SyncQueueStatus.InProgress;
        await this.queueRepo.save(entry);

        try {
            await this.executeOperation(entry);
            entry.status = SyncQueueStatus.Completed;
            entry.completedAt = new Date();
            entry.errorMessage = null;
            await this.queueRepo.save(entry);
            return { success: true };
        } catch (error: any) {
            entry.retryCount++;
            entry.errorMessage = error.message?.substring(0, 500) ?? 'Unknown error';
            entry.status = entry.retryCount >= entry.maxRetries ? SyncQueueStatus.Failed : SyncQueueStatus.Pending;
            entry.nextRetryAt = this.calculateNextRetry(entry.retryCount);
            await this.queueRepo.save(entry);
            return { success: false, error: error.message };
        }
    }

    /**
     * Retry all failed items.
     */
    async retryAllFailed(): Promise<{ count: number }> {
        const result = await this.queueRepo.update(
            { status: SyncQueueStatus.Failed, isActive: true },
            { status: SyncQueueStatus.Pending, nextRetryAt: new Date(), retryCount: 0 },
        );
        return { count: result.affected ?? 0 };
    }

    /**
     * Cancel a pending/failed item.
     */
    async cancelItem(id: string): Promise<{ success: boolean }> {
        const entry = await this.queueRepo.findOne({ where: { id, isActive: true } });
        if (!entry) return { success: false };
        if (entry.status === SyncQueueStatus.Completed) return { success: false };

        entry.status = SyncQueueStatus.Cancelled;
        await this.queueRepo.save(entry);
        return { success: true };
    }

    /**
     * Get queue summary stats.
     */
    async getStats(): Promise<Record<string, number>> {
        const result = await this.queueRepo
            .createQueryBuilder('q')
            .select('q.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('q.isActive = :active', { active: true })
            .groupBy('q.status')
            .getRawMany();

        const stats: Record<string, number> = {
            pending: 0,
            in_progress: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
        };
        for (const row of result) {
            stats[row.status] = parseInt(row.count, 10);
        }
        return stats;
    }

    /**
     * List queue items with optional status filter.
     */
    async findAll(options?: {
        status?: SyncQueueStatus;
        source?: SyncQueueSource;
        page?: number;
        limit?: number;
    }): Promise<{ items: AmadeusSyncQueue[]; total: number }> {
        const page = options?.page ?? 1;
        const limit = options?.limit ?? 50;

        const where: any = { isActive: true };
        if (options?.status) where.status = options.status;
        if (options?.source) where.source = options.source;

        const [items, total] = await this.queueRepo.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { items, total };
    }

    // ── Private helpers ──

    private async executeOperation(entry: AmadeusSyncQueue): Promise<void> {
        const payload = JSON.parse(entry.payload);

        switch (entry.operation) {
            case SyncQueueOperation.CreateCardholder:
                if (payload.isVisitor) {
                    const visitorResult = await this.acApi.createVisitor(payload as RemoteCardholder);
                    entry.cardholderId = visitorResult.cardholderId ?? null;
                } else {
                    const createResult = await this.acApi.createCardholder(payload as RemoteCardholder);
                    entry.cardholderId = createResult.cardholderId ?? null;
                }
                break;
            case SyncQueueOperation.UpdateCardholder:
                await this.acApi.updateCardholder(payload.id, payload);
                break;
            case SyncQueueOperation.DeleteCardholder:
                if (payload.amadeusUid) {
                    if (payload.isVisitor) {
                        await this.acApi.deleteVisitor(payload.amadeusUid);
                    } else {
                        await this.acApi.deleteCardholder(payload.amadeusUid);
                    }
                } else if (payload.personId) {
                    // Search-then-delete: find cardholder by personId, then delete
                    const searchResult = await this.acApi.downloadCardholders({
                        search: payload.personId,
                        isVisitor: payload.isVisitor ?? false,
                    });
                    const match = searchResult.cardholders.find(ch => ch.personId === payload.personId);
                    if (!match || !match.id) {
                        this.logger.log(`Cardholder not found in Amadeus for deletion. personId: ${payload.personId}. Marking as completed.`);
                        return;
                    }
                    if (payload.isVisitor) {
                        await this.acApi.deleteVisitor(match.id);
                    } else {
                        await this.acApi.deleteCardholder(match.id);
                    }
                } else {
                    throw new Error('DeleteCardholder requires either amadeusUid or personId in payload');
                }
                break;
            default:
                throw new Error(`Unknown operation: ${entry.operation}`);
        }
    }

    private calculateNextRetry(retryCount: number): Date {
        // Exponential backoff: 30s, 1m, 2m, 4m, 8m, 15m, 30m, 30m, 30m, 30m
        const delays = [30, 60, 120, 240, 480, 900, 1800, 1800, 1800, 1800];
        const delaySec = delays[Math.min(retryCount, delays.length - 1)];
        return new Date(Date.now() + delaySec * 1000);
    }

    private isConnectionError(error: any): boolean {
        const code = error?.code ?? error?.cause?.code;
        const msg = error?.message ?? '';
        return (
            code === 'ECONNREFUSED' ||
            code === 'ETIMEDOUT' ||
            code === 'ENOTFOUND' ||
            code === 'ECONNRESET' ||
            msg.includes('Cannot reach Amadeus')
        );
    }

    private isClientError(error: any): boolean {
        const status = error?.response?.status ?? error?.status;
        return status >= 400 && status < 500;
    }
}
