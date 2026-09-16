import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NOTIFICATION_EVENTS } from '../enums/notification-event.enum';

const TARGET_GROUPS = ['visit_creator', 'visitors', 'escorts', 'visit_requester'] as const;

export class PreviewSmsTemplateDto {
    @ApiProperty({ example: 'visit_created', enum: NOTIFICATION_EVENTS })
    @IsString()
    @IsNotEmpty()
    @IsIn(NOTIFICATION_EVENTS)
    event!: string;

    @ApiPropertyOptional({ example: 'visit_creator', enum: TARGET_GROUPS })
    @IsOptional()
    @IsString()
    @IsIn([...TARGET_GROUPS])
    targetGroup?: string;

    @ApiPropertyOptional({ example: 'Custom template text with {{visit.title}}' })
    @IsOptional()
    @IsString()
    template?: string;
}
