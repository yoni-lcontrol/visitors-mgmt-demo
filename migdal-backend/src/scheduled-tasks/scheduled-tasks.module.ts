import { Module, DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { BlacklistModule } from '../visitors/blacklist.module';
import { AuthModule } from '../auth/auth.module';
import { AmadeusModule } from '../amadeus/amadeus.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { AdSyncTask } from './ad-sync.task';
import { RetentionCleanupTask } from './retention-cleanup.task';
import { VisitorAutoCheckoutTask } from './visitor-auto-checkout.task';
import { TokenCleanupTask } from './token-cleanup.task';
import { SyslogRetryTask } from './syslog-retry.task';
import { BlacklistExpiryTask } from './blacklist-expiry.task';
import { AmadeusSyncRetryTask } from './amadeus-sync-retry.task';
import { VisitorOverstayAlertTask } from './visitor-overstay-alert.task';
import { AuditLog } from '../common/entities/audit-log.entity';
import { AD_SYNC_QUEUE } from '../users/ad-sync.processor';

@Module({
    imports: [
        UsersModule,
        SettingsModule,
        VisitorsModule,
        BlacklistModule,
        AuthModule,
        AmadeusModule,
        WebsocketModule,
        TypeOrmModule.forFeature([AuditLog]),
        ...(process.env.REDIS_HOST
            ? [BullModule.registerQueue({ name: AD_SYNC_QUEUE })]
            : []) as DynamicModule[],
    ],
    providers: [AdSyncTask, RetentionCleanupTask, VisitorAutoCheckoutTask, VisitorOverstayAlertTask, TokenCleanupTask, SyslogRetryTask, BlacklistExpiryTask, AmadeusSyncRetryTask],
})
export class ScheduledTasksModule { }
