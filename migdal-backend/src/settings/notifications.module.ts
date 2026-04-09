import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsTemplate } from './entities/sms-template.entity';
import { NotificationSetting } from './entities/notification-setting.entity';
import { SmsTemplateController } from './sms-template.controller';
import { SmsTemplateService } from './sms-template.service';
import { SmsTemplateRendererService } from './sms-template-renderer.service';
import { SmsProviderService } from './sms-provider.service';
import { SmsNotificationService } from './sms-notification.service';
import { EmailTemplateController } from './email-template.controller';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateRendererService } from './email-template-renderer.service';
import { EmailProviderService } from './email-provider.service';
import { EmailNotificationService } from './email-notification.service';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([SmsTemplate, NotificationSetting]),
    ],
    controllers: [],
    providers: [
        NotificationSettingsService,
        SmsTemplateService,
        SmsTemplateRendererService,
        SmsProviderService,
        SmsNotificationService,
        EmailTemplateService,
        EmailTemplateRendererService,
        EmailProviderService,
        EmailNotificationService,
    ],
    exports: [
        NotificationSettingsService,
        SmsTemplateService,
        SmsTemplateRendererService,
        SmsNotificationService,
        EmailTemplateService,
        EmailTemplateRendererService,
        EmailNotificationService,
    ],
})
export class NotificationsModule { }
