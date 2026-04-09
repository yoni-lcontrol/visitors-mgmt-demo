import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Visit } from '../visitors/entities/visit.entity';
import { DeviceCommandLog } from '../device-commands/entities/device-command-log.entity';
import { DeviceCommandStatus } from '../device-commands/enums/device-command-status.enum';
import { SettingsService } from './settings.service';
import { AuditService } from '../audit/audit.service';

const BATCH_SIZE = 5000;

const TERMINAL_STATUSES = [
    DeviceCommandStatus.Completed,
    DeviceCommandStatus.Failed,
    DeviceCommandStatus.Timeout,
];

@Injectable()
export class RetentionCleanupService {
    private readonly logger = new Logger(RetentionCleanupService.name);

    constructor(
        @InjectRepository(AuditLog)
        private readonly auditLogRepo: Repository<AuditLog>,
        @InjectRepository(Visit)
        private readonly visitRepo: Repository<Visit>,
        @InjectRepository(DeviceCommandLog)
        private readonly commandLogRepo: Repository<DeviceCommandLog>,
        private readonly settingsService: SettingsService,
        private readonly auditService: AuditService,
    ) { }

    async handleRetentionCleanup(): Promise<void> {
        this.logger.log('Retention cleanup job started');
        try {
            const [auditMonthsStr, visitsMonthsStr, cmdLogsMonthsStr] = await Promise.all([
                this.settingsService.getValue('retention.auditLogsMonths'),
                this.settingsService.getValue('retention.visitsMonths'),
                this.settingsService.getValue('retention.deviceCommandLogsMonths'),
            ]);

            const auditMonths = this.parseRetentionMonths(auditMonthsStr);
            const visitsMonths = this.parseRetentionMonths(visitsMonthsStr);
            const cmdLogsMonths = this.parseRetentionMonths(cmdLogsMonthsStr);

            this.logger.log(
                `Retention settings — audit: ${auditMonths ?? 'disabled'}, visits: ${visitsMonths ?? 'disabled'}, ` +
                `commandLogs: ${cmdLogsMonths ?? 'disabled'}`,
            );

            let auditDeleted = 0;
            let visitsDeleted = 0;
            let commandLogsDeleted = 0;

            if (auditMonths !== null) {
                const cutoff = this.calculateCutoffDate(auditMonths);
                this.logger.log(`Cleaning audit logs older than ${cutoff.toISOString()}`);
                const deleted = await this.deleteOldAuditLogs(cutoff);
                this.logger.log(`Deleted ${deleted} audit log records`);
                auditDeleted = deleted;
            }

            if (visitsMonths !== null) {
                const cutoff = this.calculateCutoffDate(visitsMonths);
                this.logger.log(`Cleaning visits older than ${cutoff.toISOString()}`);
                const deleted = await this.deleteOldVisits(cutoff);
                this.logger.log(`Deleted ${deleted} visit records`);
                visitsDeleted = deleted;
            }

            if (cmdLogsMonths !== null) {
                const cutoff = this.calculateCutoffDate(cmdLogsMonths);
                this.logger.log(`Cleaning device command logs older than ${cutoff.toISOString()}`);
                const deleted = await this.deleteOldDeviceCommandLogs(cutoff);
                this.logger.log(`Deleted ${deleted} device command log records`);
                commandLogsDeleted = deleted;
            }

            this.auditService.log({
                module: 'settings',
                action: 'RETENTION_CLEANUP',
                entity: 'RetentionCleanup',
                description: `Retention cleanup completed: ${auditDeleted} audit logs, ${visitsDeleted} visits, ${commandLogsDeleted} command logs deleted`,
                metadata: { auditMonths, visitsMonths, cmdLogsMonths, auditDeleted, visitsDeleted, commandLogsDeleted },
            }).catch(() => { });

            this.logger.log('Retention cleanup job completed');
        } catch (error) {
            this.logger.error('Retention cleanup job failed', (error as Error).stack);
        }
    }

    /** Parse a retention value string. Returns months as number, or null if disabled. */
    parseRetentionMonths(value: string | null): number | null {
        if (value === null || value === undefined || value.trim() === '') {
            return null;
        }
        const num = Number(value);
        if (!Number.isInteger(num) || num <= 0) {
            return null;
        }
        return num;
    }

    /** Calculate the cutoff date by subtracting months from now. */
    calculateCutoffDate(months: number): Date {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        return cutoff;
    }

    /** Delete audit logs older than cutoff in batches. Returns total deleted count. */
    async deleteOldAuditLogs(cutoff: Date): Promise<number> {
        let totalDeleted = 0;
        let deleted: number;

        do {
            const result = await this.auditLogRepo
                .createQueryBuilder()
                .delete()
                .where('id IN (SELECT TOP(:batch) id FROM AuditLogs WHERE createdAt < :cutoff)', {
                    batch: BATCH_SIZE,
                    cutoff,
                })
                .execute();

            deleted = result.affected ?? 0;
            totalDeleted += deleted;
        } while (deleted === BATCH_SIZE);

        return totalDeleted;
    }

    /** Delete visits older than cutoff in batches. Returns total deleted count. */
    async deleteOldVisits(cutoff: Date): Promise<number> {
        let totalDeleted = 0;
        let deleted: number;

        do {
            const result = await this.visitRepo
                .createQueryBuilder()
                .delete()
                .where('id IN (SELECT TOP(:batch) id FROM Visits WHERE createdAt < :cutoff)', {
                    batch: BATCH_SIZE,
                    cutoff,
                })
                .execute();

            deleted = result.affected ?? 0;
            totalDeleted += deleted;
        } while (deleted === BATCH_SIZE);

        return totalDeleted;
    }

    /** Delete terminal-status device command logs older than cutoff in batches. */
    async deleteOldDeviceCommandLogs(cutoff: Date): Promise<number> {
        let totalDeleted = 0;
        let deleted: number;

        do {
            const result = await this.commandLogRepo
                .createQueryBuilder()
                .delete()
                .where(
                    'id IN (SELECT TOP(:batch) id FROM DeviceCommandLogs WHERE status IN (:...statuses) AND createdAt < :cutoff)',
                    {
                        batch: BATCH_SIZE,
                        statuses: TERMINAL_STATUSES,
                        cutoff,
                    },
                )
                .execute();

            deleted = result.affected ?? 0;
            totalDeleted += deleted;
        } while (deleted === BATCH_SIZE);

        return totalDeleted;
    }
}
