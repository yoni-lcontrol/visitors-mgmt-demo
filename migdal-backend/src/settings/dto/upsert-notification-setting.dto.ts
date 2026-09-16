import { IsString, IsNotEmpty, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NOTIFICATION_EVENTS } from '../enums/notification-event.enum';

const TARGET_GROUPS = ['visit_creator', 'visitors', 'escorts', 'visit_requester'] as const;
const CHANNELS = ['sms', 'email'] as const;

export class UpsertNotificationSettingDto {
    @ApiProperty({ example: 'visit_creator', enum: TARGET_GROUPS })
    @IsString() @IsNotEmpty() @IsIn([...TARGET_GROUPS])
    targetGroup!: string;

    @ApiProperty({ example: 'visitor_arrived_with_escort', enum: NOTIFICATION_EVENTS })
    @IsString() @IsNotEmpty() @IsIn(NOTIFICATION_EVENTS)
    event!: string;

    @ApiProperty({ example: 'email', enum: CHANNELS })
    @IsString() @IsNotEmpty() @IsIn([...CHANNELS])
    channel!: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    enabled!: boolean;
}
