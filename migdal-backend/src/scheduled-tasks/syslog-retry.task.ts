import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { SyslogService } from '../audit/syslog.service';

@Injectable()
export class SyslogRetryTask {
    private readonly logger = new Logger(SyslogRetryTask.name);
    private running = false;

    constructor(
        @InjectRepository(AuditLog)
        private readonly auditRepo: Repository<AuditLog>,
        private readonly syslogService: SyslogService,
    ) { }

    @Cron(CronExpression.EVERY_5_MINUTES, { name: 'syslog-retry' })
    async handleCron(): Promise<void> {
        if (!this.syslogService.isEnabled()) return;
        if (this.running) return;
        this.running = true;

        try {
            const unsent = await this.auditRepo.find({
                where: { syslogSentAt: IsNull() },
                order: { createdAt: 'ASC' },
                take: 100,
            });

            if (unsent.length === 0) return;

            this.logger.log(`Retrying ${unsent.length} unsent syslog messages`);
            let successCount = 0;

            for (const entry of unsent) {
                const success = await this.syslogService.send({
                    category: 'audit',
                    userId: entry.userId,
                    module: entry.module,
                    action: entry.action,
                    entity: entry.entity,
                    entityId: entry.entityId,
                    description: entry.description,
                    ipAddress: entry.ipAddress,
                    timestamp: entry.createdAt?.toISOString(),
                });

                if (success) {
                    entry.syslogSentAt = new Date();
                    await this.auditRepo.save(entry);
                    successCount++;
                } else {
                    // Stop retrying this batch if syslog is down
                    break;
                }
            }

            if (successCount > 0) {
                this.logger.log(`Successfully sent ${successCount} syslog messages`);
            }
        } catch (err) {
            this.logger.error('Syslog retry task failed', (err as Error).stack);
        } finally {
            this.running = false;
        }
    }
}
