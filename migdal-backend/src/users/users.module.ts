import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdSyncAdapterService } from './ad-sync-adapter.service';
import { AdSyncService } from './ad-sync.service';
import { User } from './entities/user.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { SectorsModule } from '../sectors/sectors.module';
import { Role } from '../roles/entities/role.entity';
import { AdGroupRoleMapping } from '../ad-group-role-mappings/entities/ad-group-role-mapping.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, AdConfiguration, Role, AdGroupRoleMapping]), WebsocketModule, SectorsModule],
    controllers: [UsersController],
    providers: [UsersService, AdSyncAdapterService, AdSyncService],
    exports: [UsersService, AdSyncService],
})
export class UsersModule { }
