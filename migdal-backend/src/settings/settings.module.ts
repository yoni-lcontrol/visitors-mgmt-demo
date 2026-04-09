import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { Setting } from './entities/setting.entity';
import { AdConfiguration } from './entities/ad-configuration.entity';
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
import { WebsocketModule } from '../websocket/websocket.module';
import { PrintingModule } from '../printing/printing.module';
import { NotificationsModule } from './notifications.module';
import { NotificationSettingsController } from './notification-settings.controller';
import { SmsTemplateController } from './sms-template.controller';
import { EmailTemplateController } from './email-template.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Setting, AdConfiguration, AuditLog, Visit, CardTemplate, DeviceCommandLog]),
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
        SettingsController,
    ],
    providers: [
        SettingsService,
        AdConfigurationService,
        AdSearchService,
        RetentionCleanupService,
        CardTemplateService,
    ],
    exports: [
        SettingsService,
        AdConfigurationService,
        AdSearchService,
        RetentionCleanupService,
        CardTemplateService,
        NotificationsModule,
    ],
})
export class SettingsModule { }
