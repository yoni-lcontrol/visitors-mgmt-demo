import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AmadeusSyncQueue } from '../amadeus/entities/amadeus-sync-queue.entity';
import { AmadeusSyncQueueService } from '../amadeus/services/amadeus-sync-queue.service';
import { AccessControlApiService } from './services/ac-api.service';
import { buildAccessControlHttpsAgent } from '../common/utils/access-control-https-agent.util';

/**
 * Standalone module providing the AmadeusSyncQueueService + entity.
 * Imported by both AccessControlModule and AmadeusModule to avoid circular deps.
 * Provides its own AccessControlApiService instance to avoid circular imports.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([AmadeusSyncQueue]),
        HttpModule.registerAsync({
            useFactory: (configService: ConfigService) => ({
                httpsAgent: buildAccessControlHttpsAgent(configService),
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [AmadeusSyncQueueService, AccessControlApiService],
    exports: [AmadeusSyncQueueService, TypeOrmModule],
})
export class AmadeusSyncQueueModule {}
