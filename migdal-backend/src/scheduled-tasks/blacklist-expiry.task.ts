import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlacklistService } from '../visitors/blacklist.service';

@Injectable()
export class BlacklistExpiryTask {
    private readonly logger = new Logger(BlacklistExpiryTask.name);

    constructor(private readonly blacklistService: BlacklistService) { }

    @Cron(CronExpression.EVERY_HOUR, { name: 'blacklist-expiry' })
    async handleCron(): Promise<void> {
        this.logger.log('Blacklist expiry cleanup started');

        try {
            const count = await this.blacklistService.removeExpired();
            this.logger.log(`Blacklist expiry cleanup completed — ${count} entries deactivated`);
        } catch (err) {
            this.logger.error('Blacklist expiry cleanup failed', (err as Error).stack);
        }
    }
}
