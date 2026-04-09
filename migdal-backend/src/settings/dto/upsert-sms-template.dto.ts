import { IsString, IsNotEmpty, IsIn, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NOTIFICATION_EVENTS } from '../enums/notification-event.enum';

const TARGET_GROUPS = ['system_users', 'visitors', 'escorts', 'visit_requester'] as const;

export class UpsertSmsTemplateDto {
    @ApiProperty({ example: 'visit_created', enum: NOTIFICATION_EVENTS })
    @IsString()
    @IsNotEmpty()
    @IsIn(NOTIFICATION_EVENTS)
    event!: string;

    @ApiProperty({ example: 'system_users', enum: TARGET_GROUPS })
    @IsString()
    @IsNotEmpty()
    @IsIn([...TARGET_GROUPS])
    targetGroup!: string;

    @ApiProperty({ example: 'ביקור חדש: {{visit.title}} מתוכנן ל-{{visit.startTime}}.' })
    @IsString()
    @IsNotEmpty()
    template!: string;

    @ApiPropertyOptional({ example: ['+972501234567'], type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    recipients?: string[];
}
