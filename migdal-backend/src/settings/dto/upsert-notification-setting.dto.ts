import { IsString, IsNotEmpty, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NOTIFICATION_EVENTS } from '../enums/notification-event.enum';

const TARGET_GROUPS = ['system_users', 'visitors', 'escorts', 'visit_requester'] as const;
const CHANNELS = ['sms', 'email'] as const;

export class UpsertNotificationSettingDto {
    @ApiProperty({ example: 'system_users', enum: TARGET_GROUPS })
    @IsString() @IsNotEmpty() @IsIn([...TARGET_GROUPS])
    targetGroup!: string;

    @ApiProperty({ example: 'visitor_arrived', enum: NOTIFICATION_EVENTS })
    @IsString() @IsNotEmpty() @IsIn(NOTIFICATION_EVENTS)
    event!: string;

    @ApiProperty({ example: 'email', enum: CHANNELS })
    @IsString() @IsNotEmpty() @IsIn([...CHANNELS])
    channel!: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    enabled!: boolean;
}
