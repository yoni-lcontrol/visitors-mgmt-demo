import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SeedService } from './seeds/seed.service';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { AcController } from '../access-control/entities/ac-controller.entity';
import { Door } from '../access-control/entities/door.entity';
import { DoorIo } from '../access-control/entities/door-io.entity';
import { Extension } from '../access-control/entities/extension.entity';
import { ExtensionIo } from '../access-control/entities/extension-io.entity';
import { AccessLevel } from '../access-control/entities/access-level.entity';
import { Visitor } from '../visitors/entities/visitor.entity';
import { BlacklistEntry } from '../visitors/entities/blacklist.entity';
import { Visit } from '../visitors/entities/visit.entity';
import { VisitVisitor } from '../visitors/entities/visit-visitor.entity';
import { VisitEscort } from '../visitors/entities/visit-escort.entity';
import { VisitorAccessLog } from '../visitors/entities/visitor-access-log.entity';
import { VisitVisitorStatus } from '../visitors/entities/visit-visitor-status.entity';
import { VisitVisitorCheckInCode } from '../visitors/entities/visit-visitor-check-in-code.entity';
import { Setting } from '../settings/entities/setting.entity';
import { NotificationSetting } from '../settings/entities/notification-setting.entity';
import { AdConfiguration } from '../settings/entities/ad-configuration.entity';
import { SmsTemplate } from '../settings/entities/sms-template.entity';
import { EmailTemplate } from '../settings/entities/email-template.entity';
import { CardTemplate } from '../settings/entities/card-template.entity';
import { PermanentEscort } from '../settings/entities/permanent-escort.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Workstation } from '../workstations/entities/workstation.entity';
import { UserWorkstationSession } from '../workstations/entities/user-workstation-session.entity';
import { WorkstationUser } from '../workstations/entities/workstation-user.entity';
import { WorkstationRole } from '../workstations/entities/workstation-role.entity';
import { WorkstationEnrollmentToken } from '../workstations/entities/workstation-enrollment-token.entity';
import { DeviceAgent } from '../agents/entities/device-agent.entity';
import { DeviceCommandLog } from '../device-commands/entities/device-command-log.entity';
import { ExternalEventLog } from '../integrations/common/entities/external-event-log.entity';
import { Building } from '../buildings/entities/building.entity';
import { ParkingRequest } from '../visitors/entities/parking-request.entity';
import { Sector } from '../sectors/entities/sector.entity';
import { AdGroupRoleMapping } from '../ad-group-role-mappings/entities/ad-group-role-mapping.entity';
import { VehicleManufacturer } from '../settings/entities/vehicle-manufacturer.entity';
import { VehicleModel } from '../settings/entities/vehicle-model.entity';

const entities = [
    User, Role, Permission, RefreshToken,
    AcController, Door, DoorIo, Extension, ExtensionIo, AccessLevel,
    Visitor, BlacklistEntry,
    Visit, VisitVisitor, VisitEscort, VisitorAccessLog, VisitVisitorStatus, VisitVisitorCheckInCode, ParkingRequest,
    Setting, NotificationSetting, AdConfiguration, SmsTemplate, EmailTemplate, CardTemplate, PermanentEscort, AuditLog,
    VehicleManufacturer, VehicleModel,
    Workstation, UserWorkstationSession, WorkstationUser, WorkstationRole, WorkstationEnrollmentToken,
    DeviceAgent, DeviceCommandLog, ExternalEventLog,
    Building,
    Sector,
    AdGroupRoleMapping,
];

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'mssql' as const,
                host: configService.get<string>('DB_HOST', 'localhost'),
                port: parseInt(configService.get<string>('DB_PORT', '1433'), 10),
                username: configService.get<string>('DB_USERNAME', 'sa'),
                password: configService.get<string>('DB_PASSWORD', ''),
                database: configService.get<string>('DB_DATABASE', 'migdal_db'),
                schema: 'dbo',
                entities,
                synchronize: false,
                logging: configService.get<string>('APP_ENV') === 'development',
                options: {
                    encrypt: false, // Set true for Azure SQL
                    trustServerCertificate: true, // Dev only
                },
            }),
        }),
    ],
    providers: [SeedService],
})
export class DatabaseModule { }
