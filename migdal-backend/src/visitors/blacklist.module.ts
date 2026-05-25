import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlacklistEntry } from './entities/blacklist.entity';
import { BlacklistService } from './blacklist.service';
import { BlacklistController } from './blacklist.controller';
import { User } from '../users/entities/user.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { BlacklistOverrideRequest } from './entities/blacklist-override-request.entity';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([BlacklistEntry, User, VisitVisitor, BlacklistOverrideRequest]),
        WebsocketModule,
    ],
    controllers: [],
    providers: [BlacklistService],
    exports: [BlacklistService],
})
export class BlacklistModule { }
