import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import * as https from 'https';
import { AmadeusSyncQueue } from '../amadeus/entities/amadeus-sync-queue.entity';
import { AmadeusSyncQueueService } from '../amadeus/services/amadeus-sync-queue.service';
import { AccessControlApiService } from './services/ac-api.service';

/**
 * Standalone module providing the AmadeusSyncQueueService + entity.
 * Imported by both AccessControlModule and AmadeusModule to avoid circular deps.
 * Provides its own AccessControlApiService instance to avoid circular imports.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([AmadeusSyncQueue]),
        HttpModule.register({
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        }),
    ],
    providers: [AmadeusSyncQueueService, AccessControlApiService],
    exports: [AmadeusSyncQueueService, TypeOrmModule],
})
export class AmadeusSyncQueueModule {}
