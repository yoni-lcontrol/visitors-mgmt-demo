import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdSyncAdapterService } from './ad-sync-adapter.service';
import { AdSyncService } from './ad-sync.service';
import { AdSyncProcessor, AD_SYNC_QUEUE } from './ad-sync.processor';
import { User } from './entities/user.entity';
import { UserBadge } from './entities/user-badge.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { SectorsModule } from '../sectors/sectors.module';
import { Role } from '../roles/entities/role.entity';
import { AdGroupRoleMapping } from '../ad-group-role-mappings/entities/ad-group-role-mapping.entity';
import { AccessControlModule } from '../access-control/access-control.module';
import { AmadeusBadgeImportService } from './amadeus-badge-import.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, UserBadge, AdConfiguration, Role, AdGroupRoleMapping]),
        ...(process.env.REDIS_HOST
            ? [BullModule.registerQueue({
                  name: AD_SYNC_QUEUE,
                  defaultJobOptions: {
                      attempts: 3,
                      backoff: { type: 'exponential', delay: 30_000 },
                      removeOnComplete: { count: 50 },
                      removeOnFail: { count: 100 },
                  },
              })]
            : []) as DynamicModule[],
        WebsocketModule,
        SectorsModule,
        AccessControlModule,
    ],
    controllers: [UsersController],
    providers: [UsersService, AdSyncAdapterService, AdSyncService, AdSyncProcessor, AmadeusBadgeImportService],
    exports: [UsersService, AdSyncService, AmadeusBadgeImportService],
})
export class UsersModule { }
