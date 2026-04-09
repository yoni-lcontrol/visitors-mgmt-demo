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
import { BlacklistModule } from './blacklist.module';
import { BlacklistController } from './blacklist.controller';
import { VisitorLogController } from './visitor-log.controller';
import { VisitorLogService } from './visitor-log.service';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';
import { VisitParticipantService } from './visit-participant.service';
import { VisitStatusService } from './visit-status.service';
import { VisitCheckInCodeService } from './visit-check-in-code.service';
import { ParkingRequestService } from './parking-request.service';
import { ParkingRequestController } from './parking-request.controller';
import { VisitorAccessLogController } from './visitor-access-log.controller';
import { VisitVisitorsController } from './visit-visitors.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { PrintingModule } from '../printing/printing.module';
import { SettingsModule } from '../settings/settings.module';
import { User } from '../users/entities/user.entity';
import { AccessLevel } from '../access-control/entities/access-level.entity';
import { Building } from '../buildings/entities/building.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Visitor, User,
            Visit, VisitVisitor, VisitEscort, VisitorAccessLog, VisitVisitorStatus,
            VisitVisitorCheckInCode,
            ParkingRequest,
            AccessLevel,
            Building,
        ]),
        BlacklistModule,
        WebsocketModule,
        PrintingModule,
        SettingsModule,
    ],
    controllers: [
        BlacklistController,
        ParkingRequestController,
        VisitorAccessLogController, VisitVisitorsController,
        VisitorLogController,
        VisitsController, VisitorsController,
    ],
    providers: [VisitorsService, VisitorLogService, VisitsService, VisitParticipantService, VisitStatusService, VisitCheckInCodeService, ParkingRequestService],
    exports: [VisitorsService, VisitorLogService, VisitsService, VisitParticipantService, VisitStatusService, VisitCheckInCodeService, ParkingRequestService],
})
export class VisitorsModule { }
