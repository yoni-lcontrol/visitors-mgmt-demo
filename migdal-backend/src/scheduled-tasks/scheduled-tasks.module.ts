import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { AuthModule } from '../auth/auth.module';
import { AdSyncTask } from './ad-sync.task';
import { RetentionCleanupTask } from './retention-cleanup.task';
import { VisitorAutoCheckoutTask } from './visitor-auto-checkout.task';
import { TokenCleanupTask } from './token-cleanup.task';

@Module({
    imports: [UsersModule, SettingsModule, VisitorsModule, AuthModule],
    providers: [AdSyncTask, RetentionCleanupTask, VisitorAutoCheckoutTask, TokenCleanupTask],
})
export class ScheduledTasksModule { }
