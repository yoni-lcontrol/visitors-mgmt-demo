import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NOTIFICATION_EVENTS } from '../enums/notification-event.enum';

const TARGET_GROUPS = ['visit_creator', 'visitors', 'escorts', 'visit_requester'] as const;

export class PreviewEmailTemplateDto {
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

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    subject?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    bodyHtml?: string;
}
