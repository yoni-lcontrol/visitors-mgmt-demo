import { Module, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { AuthModule } from '../auth/auth.module';
import { AdSyncTask } from './ad-sync.task';
import { RetentionCleanupTask } from './retention-cleanup.task';
import { VisitorAutoCheckoutTask } from './visitor-auto-checkout.task';
import { TokenCleanupTask } from './token-cleanup.task';
import { SyslogRetryTask } from './syslog-retry.task';
import { BlacklistExpiryTask } from './blacklist-expiry.task';
import { AuditLog } from '../common/entities/audit-log.entity';
import { AD_SYNC_QUEUE } from '../users/ad-sync.processor';

@Module({
    imports: [
        UsersModule,
        SettingsModule,
        VisitorsModule,
        AuthModule,
        TypeOrmModule.forFeature([AuditLog]),
        ...(process.env.REDIS_HOST
            ? [BullModule.registerQueue({ name: AD_SYNC_QUEUE })]
            : []) as DynamicModule[],
    ],
    providers: [AdSyncTask, RetentionCleanupTask, VisitorAutoCheckoutTask, TokenCleanupTask, SyslogRetryTask, BlacklistExpiryTask],
})
export class ScheduledTasksModule { }
