import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class TokenCleanupTask {
    private readonly logger = new Logger(TokenCleanupTask.name);

    constructor(private readonly authService: AuthService) { }

    @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'token-cleanup' })
    async handleCron(): Promise<void> {
        this.logger.log('Scheduled token cleanup job started');

        try {
            const deleted = await this.authService.cleanupExpiredTokens();
            this.logger.log(`Scheduled token cleanup job completed — ${deleted} tokens removed`);
        } catch (err) {
            this.logger.error('Scheduled token cleanup job failed unexpectedly', (err as Error).stack);
        }
    }
}
