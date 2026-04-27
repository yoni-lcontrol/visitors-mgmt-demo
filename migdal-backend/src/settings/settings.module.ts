import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { Setting } from './entities/setting.entity';
import { AdConfiguration } from './entities/ad-configuration.entity';
import { PermanentEscort } from './entities/permanent-escort.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { Visit } from '../visitors/entities/visit.entity';
import { AdConfigurationController } from './ad-configuration.controller';
import { AdConfigurationService } from './ad-configuration.service';
import { AdSearchService } from './ad-search.service';
import { RetentionCleanupService } from './retention-cleanup.service';
import { CardTemplate } from './entities/card-template.entity';
import { CardTemplateController } from './card-template.controller';
import { CardTemplateService } from './card-template.service';
import { DeviceCommandLog } from '../device-commands/entities/device-command-log.entity';
import { User } from '../users/entities/user.entity';
import { Sector } from '../sectors/entities/sector.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { PrintingModule } from '../printing/printing.module';
import { NotificationsModule } from './notifications.module';
import { NotificationSettingsController } from './notification-settings.controller';
import { SmsTemplateController } from './sms-template.controller';
import { EmailTemplateController } from './email-template.controller';
import { PermanentEscortsController } from './permanent-escorts.controller';
import { PermanentEscortsService } from './permanent-escorts.service';
import { VehicleManufacturer } from './entities/vehicle-manufacturer.entity';
import { VehicleModel } from './entities/vehicle-model.entity';
import { VehicleModelsController } from './vehicle-models.controller';
import { VehicleModelsService } from './vehicle-models.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Setting,
            AdConfiguration,
            PermanentEscort,
            AuditLog,
            Visit,
            CardTemplate,
            DeviceCommandLog,
            User,
            Sector,
            VehicleManufacturer,
            VehicleModel,
        ]),
        WebsocketModule,
        PrintingModule,
        NotificationsModule,
    ],
    controllers: [
        NotificationSettingsController,
        SmsTemplateController,
        EmailTemplateController,
        AdConfigurationController,
        CardTemplateController,
        PermanentEscortsController,
        VehicleModelsController,
        SettingsController,
    ],
    providers: [
        SettingsService,
        AdConfigurationService,
        AdSearchService,
        RetentionCleanupService,
        CardTemplateService,
        PermanentEscortsService,
        VehicleModelsService,
    ],
    exports: [
        SettingsService,
        AdConfigurationService,
        AdSearchService,
        RetentionCleanupService,
        CardTemplateService,
        VehicleModelsService,
        NotificationsModule,
    ],
})
export class SettingsModule { }
