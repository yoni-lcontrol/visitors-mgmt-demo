import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AdSyncAdapterService } from './ad-sync-adapter.service';
import { AdSyncService } from './ad-sync.service';
import { User } from './entities/user.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
    imports: [TypeOrmModule.forFeature([User, AdConfiguration]), WebsocketModule],
    controllers: [UsersController],
    providers: [UsersService, AdSyncAdapterService, AdSyncService],
    exports: [UsersService, AdSyncService],
})
export class UsersModule { }
