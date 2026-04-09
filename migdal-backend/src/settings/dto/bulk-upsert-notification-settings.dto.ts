import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UpsertNotificationSettingDto } from './upsert-notification-setting.dto';

export class BulkUpsertNotificationSettingsDto {
    @ApiProperty({ type: [UpsertNotificationSettingDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpsertNotificationSettingDto)
    settings!: UpsertNotificationSettingDto[];
}
