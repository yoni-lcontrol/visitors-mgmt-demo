import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitorsController } from './visitors.controller';
import { VisitorsService } from './visitors.service';
import { Visitor } from './entities/visitor.entity';
import { Visit } from './entities/visit.entity';
import { VisitVisitor } from './entities/visit-visitor.entity';
import { VisitEscort } from './entities/visit-escort.entity';
import { VisitorAccessLog } from './entities/visitor-access-log.entity';
import { VisitVisitorStatus } from './entities/visit-visitor-status.entity';
import { VisitVisitorCheckInCode } from './entities/visit-visitor-check-in-code.entity';
import { ParkingRequest } from './entities/parking-request.entity';
import { BlacklistOverrideRequest } from './entities/blacklist-override-request.entity';
import { BlacklistModule } from './blacklist.module';
import { BlacklistController } from './blacklist.controller';
import { VisitorLogController } from './visitor-log.controller';
import { VisitorLogService } from './visitor-log.service';
import { VisitsController } from './visits.controller';
import { KioskController } from './kiosk.controller';
import { VisitsService } from './visits.service';
import { VisitParticipantService } from './visit-participant.service';
import { VisitStatusService } from './visit-status.service';
import { VisitCheckInCodeService } from './visit-check-in-code.service';
import { ParkingRequestService } from './parking-request.service';
import { ParkingRequestController } from './parking-request.controller';
import { BlacklistOverrideController } from './blacklist-override.controller';
import { BlacklistOverrideService } from './blacklist-override.service';
import { VisitorAccessLogController } from './visitor-access-log.controller';
import { VisitVisitorsController } from './visit-visitors.controller';
import { VisitorPersistenceService } from './visitor-persistence.service';
import { VisitFilesService } from './visit-files.service';
import { VisitorNotificationDispatcherService } from './notifications/visitor-notification-dispatcher.service';
import { VisitFile } from './entities/visit-file.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { PrintingModule } from '../printing/printing.module';
import { SettingsModule } from '../settings/settings.module';
import { AmadeusModule } from '../amadeus/amadeus.module';
import { User } from '../users/entities/user.entity';
import { Building } from '../buildings/entities/building.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Visitor, User,
            Visit, VisitVisitor, VisitEscort, VisitorAccessLog, VisitVisitorStatus,
            VisitVisitorCheckInCode,
            ParkingRequest,
            BlacklistOverrideRequest,
            Building,
            VisitFile,
        ]),
        BlacklistModule,
        WebsocketModule,
        PrintingModule,
        SettingsModule,
        AmadeusModule,
    ],
    controllers: [
        BlacklistController,
        ParkingRequestController,
        BlacklistOverrideController,
        VisitorAccessLogController, VisitVisitorsController,
        VisitorLogController,
        VisitsController, VisitorsController,
        KioskController,
    ],
    providers: [VisitorsService, VisitorPersistenceService, VisitorLogService, VisitsService, VisitParticipantService, VisitStatusService, VisitCheckInCodeService, ParkingRequestService, BlacklistOverrideService, VisitFilesService, VisitorNotificationDispatcherService],
    exports: [VisitorsService, VisitorPersistenceService, VisitorLogService, VisitsService, VisitParticipantService, VisitStatusService, VisitCheckInCodeService, ParkingRequestService, BlacklistOverrideService, VisitFilesService, VisitorNotificationDispatcherService],
})
export class VisitorsModule { }
